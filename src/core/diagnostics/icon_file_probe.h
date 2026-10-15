#pragma once

// Test builds measure reading MDI icon glyphs from a LittleFS file instead of
// the firmware image: 30 s after boot the built-in icon font is written once
// as a file, single glyph reads, a 200-glyph preload and a full read are
// timed, the LittleFS space is logged and the file is deleted again. Release
// builds compile it out.
#if defined(HOMETILES_TEST_BETA) || defined(HOMETILES_ISSUE38_BETA)
#define HOMETILES_ICON_FILE_PROBE 1
#endif

namespace icon_file_probe {

// Runs the measurement once per boot; call from loop(), outside LVGL's work.
void step();

}  // namespace icon_file_probe
