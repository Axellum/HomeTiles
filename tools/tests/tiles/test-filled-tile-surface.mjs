// Filled tiles in the light theme (user 2026-10-10, "Hell = Dunkel-Rezept"):
// a tile without an own color (tile color Global or "From icon") is filled
// while it is tinted: the card from its icon's own color, a 1 px rim a step
// lighter, white text (tile_surface::kJewel, ui_theme::kDarkTinted); off, it
// is light again. The card changes its surface in place
// (tile_icon_source::change_surface) and a running update draws on with it
// (ui_theme follow_surface). A popup opened from a filled tile draws with
// its rules (popup_surface::g_open_surface), every other popup with the
// theme. Runs the production code on real LVGL objects.
import {popupSurfaceHost, radiusPolicyHost, surfaceStyleHost} from '../../lib/surface-style-host.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cppFunctionDefinitions} from '../../lib/cpp-source.mjs';
import {lvglHost} from '../../lib/lvgl-host.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const source = read('src/tiles/runtime/tile_icon_source.cpp');
const fn = name => {
  const found = cppFunctionDefinitions(source).find(f => f.name === name);
  assert(found, name);
  return found.source;
};

// The hooks: the surface changes before a tint is computed and before it is
// cleared, so the tint takes the new surface's rules.
assert.match(fn('set_tile_tint'), /follow_tint\(card, true\);[\s\S]*SurfaceScope surface = tile_surface::scope\(card\);/);
assert.match(fn('clear_tile_tint'), /follow_tint\(card, false\);[\s\S]*kTintStore\) != LV_STYLE_RES_FOUND\) return;/);
// The renderer gives every tile without an own color the rule in the light
// theme (tile_surface_rule_of), not the screensaver and empty places.
const renderer = read('src/tiles/runtime/tile_renderer.cpp');
assert.match(renderer, /static uint8_t tile_surface_rule_of\(const Tile& tile, GridType grid_type\) \{\s*if \(grid_type == GridType::SCREENSAVER \|\| tile\.type == TILE_EMPTY \|\| !ui_theme::theme_light\(\) \|\|\s*tile_has_own_color\(tile\)\) \{\s*return 0;\s*\}\s*return tile_surface::kFollowTint;/);
assert.ok(renderer.includes('tile_surface::set_rule(tile_obj, tile_surface::kNone, rule);'), 'render_tile sets the rule before the first tint');
// No option and no per-tile Design any more (b343 removed with b344).
for (const file of ['src/core/config/config_manager.cpp', 'src/core/config/config_manager.h', 'src/web/server/web_admin.cpp',
  'src/web/server/handlers/web_admin_handlers.cpp', 'src/web/server/render/web_admin_html.cpp', 'src/core/i18n/i18n.cpp',
  'src/web/admin/settings/display-borders.js']) {
  assert.doesNotMatch(read(file), /dark_tint|DarkTinted\(|dark-tinted|darkTinted/, `${file}: no dark tinted option`);
}
for (const file of ['src/tiles/config/tile_config.h', 'src/tiles/config/tile_config.cpp', 'src/web/server/handlers/web_admin_tiles.cpp',
  'src/web/admin/tiles/snapshots.js', 'src/web/admin/tiles/import-export.js', 'src/web/admin/tiles/grid-preview.js']) {
  assert.doesNotMatch(read(file), /TileDesign|TILE_DESIGN|tile\.design\b|normalizeTileDesign|'design'/, `${file}: no per-tile Design`);
}
// The preview fills the same way (icon-colors.js setTileTintBackground) and
// leaves it with the tint (grid-preview.js).
const colors = read('src/web/admin/tiles/icon-colors.js');
assert.ok(colors.includes("if (el?.dataset?.followTint === '1' && el.dataset.surface !== 'jewel' && typeof applyTileSurface === 'function') {") &&
  colors.includes("el.style.setProperty('--tile-rim', toneHex(toneJewelRim(card, given)));"), 'preview: the tint fills the tile');
assert.ok(read('src/web/admin/tiles/grid-preview.js').includes(
  "if (tileElem.dataset.followTint === '1' && tileElem.dataset.surface === 'jewel') applyTileSurface(tileElem, '');"),
  'preview: off leaves it');
// White and almost white never fill (tone_color::no_color, device and preview).
assert.match(fn('set_tile_tint'), /\(flags & tile_surface::kFollowTint\) && tone_color::no_color\(color\)\) \{\s*clear_tile_tint\(card\);\s*return;/);
assert.ok(colors.includes("if (el?.dataset?.followTint === '1' && typeof toneNoColor === 'function' && toneNoColor(given)) {"),
  'preview: white keeps the tile light');
assert.ok(read('src/web/assets/admin.css').includes(
  'outline:1px solid var(--tile-rim, var(--tile-border-tint, rgba(var(--pv-text-rgb, 255,255,255),0.20)));'),
  'preview: the rim replaces the hairline');
// Popups: the opener sets the open surface; the Light, Climate and Cover
// popups (neutral cards) keep the theme, the others take the tile's rules.
assert.match(fn('popup_background'), /^uint32_t popup_background\(lv_obj_t\* obj, uint32_t fallback\) \{\s*set_open_popup_surface\(obj\);/);
assert.match(fn('forget_popup_source'), /popup_surface::g_open_surface = ui_theme::kThemeSurface;/);
assert.match(fn('open_popup_without_tile'), /popup_surface::g_open_surface = ui_theme::kThemeSurface;/);
const scoped = 'const ui_theme::SurfaceScope popup_scope = popup_surface::scope();';
const themed = 'const ui_theme::SurfaceScope popup_scope = popup_surface::theme_scope();';
const opens = {weather: 'show_weather_popup', media: 'show_media_popup', sensor: 'show_sensor_popup', energy: 'show_energy_popup',
  device: 'show_device_popup', camera: 'show_camera_popup', pin: 'show_pin_popup',
  light: 'show_light_popup', climate: 'show_climate_popup', cover: 'show_cover_popup'};
for (const [popup, name] of Object.entries(opens)) {
  const file = `src/ui/popups/${popup}/${popup}_popup.cpp`;
  const text = read(file);
  assert.ok(text.includes('#include "src/ui/popups/popup_surface.h"'), `${file}: popup_surface`);
  const body = cppFunctionDefinitions(text).find(f => f.name === name)?.source || '';
  const neutral = ['light', 'climate', 'cover'].includes(popup);
  assert.ok(body.includes(neutral ? themed : scoped), `${name}: ${neutral ? 'theme' : 'open surface'}`);
  if (neutral) assert.ok(!text.includes(scoped), `${file}: never the tile's surface`);
}
// Updates of the Light popup from its tile (tile scope open) draw with the theme.
const lightPopup = read('src/ui/popups/light/light_popup.cpp');
for (const name of ['update_light_popup', 'light_popup_follow_tile_color']) {
  assert.ok((cppFunctionDefinitions(lightPopup).find(f => f.name === name)?.source || '').includes(themed), `${name}: theme`);
}
const shell = read('src/ui/popups/popup_shell.cpp');
assert.ok(shell.includes('void popup_follow_surface(lv_obj_t* root) {') &&
  shell.includes('tile_icon_source::recolor_surface(root, mark->surface, want);'), 'popup texts follow the open surface');

const host = await lvglHost(root);
if (!host) {
  console.log('SKIP: filled tile surface needs LVGL and a host compiler');
  process.exit(0);
}
const out = path.join(root, 'build/tests/filled-tile-surface');
fs.mkdirSync(out, {recursive: true});
const fonts = read('src/tiles/runtime/tile_renderer_fonts.h').replace(/^#include.*$/gm, '')
  .replace('#pragma once', '').replaceAll('constexpr lv_coord_t', 'constexpr long');
const tintStore = source.match(/constexpr lv_style_selector_t kTintStore = [^;]*;/)[0];
const cpp = String.raw`
#include <lvgl.h>
#include <atomic>
#include <cstdio>
#include <string>
#include "src/ui/shared/title_label.h"
extern "C" { LV_FONT_DECLARE(ui_font_12);LV_FONT_DECLARE(ui_font_14);LV_FONT_DECLARE(ui_font_16);LV_FONT_DECLARE(ui_font_20);LV_FONT_DECLARE(ui_font_24);LV_FONT_DECLARE(ui_font_28);LV_FONT_DECLARE(ui_font_32);LV_FONT_DECLARE(ui_font_40);LV_FONT_DECLARE(mdi_icons_32);LV_FONT_DECLARE(mdi_icons_48); }
${fonts}
#define FONT_MDI_ICONS (&mdi_icons_48)
${radiusPolicyHost(root)}
#include "src/core/config/icon_glow.h"
struct Config{bool tile_borders=true;bool icon_discs=true;uint8_t icon_glow=icon_glow::kDefault;int tile_radius=tile_radius::kMinimum;const char*language="en";};struct Manager{Config cfg;const Config&getConfig(){return cfg;}}configManager;
${surfaceStyleHost(root)}
${popupSurfaceHost(root, {recolor: false})}
constexpr int GRID_CELL_H=CELL_H,GRID_GAP=GAP;
#include "src/types/climate/layout.h"
${read('src/tiles/runtime/tile_icon_disc.h').replace(/^#.*$/gm, '')}
#include "src/tiles/config/tile_tint.h"
// The default card of the surface (tile_config.cpp tileDefaultBgColor).
static uint32_t tileDefaultBgColor() { return ui_theme::light() ? ui_theme::card() : 0x1A1A1A; }
struct Tile {};
static uint32_t tileBgColorOrDefault(const Tile&, uint32_t fallback) { return fallback; }
namespace tile_icon_source {
${tintStore}
void change_surface(lv_obj_t* card, uint8_t surface, const Tile* tile = nullptr);
void set_card_base(lv_obj_t* card, uint32_t rgb);
void clear_tile_tint(lv_obj_t* card);
${fn('apply_card_background')}
${fn('set_open_popup_surface')}
${fn('follow_tint')}
${fn('set_tile_tint')}
${fn('clear_tile_tint')}
${fn('icon_glyph')}
${fn('recolor_roles')}
${fn('change_surface')}
${fn('set_card_base')}
}
static uint32_t rgb(lv_color_t c) { return lv_color_to_u32(c) & 0xFFFFFF; }
static uint32_t text(lv_obj_t* obj) { return rgb(lv_obj_get_style_text_color(obj, LV_PART_MAIN)); }
static uint32_t bg(lv_obj_t* obj) { return rgb(lv_obj_get_style_bg_color(obj, LV_PART_MAIN)); }
static bool rim(lv_obj_t* obj, uint32_t* color = nullptr) {
  lv_style_value_t value;
  if (lv_obj_get_local_style_prop(obj, LV_STYLE_OUTLINE_COLOR, &value, ui_surface_style::kBorderRimStore) != LV_STYLE_RES_FOUND) {
    return false;
  }
  if (color) *color = rgb(value.color);
  return true;
}
static int failures = 0;
static void expect(bool ok, const char* what, uint32_t got = 0, uint32_t want = 0) {
  if (ok) return;
  std::printf("FAIL %s: #%06X, expected #%06X\n", what, (unsigned)got, (unsigned)want);
  ++failures;
}
static lv_obj_t* label(lv_obj_t* parent, const char* value, uint32_t color) {
  lv_obj_t* obj = lv_label_create(parent);
  lv_label_set_text(obj, value);
  lv_obj_set_style_text_color(obj, lv_color_hex(color), 0);
  return obj;
}
int main() {
  lv_init();
  static uint32_t px[64 * 64];
  lv_display_t* display = lv_display_create(64, 64);
  lv_display_set_color_format(display, LV_COLOR_FORMAT_XRGB8888);
  lv_display_set_buffers(display, px, nullptr, sizeof(px), LV_DISPLAY_RENDER_MODE_FULL);
  ui_theme::set(1);
  const uint32_t amber = 0xFFC107;

  // A light tile without an own color, with the rule (render_tile).
  lv_obj_t* card = lv_obj_create(lv_screen_active());
  lv_obj_remove_style_all(card);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
  tile_icon_source::apply_card_background(card, ui_theme::kLight.card);
  tile_surface::set(card, tile_surface::kNone);
  tile_surface::set_rule(card, tile_surface::kNone, tile_surface::kFollowTint);
  ui_surface_style::apply_global_tile_border(card);
  lv_obj_t* row = lv_obj_create(card);
  lv_obj_t* title = label(row, "Desk", ui_theme::kLight.text);
  lv_obj_t* glyph = label(card, "\xF3\xB0\x8C\xB5", ui_theme::kLight.icon);
  lv_obj_t* note = label(row, "Artist", ui_theme::kLight.text_secondary);
  lv_obj_t* entity = label(row, "On", amber);

  // A state update turns the light on: its scope opened light, the tint
  // fills the card and the update draws on with the filled rules.
  uint32_t during = 0;
  {
    const ui_theme::SurfaceScope scope = tile_surface::scope(title);
    expect(ui_theme::text() == ui_theme::kLight.text, "update starts light", ui_theme::text(), ui_theme::kLight.text);
    tile_icon_source::set_tile_tint(card, amber, 20);
    during = ui_theme::text();
    {
      // A nested scope of the same card (the circle) keeps the new surface.
      const ui_theme::SurfaceScope inner = tile_surface::scope(glyph);
    }
    expect(ui_theme::text() == ui_theme::kDarkTinted.text, "after a nested scope", ui_theme::text(), ui_theme::kDarkTinted.text);
    expect(ui_theme::icon_off() == ui_theme::kLight.icon_off, "filled keeps the light off grey",
           ui_theme::icon_off(), ui_theme::kLight.icon_off);
    expect(tone_color::readable_icon(amber) == amber, "the icon keeps its own color", tone_color::readable_icon(amber), amber);
  }
  expect(during == ui_theme::kDarkTinted.text, "the rest of the update draws filled", during, ui_theme::kDarkTinted.text);
  expect(ui_theme::g_surface == -1 && ui_theme::g_surface_owner == nullptr, "scopes close");
  expect(tile_surface::get(card) == tile_surface::kJewel, "tinted: filled", tile_surface::get(card), tile_surface::kJewel);
  const uint32_t filled = tone_color::jewel_card(amber, 20);
  expect(bg(card) == filled, "card from the icon", bg(card), filled);
  expect(tile_surface::strength(glyph) == 20, "strength kept for the circle", tile_surface::strength(glyph), 20);
  uint32_t edge = 0;
  const uint32_t want_rim = tone_color::jewel_rim(filled, amber);
  expect(rim(card, &edge) && edge == want_rim, "rim a step lighter", edge, want_rim);
  ui_surface_style::apply_global_tile_border(card);
  expect(rgb(lv_obj_get_style_outline_color(card, LV_PART_MAIN)) == want_rim &&
         lv_obj_get_style_outline_opa(card, LV_PART_MAIN) == LV_OPA_COVER, "the hairline draws the solid rim",
         rgb(lv_obj_get_style_outline_color(card, LV_PART_MAIN)), want_rim);
  expect(text(title) == ui_theme::kDarkTinted.text, "title white", text(title), ui_theme::kDarkTinted.text);
  expect(text(glyph) == ui_theme::kDarkTinted.icon, "role icon white", text(glyph), ui_theme::kDarkTinted.icon);
  expect(text(note) == ui_theme::kDarkTinted.text_secondary, "secondary", text(note), ui_theme::kDarkTinted.text_secondary);
  expect(text(entity) == amber, "entity color stays", text(entity), amber);

  // A popup opened from it draws with its rules; from a light tile the theme.
  tile_icon_source::set_open_popup_surface(title);
  expect(popup_surface::g_open_surface == ui_theme::kDarkTintedSurface, "popup of a filled tile", popup_surface::g_open_surface,
         ui_theme::kDarkTintedSurface);
  {
    // The Light popup updated inside the tile's scope keeps the theme.
    const ui_theme::SurfaceScope tile_scope = tile_surface::scope(title);
    const ui_theme::SurfaceScope popup_scope = popup_surface::theme_scope();
    expect(ui_theme::text() == ui_theme::kLight.text, "neutral popup: theme inside a tile scope", ui_theme::text(),
           ui_theme::kLight.text);
  }

  // Off: the grey untints the card, it is light again, no rim.
  tile_icon_source::clear_tile_tint(card);
  expect(tile_surface::get(card) == tile_surface::kNone, "off: light", tile_surface::get(card), tile_surface::kNone);
  expect(bg(card) == ui_theme::kLight.card, "light card", bg(card), ui_theme::kLight.card);
  expect(!rim(card), "no rim");
  ui_surface_style::apply_global_tile_border(card);
  expect(lv_obj_get_style_outline_opa(card, LV_PART_MAIN) != LV_OPA_COVER, "the hairline again");
  expect(text(title) == ui_theme::kLight.text, "title dark", text(title), ui_theme::kLight.text);
  expect(text(glyph) == ui_theme::kLight.icon, "icon grey", text(glyph), ui_theme::kLight.icon);
  expect(text(note) == ui_theme::kLight.text_secondary, "secondary back", text(note), ui_theme::kLight.text_secondary);
  tile_icon_source::set_open_popup_surface(title);
  expect(popup_surface::g_open_surface == ui_theme::kThemeSurface, "popup of a light tile: theme");

  // White and almost white light never fill it; a color afterwards does,
  // white again empties it.
  for (const uint32_t white : {0xFFFFFFu, 0xFFFEFAu, 0xF5F7FFu}) {
    tile_icon_source::set_tile_tint(card, white, 20);
    expect(tile_surface::get(card) == tile_surface::kNone && bg(card) == ui_theme::kLight.card && !rim(card),
           "white light: no fill", white, ui_theme::kLight.card);
  }
  tile_icon_source::set_tile_tint(card, amber, 20);
  tile_icon_source::set_tile_tint(card, 0xFFFEFAu, 20);
  expect(tile_surface::get(card) == tile_surface::kNone && bg(card) == ui_theme::kLight.card &&
         text(title) == ui_theme::kLight.text, "colored, then white: light again", bg(card), ui_theme::kLight.card);

  // Without the rule (an own color, the screensaver) a tinted tile stays.
  lv_obj_t* plain = lv_obj_create(lv_screen_active());
  tile_surface::set(plain, tile_surface::kNone);
  lv_obj_t* plain_title = label(plain, "Lamp", ui_theme::kLight.text);
  tile_icon_source::set_tile_tint(plain, amber, 20);
  expect(tile_surface::get(plain) == tile_surface::kNone && text(plain_title) == ui_theme::kLight.text && !rim(plain),
         "no rule: light");

  if (failures) return 1;
  std::printf("OK\n");
  return 0;
}
`;
const src = path.join(out, 'test.cpp');
const binary = path.join(out, process.platform === 'win32' ? 'test.exe' : 'test');
fs.writeFileSync(src, cpp);
let result = spawnSync(host.cxx, [...host.flags, '-std=c++17', '-DSCREEN_WIDTH=1280', '-DSCREEN_HEIGHT=800',
  '-DCELL_W=168', '-DCELL_H=145', '-DGAP=16', src, host.archive, '-o', binary], {encoding: 'utf8'});
assert.equal(result.status, 0, result.stdout + result.stderr);
result = spawnSync(binary, [], {encoding: 'utf8'});
assert.equal(result.status, 0, result.stdout + result.stderr);
console.log('Filled tiles: in and out with the tint (card, rim, texts, running update), popups by their opener.');
