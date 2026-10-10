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
//   off icons                  #8B8B8B   (dark: #B0B0B0; the dark step from
//                                         white to #B0B0B0 above #464646)
//   unavailable icons          #BDBDBD   (dark: its off grey #B0B0B0)
//   secondary text             #5F6368
//   accents as text            their dark tone (OKLCH L 0.58)
// Every light value lives here, the firmware and the Web Admin preview
// (web_admin_styles.cpp emits both tables) read them from this one place.
// The theme is read at boot (ConfigManager "theme"); a change applies while
// running (UIManager::processThemeChange).
namespace ui_theme {

enum class Theme : uint8_t { Dark = 0, Light = 1 };

inline Theme g_theme = Theme::Dark;

// A surface that draws with the other theme's rules (user 2026-10-10: "the
// tile decides"): a tile in its own dark color in the light theme or in its
// own light color in the dark theme, and the dark design in the light theme
// (Media while it plays, Weather, a tile's own Design "Dark", tinted tiles
// with the global option; tile_surface, tile_icon_disc.h). While a
// SurfaceScope is open, light() and every role answer for that surface;
// theme_light() stays the screen's.
//   -1 the theme, 0 dark, 1 light, 2 dark for a tinted tile (kDarkTinted)
inline int8_t g_surface = -1;
inline constexpr int8_t kDarkTintedSurface = 2;
// The card whose surface the innermost tile scope opened
// (tile_surface::scope): a card that changes its surface while its scopes are
// open (a tint arriving in the middle of a state update) draws the rest of
// that update with the new one (follow_surface).
inline const void* g_surface_owner = nullptr;

inline bool theme_light() { return g_theme == Theme::Light; }
inline bool light() { return g_surface >= 0 ? g_surface == 1 : theme_light(); }
inline void set(uint8_t stored) { g_theme = stored == 1 ? Theme::Light : Theme::Dark; }

// SurfaceScope(kThemeSurface) draws with the theme again inside a surface.
inline constexpr int8_t kThemeSurface = -2;

class SurfaceScope {
 public:
  // -1 keeps the surface that is open (or the theme). `owner`: the tile card
  // whose surface this is (tile_surface::scope).
  explicit SurfaceScope(int8_t surface, const void* owner = nullptr)
      : saved_(g_surface), saved_owner_(g_surface_owner), owner_(owner) {
    if (surface >= 0) g_surface = surface;
    else if (surface == kThemeSurface) g_surface = -1;
    if (owner) g_surface_owner = owner;
  }
  ~SurfaceScope() {
    // Inside an outer scope of the same card the surface stays: it may have
    // changed since (follow_surface).
    if (!(owner_ && saved_owner_ == owner_)) g_surface = saved_;
    g_surface_owner = saved_owner_;
  }
  SurfaceScope(const SurfaceScope&) = delete;
  SurfaceScope& operator=(const SurfaceScope&) = delete;

 private:
  int8_t saved_;
  const void* saved_owner_;
  const void* owner_;
};

// A card changed its surface (tile_surface::change): its open scopes draw
// with the new one from here on. -1 is the theme.
inline void follow_surface(const void* owner, int8_t surface) {
  if (owner && g_surface_owner == owner) g_surface = surface < 0 ? -1 : surface;
}

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
  // Unavailable: fainter than off in the light theme (like Home Assistant,
  // user 2026-10-10); the dark theme keeps its off grey.
  uint32_t icon_unavailable;
};

inline constexpr Roles kDark = {0x000000, 0x1A1A1A, 0x2A2A2A, 0xFFFFFF, 0xFFFFFF,
                                0xB0B0B0, 0x9E9E9E, 0x9E9E9E, 0xD8DEE9, 0xD8D8D8, 0xB0B0B0};
inline constexpr Roles kLight = {0xE9EBEE, 0xFFFFFF, 0xFFFFFF, 0x1A1A1A, 0x464646,
                                 0x8B8B8B, 0x8B8B8B, 0x464646, 0x5F6368, 0x3A3A3A, 0xBDBDBD};
// A tinted tile in the dark design (global option "Tinted tiles dark"): the
// dark roles, but the off, inactive, resting and unavailable greys of the
// light theme. Such a tile is dark only while its icon has a color; the grey a
// state update gives its icon untints it, so the tile is light again when the
// grey shows (tile_surface::change).
inline constexpr Roles kDarkTinted = {kDark.screen,          kDark.card,          kDark.popup_card,
                                      kDark.text,            kDark.icon,          kLight.icon_off,
                                      kLight.icon_inactive,  kLight.icon_rest,    kDark.text_secondary,
                                      kDark.text_soft,       kLight.icon_unavailable};

// The light theme's steps against the dark ones: a circle or control step
// goes down by kLightStepNum / kLightStepDen of the dark step
// (tone_color::lifted), a tile tint mixes kLightTintNum / kLightTintDen of the
// dark strength into the light card (tile_tint::background).
inline constexpr int kLightStepNum = 5;
inline constexpr int kLightStepDen = 6;
inline constexpr int kLightTintNum = 4;
inline constexpr int kLightTintDen = 5;

// A surface counts as light above this OKLCH lightness: text, icons and
// circles on it follow the light theme's rules, else the dark one's
// (tone_color::light_surface; lab 2026-10-10: the WCAG ratio picked black on
// mid colors like green).
inline constexpr float kLightSurfaceL = 0.72f;
// The light theme's tile circle (lab 2026-10-10, like Home Assistant): the
// icon's color at this share of the Circle strength over the card (20 % at
// the default 25 %).
inline constexpr float kLightCircleShare = 0.8f;
// The dark design in the light theme (Media, Weather, the selected Settings
// category, user 2026-10-10): the dark theme's card, this much lighter
// (OKLCH L).
inline constexpr float kDarkDesignLift = 0.24f;

inline const Roles& roles_of(int8_t surface) {
  if (surface == kDarkTintedSurface) return kDarkTinted;
  if (surface < 0) return theme_light() ? kLight : kDark;
  return surface == 1 ? kLight : kDark;
}
inline const Roles& roles() { return roles_of(g_surface); }

// The same role on another surface: a label colored with a role of `from`
// takes that role of `to` (tile_surface::change). Icon glyphs prefer the
// icon roles where two roles share a color; colors that are no role (an
// entity's color) stay.
inline uint32_t map_role(uint32_t rgb, const Roles& from, const Roles& to, bool icon_glyph) {
  using Role = uint32_t Roles::*;
  static constexpr Role kTextFirst[] = {&Roles::text,     &Roles::text_secondary, &Roles::text_soft,
                                        &Roles::icon,     &Roles::icon_off,       &Roles::icon_inactive,
                                        &Roles::icon_rest, &Roles::icon_unavailable};
  static constexpr Role kIconFirst[] = {&Roles::icon,          &Roles::icon_off,  &Roles::icon_inactive,
                                        &Roles::icon_rest,     &Roles::icon_unavailable, &Roles::text,
                                        &Roles::text_secondary, &Roles::text_soft};
  rgb &= 0xFFFFFF;
  for (const Role role : icon_glyph ? kIconFirst : kTextFirst) {
    if (from.*role == rgb) return to.*role;
  }
  return rgb;
}

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
inline uint32_t icon_unavailable() { return roles().icon_unavailable; }

}  // namespace ui_theme

#endif  // HOMETILES_UI_THEME_H
