#pragma once

// Test builds measure reading MDI icon glyphs from a LittleFS file instead of
// the firmware image: 30 s after boot the built-in icon font is written once
// as a file, the memory the icons would keep is held (the whole file on 32 MB
// PSRAM boards, a cache of icons in use otherwise), and for 15 minutes a
// background task times glyph reads and logs the PSRAM while the camera,
// videos and the screensaver run. Then everything is freed and the file is
// deleted. Release builds compile it out.
#if defined(HOMETILES_TEST_BETA) || defined(HOMETILES_ISSUE38_BETA)
#define HOMETILES_ICON_FILE_PROBE 1
#endif

namespace icon_file_probe {

// Runs the measurement once per boot; call from loop(), outside LVGL's work.
void step();

}  // namespace icon_file_probe
