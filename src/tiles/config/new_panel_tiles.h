#pragma once

#include <stdint.h>

// A brand-new panel's first page (user 2026-10-12): the head bar layout with
// the gear in the head and the Settings tile parked, an analog clock with the
// time and the weekday and date beside the face (transparent, no frame line),
// the folders "Lights" and "Climate" and a transparent "Welcome to
// HomeTiles!", in the panel's language. Arranged by the user in the Web Admin.
namespace new_panel_tiles {

struct Place {
  float col;
  float row;
  float span_w;
  float span_h;
};

// The four tiles' places in a grid of `cols` x `rows`, the same in every
// grid: the clock 2 x 1 top left, the welcome text 2 x 1 below it, the
// folders stacked right of them. False when the grid is too small (fewer than
// 3 x 3).
enum Slot : uint8_t { kClock = 0, kLights = 1, kClimate = 2, kWelcome = 3, kSlotCount = 4 };
inline bool places(int cols, int rows, Place out[kSlotCount]) {
  if (cols < 3 || rows < 3) return false;
  out[kClock] = {0, 0, 2, 1};
  out[kLights] = {2, 0, 1, 1};
  out[kClimate] = {2, 1, 1, 1};
  out[kWelcome] = {0, 1, 2, 1};
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
