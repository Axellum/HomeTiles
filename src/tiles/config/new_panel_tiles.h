#pragma once

#include <stdint.h>

// A brand-new panel's first page (user 2026-10-12): the head bar layout with
// the gear in the head instead of a Settings tile at the bottom, a clock (the
// digital one with weekday and date, transparent, no frame line), the folders
// "Lights" and "Climate" and a transparent welcome text, in the panel's
// language. Chosen in build/design-mockups via the emulator (newpanel-v2/-s3).
namespace new_panel_tiles {

struct Place {
  float col;
  float row;
  float span_w;
  float span_h;
};

// The four tiles' places in a grid of `cols` x `rows`: the clock 2 x 2 top
// left, the welcome text 2 x 1 below it, the folders right of the clock (side
// by side from four columns, stacked in three). False when the grid is too
// small (fewer than 3 x 3).
enum Slot : uint8_t { kClock = 0, kLights = 1, kClimate = 2, kWelcome = 3, kSlotCount = 4 };
inline bool places(int cols, int rows, Place out[kSlotCount]) {
  if (cols < 3 || rows < 3) return false;
  out[kClock] = {0, 0, 2, 2};
  out[kLights] = {2, 0, 1, 1};
  out[kClimate] = cols >= 4 ? Place{3, 0, 1, 1} : Place{2, 1, 1, 1};
  out[kWelcome] = {0, 2, 2, 1};
  return true;
}

// After the first TileConfig::load() of a new panel: adds the tiles to the
// still empty Home (classic places in the tile data, head bar places in the
// layout file), turns the gear on, switches to the head bar layout and loads
// the tiles again. False leaves the panel as it was.
bool seed();

// The setup's language changed from `from` to `to`: the default folder names
// and the welcome text nobody changed follow it.
void follow_language(const char* from, const char* to);

}  // namespace new_panel_tiles
