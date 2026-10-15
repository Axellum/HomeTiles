#pragma once

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

// "/_mdi_icons_48.bin" on LittleFS, and the release asset of the same icons.
const char* file_path();
const char* release_file_name();

}  // namespace mdi_icon_store
