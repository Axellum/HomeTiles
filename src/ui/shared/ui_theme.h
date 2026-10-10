// A classic guard: HomeTiles.ino and the headers reach this file under two
// path spellings (\ and /), which #pragma once does not see as one file.
#ifndef HOMETILES_UI_THEME_H
#define HOMETILES_UI_THEME_H

#include <stdint.h>

// The UI's color roles for the dark theme (the firmware's original look) and
// the light theme. Every dark value is exactly the color the code used before
// the roles, so the dark theme draws the same pixels. The light theme mirrors
// the dark one's rules: where the dark theme steps lighter on a dark card, the
// light theme steps darker on a light card; its values were set in the
// simulator with the user (2026-10-09, build/analysis/2026-10-09-analyse.md
// "Heller Modus"):
//   text and the head's icons  #1A1A1A   (dark: white)
//   an icon beside a text      #464646   (dark: white)
//   off and unavailable icons  #8B8B8B   (dark: #B0B0B0; the dark step from
//                                         white to #B0B0B0 above #464646)
//   secondary text             #5F6368
//   accents as text            their dark tone (OKLCH L 0.58)
// Every light value lives here, the firmware and the Web Admin preview
// (web_admin_styles.cpp emits both tables) read them from this one place.
// The theme is read at boot (ConfigManager "theme"); a change applies while
// running (UIManager::processThemeChange).
namespace ui_theme {

enum class Theme : uint8_t { Dark = 0, Light = 1 };

inline Theme g_theme = Theme::Dark;

inline bool light() { return g_theme == Theme::Light; }
inline void set(uint8_t stored) { g_theme = stored == 1 ? Theme::Light : Theme::Dark; }

// The roles of one theme.
struct Roles {
  // The screen behind tiles, head and Settings.
  uint32_t screen;
  // The card of a tile, group or popup without its own color.
  uint32_t card;
  // A popup's card when its opener passes no color (popup_surface::default_card).
  uint32_t popup_card;
  // Text, values and the head's icons (Home, folder, gear, X).
  uint32_t text;
  // An icon beside a text (tile icons, Settings rows, media controls) and the
  // white fills of the dark theme (the play circle, slider knobs).
  uint32_t icon;
  // Off: a switched-off light or switch.
  uint32_t icon_off;
  // Inactive: an unavailable entity, the device grey (fan off, disarmed); the
  // light theme's off grey.
  uint32_t icon_inactive;
  // The dark theme's resting grey (folders, a binary sensor at rest, a closed
  // cover, the gear): a normal icon in the light theme.
  uint32_t icon_rest;
  // Secondary text: subtitles, the media artist.
  uint32_t text_secondary;
  // The softer text of the dark theme's #D8D8D8 (pressed play circle, captions).
  uint32_t text_soft;
};

inline constexpr Roles kDark = {0x000000, 0x1A1A1A, 0x2A2A2A, 0xFFFFFF, 0xFFFFFF,
                                0xB0B0B0, 0x9E9E9E, 0x9E9E9E, 0xD8DEE9, 0xD8D8D8};
inline constexpr Roles kLight = {0xE9EBEE, 0xFFFFFF, 0xFFFFFF, 0x1A1A1A, 0x464646,
                                 0x8B8B8B, 0x8B8B8B, 0x464646, 0x5F6368, 0x3A3A3A};

// The light theme's steps against the dark ones: a circle or control step
// goes down by kLightStepNum / kLightStepDen of the dark step
// (tone_color::lifted), a tile tint mixes kLightTintNum / kLightTintDen of the
// dark strength into the light card (tile_tint::background).
inline constexpr int kLightStepNum = 5;
inline constexpr int kLightStepDen = 6;
inline constexpr int kLightTintNum = 4;
inline constexpr int kLightTintDen = 5;

inline const Roles& roles() { return light() ? kLight : kDark; }

inline uint32_t screen() { return roles().screen; }
inline uint32_t card() { return roles().card; }
inline uint32_t popup_card() { return roles().popup_card; }
inline uint32_t text() { return roles().text; }
inline uint32_t icon() { return roles().icon; }
inline uint32_t icon_off() { return roles().icon_off; }
inline uint32_t icon_inactive() { return roles().icon_inactive; }
inline uint32_t icon_rest() { return roles().icon_rest; }
inline uint32_t text_secondary() { return roles().text_secondary; }
inline uint32_t text_soft() { return roles().text_soft; }

}  // namespace ui_theme

#endif  // HOMETILES_UI_THEME_H
