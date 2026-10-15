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
// Boards with this much PSRAM keep the whole file in memory (P4: 32 MB); the
// others keep a cache of the icons in use (S3: 8 MB).
constexpr size_t kHoldAllPsram = 16 * 1024 * 1024;
constexpr int kCacheGlyphs = 300;
constexpr int kRoundGlyphs = 100;
constexpr uint32_t kRoundMs = 30000;
constexpr uint32_t kRounds = 30;  // 15 minutes, for camera, video and screensaver tests

bool g_started = false;

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
uint32_t read_glyph(File& f, const Layout& l, uint32_t id, uint8_t* buf) {
  const uint32_t n = glyph_bytes(l, id);
  if (n == 0 || n > kMaxGlyphBytes) return 0;
  f.seek(l.table_bytes + l.dsc->glyph_dsc[id].bitmap_index);
  const size_t got = f.read(buf, n);
  if (got != n || memcmp(buf, l.dsc->glyph_bitmap + l.dsc->glyph_dsc[id].bitmap_index, n) != 0) {
    Serial.printf("[IconFile] Glyph %u read back wrong (%u of %u bytes)\n", static_cast<unsigned>(id),
                  static_cast<unsigned>(got), static_cast<unsigned>(n));
  }
  return n;
}

// The memory the icons would keep: the whole file, or the icons in use.
uint8_t* hold_memory(const Layout& l, size_t& held) {
  const uint32_t started = millis();
  held = 0;
  if (heap_caps_get_total_size(MALLOC_CAP_SPIRAM) >= kHoldAllPsram) {
    const size_t total = l.table_bytes + l.bitmap_bytes;
    uint8_t* all = static_cast<uint8_t*>(heap_caps_malloc(total, MALLOC_CAP_SPIRAM));
    File f = LittleFS.open(kPath, "r");
    if (!all || !f) {
      if (all) heap_caps_free(all);
      return nullptr;
    }
    while (held < total) {
      const size_t n = f.read(all + held, std::min<size_t>(kChunk, total - held));
      if (n == 0) break;
      held += n;
    }
    f.close();
    Serial.printf("[IconFile] Holding the whole file: %u KB in %u ms\n", static_cast<unsigned>(held / 1024),
                  static_cast<unsigned>(millis() - started));
    return all;
  }
  uint8_t* cache = static_cast<uint8_t*>(heap_caps_malloc(kCacheGlyphs * kMaxGlyphBytes / 16, MALLOC_CAP_SPIRAM));
  File f = LittleFS.open(kPath, "r");
  if (!cache || !f) {
    if (cache) heap_caps_free(cache);
    return nullptr;
  }
  uint8_t buf[512];
  uint32_t ids[kCacheGlyphs];
  for (int i = 0; i < kCacheGlyphs; i++) ids[i] = random_glyph(l);
  std::sort(ids, ids + kCacheGlyphs);
  const size_t room = kCacheGlyphs * kMaxGlyphBytes / 16;
  for (int i = 0; i < kCacheGlyphs; i++) {
    const uint32_t n = glyph_bytes(l, ids[i]);
    if (n > sizeof(buf) || held + n > room) continue;
    read_glyph(f, l, ids[i], buf);
    memcpy(cache + held, buf, n);
    held += n;
  }
  f.close();
  Serial.printf("[IconFile] Holding a cache of %d icons: %u KB in %u ms\n", kCacheGlyphs,
                static_cast<unsigned>(held / 1024), static_cast<unsigned>(millis() - started));
  return cache;
}

// Background rounds while the user runs the camera, videos and the screensaver.
void rounds_task(void* held_memory) {
  const Layout l = layout();
  uint8_t* buf = static_cast<uint8_t*>(heap_caps_malloc(kMaxGlyphBytes, MALLOC_CAP_SPIRAM));
  File f = LittleFS.open(kPath, "r");
  for (uint32_t round = 1; buf && f && round <= kRounds; round++) {
    vTaskDelay(pdMS_TO_TICKS(kRoundMs));
    uint32_t min_us = UINT32_MAX, max_us = 0, sum_us = 0;
    for (int i = 0; i < kRoundGlyphs; i++) {
      const uint32_t started = micros();
      read_glyph(f, l, random_glyph(l), buf);
      const uint32_t us = micros() - started;
      min_us = std::min(min_us, us);
      max_us = std::max(max_us, us);
      sum_us += us;
    }
    Serial.printf("[IconFile] Round %u/%u: %d icons min %u us, avg %u us, max %u us | PSRAM free=%u KB "
                  "min=%u KB largest=%u KB\n",
                  static_cast<unsigned>(round), static_cast<unsigned>(kRounds), kRoundGlyphs,
                  static_cast<unsigned>(min_us), static_cast<unsigned>(sum_us / kRoundGlyphs),
                  static_cast<unsigned>(max_us),
                  static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / 1024),
                  static_cast<unsigned>(heap_caps_get_minimum_free_size(MALLOC_CAP_SPIRAM) / 1024),
                  static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM) / 1024));
  }
  if (f) f.close();
  if (buf) heap_caps_free(buf);
  if (held_memory) heap_caps_free(held_memory);
  LittleFS.remove(kPath);
  log_space("after the test");
  vTaskDelete(nullptr);
}

}  // namespace

void step() {
  if (g_started || millis() < kStartDelayMs) return;
  g_started = true;
  const Layout l = layout();
  Serial.printf("[IconFile] Probe: %u glyphs, %u KB bitmaps, %u KB glyph table\n",
                static_cast<unsigned>(l.glyphs), static_cast<unsigned>(l.bitmap_bytes / 1024),
                static_cast<unsigned>(l.table_bytes / 1024));
  log_space("before");
  LittleFS.remove(kPath);
  if (!write_file(l)) {
    LittleFS.remove(kPath);
    return;
  }
  log_space("with the file");
  size_t held = 0;
  uint8_t* memory = hold_memory(l, held);
  Serial.printf("[IconFile] Rounds every %u s for %u minutes: use the camera, videos and the screensaver now\n",
                static_cast<unsigned>(kRoundMs / 1000), static_cast<unsigned>(kRounds * kRoundMs / 60000));
  xTaskCreatePinnedToCore(rounds_task, "icon_probe", 4096, memory, 1, nullptr, 0);
}

}  // namespace icon_file_probe

#else

namespace icon_file_probe {
void step() {}
}  // namespace icon_file_probe

#endif
