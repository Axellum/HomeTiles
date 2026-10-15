#include "src/core/diagnostics/icon_file_probe.h"

#if defined(HOMETILES_ICON_FILE_PROBE)

#include <Arduino.h>
#include <LittleFS.h>
#include <esp_heap_caps.h>
#include <esp_random.h>
#include <lvgl.h>

#include <algorithm>

#include "src/devices/device.h"
#include "src/tiles/icons/mdi_icons.h"

namespace icon_file_probe {
namespace {

constexpr const char* kPath = "/_icon_probe.bin";
constexpr uint32_t kStartDelayMs = 30000;
constexpr size_t kChunk = 32 * 1024;
constexpr size_t kMaxGlyphBytes = 8192;
constexpr int kRandomReads = 300;
constexpr int kOpenReads = 50;
constexpr int kPreloadGlyphs = 200;

bool g_done = false;

struct Layout {
  const lv_font_fmt_txt_dsc_t* dsc = nullptr;
  uint32_t glyphs = 0;        // glyph ids 0 .. glyphs - 1 (0 is reserved)
  uint32_t table_bytes = 0;   // the glyph descriptors, first in the file
  uint32_t bitmap_bytes = 0;  // bitmaps up to the last glyph
};

Layout layout() {
  Layout out;
  out.dsc = static_cast<const lv_font_fmt_txt_dsc_t*>(FONT_MDI_ICONS->dsc);
  for (uint16_t i = 0; i < out.dsc->cmap_num; i++) {
    const lv_font_fmt_txt_cmap_t& cmap = out.dsc->cmaps[i];
    const uint32_t count = cmap.list_length ? cmap.list_length : cmap.range_length;
    out.glyphs = std::max<uint32_t>(out.glyphs, cmap.glyph_id_start + count);
  }
  out.table_bytes = out.glyphs * sizeof(lv_font_fmt_txt_glyph_dsc_t);
  out.bitmap_bytes = out.dsc->glyph_dsc[out.glyphs - 1].bitmap_index;
  return out;
}

// A glyph's bitmap ends where the next one starts (the last one is not used).
uint32_t glyph_bytes(const Layout& l, uint32_t id) {
  return l.dsc->glyph_dsc[id + 1].bitmap_index - l.dsc->glyph_dsc[id].bitmap_index;
}

uint32_t random_glyph(const Layout& l) {
  return 1 + esp_random() % (l.glyphs - 2);
}

void log_space(const char* when) {
  Serial.printf("[IconFile] LittleFS %s: %u of %u KB used | PSRAM free=%u KB\n", when,
                static_cast<unsigned>(LittleFS.usedBytes() / 1024),
                static_cast<unsigned>(LittleFS.totalBytes() / 1024),
                static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / 1024));
}

bool write_file(const Layout& l) {
  // The S3's RGB scanout needs its storage guard around flash writes (the
  // display stays dark meanwhile); a no-op on the other boards.
  Device::ScopedStorageWrite storage_write;
  File f = LittleFS.open(kPath, "w");
  if (!f) return false;
  const uint32_t started = millis();
  size_t written = f.write(reinterpret_cast<const uint8_t*>(l.dsc->glyph_dsc), l.table_bytes);
  for (uint32_t pos = 0; pos < l.bitmap_bytes && written; pos += kChunk) {
    const size_t n = std::min<size_t>(kChunk, l.bitmap_bytes - pos);
    written = f.write(l.dsc->glyph_bitmap + pos, n) == n ? written + n : 0;
    vTaskDelay(1);  // let the idle task run during the long write
  }
  f.close();
  const uint32_t ms = millis() - started;
  const uint32_t total = l.table_bytes + l.bitmap_bytes;
  if (written != total) {
    Serial.printf("[IconFile] Write failed after %u of %u bytes\n",
                  static_cast<unsigned>(written), static_cast<unsigned>(total));
    return false;
  }
  Serial.printf("[IconFile] Wrote %u KB in %u ms (%u KB/s)\n", static_cast<unsigned>(total / 1024),
                static_cast<unsigned>(ms), static_cast<unsigned>(ms ? total / ms : 0));
  return true;
}

// One glyph from an open file: seek to its bitmap and read it.
uint32_t read_glyph_us(File& f, const Layout& l, uint32_t id, uint8_t* buf) {
  const uint32_t n = glyph_bytes(l, id);
  if (n == 0 || n > kMaxGlyphBytes) return 0;
  const uint32_t started = micros();
  f.seek(l.table_bytes + l.dsc->glyph_dsc[id].bitmap_index);
  const size_t got = f.read(buf, n);
  const uint32_t us = micros() - started;
  if (got != n || memcmp(buf, l.dsc->glyph_bitmap + l.dsc->glyph_dsc[id].bitmap_index, n) != 0) {
    Serial.printf("[IconFile] Glyph %u read back wrong (%u of %u bytes)\n", static_cast<unsigned>(id),
                  static_cast<unsigned>(got), static_cast<unsigned>(n));
  }
  return us;
}

void measure(const Layout& l) {
  uint8_t* buf = static_cast<uint8_t*>(heap_caps_malloc(kMaxGlyphBytes, MALLOC_CAP_SPIRAM));
  if (!buf) return;

  // Single glyphs from a file that stays open (the planned way).
  File f = LittleFS.open(kPath, "r");
  if (f) {
    uint32_t min_us = UINT32_MAX, max_us = 0, sum_us = 0, bytes = 0;
    for (int i = 0; i < kRandomReads; i++) {
      const uint32_t id = random_glyph(l);
      const uint32_t us = read_glyph_us(f, l, id, buf);
      min_us = std::min(min_us, us);
      max_us = std::max(max_us, us);
      sum_us += us;
      bytes += glyph_bytes(l, id);
    }
    Serial.printf("[IconFile] %d random glyphs, file open: min %u us, avg %u us, max %u us, avg %u bytes\n",
                  kRandomReads, static_cast<unsigned>(min_us), static_cast<unsigned>(sum_us / kRandomReads),
                  static_cast<unsigned>(max_us), static_cast<unsigned>(bytes / kRandomReads));

    // A preload: glyphs in file order, as for the icons of all tiles at boot.
    uint32_t ids[kPreloadGlyphs];
    for (int i = 0; i < kPreloadGlyphs; i++) ids[i] = random_glyph(l);
    std::sort(ids, ids + kPreloadGlyphs);
    const uint32_t started = micros();
    for (int i = 0; i < kPreloadGlyphs; i++) read_glyph_us(f, l, ids[i], buf);
    Serial.printf("[IconFile] Preload of %d glyphs: %u ms\n", kPreloadGlyphs,
                  static_cast<unsigned>((micros() - started) / 1000));
    f.close();
  }

  // Single glyphs with open and close each time (the worst case).
  uint32_t max_us = 0, sum_us = 0;
  for (int i = 0; i < kOpenReads; i++) {
    const uint32_t started = micros();
    File g = LittleFS.open(kPath, "r");
    if (!g) break;
    read_glyph_us(g, l, random_glyph(l), buf);
    g.close();
    const uint32_t us = micros() - started;
    max_us = std::max(max_us, us);
    sum_us += us;
  }
  Serial.printf("[IconFile] %d glyphs with open/close: avg %u us, max %u us\n", kOpenReads,
                static_cast<unsigned>(sum_us / kOpenReads), static_cast<unsigned>(max_us));
  heap_caps_free(buf);

  // The whole file into PSRAM, for comparison with loading everything.
  const uint32_t total = l.table_bytes + l.bitmap_bytes;
  uint8_t* all = static_cast<uint8_t*>(heap_caps_malloc(total, MALLOC_CAP_SPIRAM));
  File h = LittleFS.open(kPath, "r");
  if (all && h) {
    const uint32_t started = millis();
    size_t got = 0;
    while (got < total) {
      const size_t n = h.read(all + got, std::min<size_t>(kChunk, total - got));
      if (n == 0) break;
      got += n;
    }
    const uint32_t ms = millis() - started;
    Serial.printf("[IconFile] Full read %u KB: %u ms (%u KB/s)\n", static_cast<unsigned>(got / 1024),
                  static_cast<unsigned>(ms), static_cast<unsigned>(ms ? got / ms : 0));
  }
  if (h) h.close();
  if (all) heap_caps_free(all);
}

}  // namespace

void step() {
  if (g_done || millis() < kStartDelayMs) return;
  g_done = true;
  const Layout l = layout();
  Serial.printf("[IconFile] Probe: %u glyphs, %u KB bitmaps, %u KB glyph table\n",
                static_cast<unsigned>(l.glyphs), static_cast<unsigned>(l.bitmap_bytes / 1024),
                static_cast<unsigned>(l.table_bytes / 1024));
  log_space("before");
  LittleFS.remove(kPath);
  if (write_file(l)) {
    log_space("with the file");
    measure(l);
  }
  LittleFS.remove(kPath);
  log_space("after");
}

}  // namespace icon_file_probe

#else

namespace icon_file_probe {
void step() {}
}  // namespace icon_file_probe

#endif
