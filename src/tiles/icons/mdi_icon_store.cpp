#include "src/tiles/icons/mdi_icon_store.h"

#include <Arduino.h>
#include <LittleFS.h>
#include <esp_heap_caps.h>

#include "src/tiles/icons/mdi_icon_cache.h"
#include "src/tiles/icons/mdi_icons.h"

namespace mdi_icon_store {
namespace {

State g_state = State::Missing;
File g_file;
char g_path[32] = "";
char g_release_name[32] = "";

// Runs on the LVGL thread when a glyph is drawn the first time.
bool read_bitmap(void*, uint32_t offset, uint8_t* out, uint32_t len) {
  if (!g_file) return false;
  if (!g_file.seek(mdi_icon_cache::kHeaderBytes + offset)) return false;
  return g_file.read(out, len) == len;
}

const mdi_icon_cache::Source kFileSource = {read_bitmap, nullptr};

}  // namespace

void begin() {
  mdi_icon_loader_t* loader = MDI_ICON_LOADER;
  const mdi_icon_font_data_t& data = *loader->data;
  snprintf(g_path, sizeof(g_path), "/_mdi_icons_%u.bin", static_cast<unsigned>(data.px));
  snprintf(g_release_name, sizeof(g_release_name), "hometiles-icons-%u.bin", static_cast<unsigned>(data.px));

  // One block for the whole runtime, allocated before the UI so it never
  // splits the PSRAM that pictures and camera frames need later.
  const size_t bytes = mdi_icon_cache::block_bytes(data);
  void* block = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!block || !mdi_icon_cache::attach(loader, block, bytes, mdiUnknownIconCodepoint())) {
    if (block) heap_caps_free(block);
    Serial.printf("[Icons] No PSRAM for the icon cache (%u KB); %u built-in icons only\n",
                  static_cast<unsigned>(bytes / 1024), static_cast<unsigned>(data.core_count));
    g_state = State::Missing;
    return;
  }

  g_file = LittleFS.open(g_path, "r");
  if (!g_file) {
    Serial.printf("[Icons] No icon file %s; %u built-in icons\n", g_path,
                  static_cast<unsigned>(data.core_count));
    g_state = State::Missing;
    return;
  }
  uint8_t header[mdi_icon_cache::kHeaderBytes];
  const size_t got = g_file.read(header, sizeof(header));
  const mdi_icon_cache::HeaderCheck check =
      mdi_icon_cache::check_header(header, got, static_cast<uint32_t>(g_file.size()), data);
  if (check != mdi_icon_cache::HeaderCheck::Ok) {
    Serial.printf("[Icons] Icon file %s not used: %s; %u built-in icons\n", g_path,
                  mdi_icon_cache::header_check_text(check), static_cast<unsigned>(data.core_count));
    g_file.close();
    g_state = State::Invalid;
    return;
  }
  mdi_icon_cache::set_source(loader, &kFileSource);
  g_state = State::Ready;
  Serial.printf("[Icons] Icon file %s ready: %u icons, %u KB; cache %u KB in PSRAM\n", g_path,
                static_cast<unsigned>(data.glyph_count - 1), static_cast<unsigned>(data.bitmap_bytes / 1024),
                static_cast<unsigned>(bytes / 1024));
}

State state() { return g_state; }

const char* file_path() { return g_path; }

const char* release_file_name() { return g_release_name; }

}  // namespace mdi_icon_store
