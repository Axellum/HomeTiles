#pragma once

#include <Arduino.h>
#include <stdint.h>

// The icon file on LittleFS (tools/generate-icon-files.mjs) for this panel's
// icon size, and the cache the icon font reads it through. begin() runs once
// after LittleFS is mounted and before the UI is built: it allocates the
// cache in one PSRAM block and opens the file. Without a valid file the panel
// shows its built-in core icons and the unknown-name icon for the others.

namespace mdi_icon_store {

enum class State : uint8_t { Missing, Ready, Invalid };

void begin();
State state();

// "/_mdi_icons_48.bin" on LittleFS, the release file of the same icons and
// its exact size.
const char* file_path();
const char* release_file_name();
uint32_t file_bytes();

// Writing a new icon file, in order: begin_write() closes and deletes the
// current one (LittleFS has room for one), write() takes the bytes, header
// first, and finish_write() reads the file back, checks the bitmaps' CRC and
// moves it in place. The panel restarts afterwards to read it. The caller
// holds the storage write guard.
bool begin_write(uint32_t total, String& error);
bool write(const uint8_t* data, size_t len);
bool finish_write(String& error);

// The automatic download after an update: due while the panel has no valid
// file and fewer than three attempts were made with this firmware version.
// note_download_attempt() counts one before the download starts, so a hang
// counts too; clear_download_attempts() after a written file.
bool download_due();
void note_download_attempt();
void clear_download_attempts();

}  // namespace mdi_icon_store
