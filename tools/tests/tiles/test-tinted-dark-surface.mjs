// The global option "Tinted tiles dark" and Media while it plays (user
// 2026-10-10): in the light theme a tile with tile color "From icon" shows the
// dark design while it is tinted and turns light again when it is off; a
// Media tile shows it while its player plays. The card changes its surface in
// place (tile_icon_source::change_surface): card color, role-colored texts
// and icons, and the rest of the running state update (ui_theme
// follow_surface). Runs the production code on real LVGL objects.
import {radiusPolicyHost, surfaceStyleHost} from '../../lib/surface-style-host.mjs';
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
// The renderer gives a tile its rule (tile_renderer.cpp tile_surface_rule_of).
const renderer = read('src/tiles/runtime/tile_renderer.cpp');
assert.ok(renderer.includes('if (configManager.getConfig().dark_tinted) flags |= tile_surface::kFollowTint;') &&
  renderer.includes('tile_surface::set_rule(tile_obj, tile_surface::kNone, rule);') &&
  renderer.includes('const bool dark_design = tile_surface::dark_design(tile_surface::get(tile_obj));'),
  'render_tile sets the rule before the first tint and reads the surface after it');
assert.ok(renderer.includes('if (state.length()) media_follow_playback(grid_type, grid_index, widgets, state.equalsIgnoreCase("playing"));'),
  'Media follows its player');
// The global option: stored, saved by its own endpoint, a checkbox in the
// global settings in four languages, mirrored by the preview.
const config = read('src/core/config/config_manager.cpp');
assert.ok(config.includes('config.dark_tinted = prefs.getBool("dark_tint", false);') &&
  config.includes('prefs.putBool("dark_tint", normalized.dark_tinted);') && config.includes('a.dark_tinted == b.dark_tinted &&'));
assert.ok(read('src/web/server/web_admin.cpp').includes('server.on("/api/display/dark-tinted", HTTP_POST,'));
const handlers = read('src/web/server/handlers/web_admin_handlers.cpp');
assert.match(handlers, /void WebAdminServer::handleSaveDarkTinted\(\) \{[\s\S]*?configManager\.saveDarkTinted\(enabled\)[\s\S]*?tiles_request_reload_all\(\);/);
const html = read('src/web/server/render/web_admin_html.cpp');
assert.ok(html.includes('onchange=\\"saveDarkTinted(this.checked)\\"') && html.includes('appendHtmlEscaped(global_panel, tr.dark_tinted_tiles);') &&
  html.includes('if (configManager.getConfig().dark_tinted) html += "\\" data-dark-tinted=\\"1";'));
const i18n = read('src/core/i18n/i18n.cpp');
for (const text of ['"Getönte Kacheln dunkel",', '"Tinted tiles dark",', '"Tuiles teintées sombres",', '"Ciemne zabarwione kafelki",']) {
  assert.ok(i18n.includes(text), text);
}
const borders = read('src/web/admin/settings/display-borders.js');
assert.ok(borders.includes("const response = await fetch('/api/display/dark-tinted', {") &&
  borders.includes("if (typeof currentTileTab === 'string' && currentTileTab) updateTilePreview(currentTileTab);"));
const colors = read('src/web/admin/tiles/icon-colors.js');
assert.ok(colors.includes("if (el?.dataset?.followTint === '1' && el.dataset.surface !== 'darktint' && typeof applyTileSurface === 'function') {"),
  'preview: the tint enters the dark design');
assert.ok(read('src/web/admin/tiles/grid-preview.js').includes(
  "if (tileElem.dataset.followTint === '1' && tileElem.dataset.surface === 'darktint') applyTileSurface(tileElem, '');"),
  'preview: off leaves it');
assert.ok(read('src/web/assets/admin.css').includes(':not([data-surface="darkdesign"]):not([data-surface="darktint"])'),
  'preview: the dark design has no hairline, like the device');
// Popups of a tile on the other theme's surface (dark design, own dark color)
// keep the theme's neutral card (user 2026-10-10: dark on dark).
assert.ok(source.includes('if (surface >= 0 && (surface == 1) != ui_theme::theme_light()) return ui_theme::popup_card();'),
  'popups keep the neutral card');
// The Weather preview days take the text role through CSS: a live edit (the
// strength slider) drew them outside the tile's surface and they turned black.
assert.ok(read('src/types/weather/admin.js').includes("'color:' + (slot || !state ? 'var(--pv-text, #FFFFFF)' : '#7F8BAA')"),
  'weather preview days follow the surface');

const host = await lvglHost(root);
if (!host) {
  console.log('SKIP: tinted dark surface needs LVGL and a host compiler');
  process.exit(0);
}
const out = path.join(root, 'build/tests/tinted-dark-surface');
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
constexpr int GRID_CELL_H=CELL_H,GRID_GAP=GAP;
#include "src/types/climate/layout.h"
${read('src/tiles/runtime/tile_icon_disc.h').replace(/^#.*$/gm, '')}
#include "src/tiles/config/tile_tint.h"
// The default card of the surface (tile_config.cpp tileDefaultBgColor).
static uint32_t tileDefaultBgColor() { return ui_theme::light() ? ui_theme::card() : 0x1A1A1A; }
struct Tile {};
static uint32_t tileBgColorOrDefault(const Tile&, uint32_t fallback) { return fallback; }
static int g_refreshed = 0;
namespace tile_icon_source {
${tintStore}
void change_surface(lv_obj_t* card, uint8_t surface, const Tile* tile = nullptr);
void refresh_card(lv_obj_t*, const Tile&) { ++g_refreshed; }
void refresh_controls(lv_obj_t*) { ++g_refreshed; }
${fn('apply_card_background')}
${fn('set_card_base')}
${fn('follow_tint')}
${fn('set_tile_tint')}
${fn('clear_tile_tint')}
${fn('icon_glyph')}
${fn('recolor_roles')}
${fn('change_surface')}
${fn('set_playing')}
}
static uint32_t rgb(lv_color_t c) { return lv_color_to_u32(c) & 0xFFFFFF; }
static uint32_t text(lv_obj_t* obj) { return rgb(lv_obj_get_style_text_color(obj, LV_PART_MAIN)); }
static uint32_t bg(lv_obj_t* obj) { return rgb(lv_obj_get_style_bg_color(obj, LV_PART_MAIN)); }
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

  // A light tile with tile color "From icon" and the global option.
  lv_obj_t* card = lv_obj_create(lv_screen_active());
  lv_obj_remove_style_all(card);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
  tile_icon_source::apply_card_background(card, ui_theme::kLight.card);
  tile_surface::set(card, tile_surface::kNone);
  tile_surface::set_rule(card, tile_surface::kNone, tile_surface::kFollowTint);
  lv_obj_t* row = lv_obj_create(card);
  lv_obj_t* title = label(row, "Desk", ui_theme::kLight.text);
  lv_obj_t* glyph = label(card, "\xF3\xB0\x8C\xB5", ui_theme::kLight.icon);
  lv_obj_t* note = label(row, "Artist", ui_theme::kLight.text_secondary);
  lv_obj_t* entity = label(row, "On", amber);

  // A state update turns the light on: its scope opened light, the tint moves
  // the card into the dark design and the update draws on with it.
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
    expect(ui_theme::text() == 0xFFFFFF, "after a nested scope", ui_theme::text(), 0xFFFFFF);
    expect(ui_theme::icon_off() == ui_theme::kLight.icon_off, "tinted dark keeps the light off grey",
           ui_theme::icon_off(), ui_theme::kLight.icon_off);
  }
  expect(during == 0xFFFFFF, "the rest of the update draws dark", during, 0xFFFFFF);
  expect(ui_theme::g_surface == -1 && ui_theme::g_surface_owner == nullptr, "scopes close");
  expect(tile_surface::get(card) == tile_surface::kTintDark, "tinted: dark design", tile_surface::get(card), tile_surface::kTintDark);
  uint32_t tint = 0;
  {
    const ui_theme::SurfaceScope dark(ui_theme::kDarkTintedSurface);
    tint = tone_color::dark_design(tile_tint::background(tileDefaultBgColor(), amber, 20));
  }
  expect(bg(card) == tint, "dark design tint", bg(card), tint);
  expect(text(title) == 0xFFFFFF, "title white", text(title), 0xFFFFFF);
  expect(text(glyph) == 0xFFFFFF, "icon white", text(glyph), 0xFFFFFF);
  expect(text(note) == ui_theme::kDark.text_secondary, "secondary", text(note), ui_theme::kDark.text_secondary);
  expect(text(entity) == amber, "entity color stays", text(entity), amber);

  // Off: the grey untints the card, it is light again.
  tile_icon_source::clear_tile_tint(card);
  expect(tile_surface::get(card) == tile_surface::kNone, "off: light", tile_surface::get(card), tile_surface::kNone);
  expect(bg(card) == ui_theme::kLight.card, "light card", bg(card), ui_theme::kLight.card);
  expect(text(title) == ui_theme::kLight.text, "title dark", text(title), ui_theme::kLight.text);
  expect(text(glyph) == ui_theme::kLight.icon, "icon grey", text(glyph), ui_theme::kLight.icon);
  expect(text(note) == ui_theme::kLight.text_secondary, "secondary back", text(note), ui_theme::kLight.text_secondary);

  // Without the option a tinted tile stays light.
  lv_obj_t* plain = lv_obj_create(lv_screen_active());
  tile_surface::set(plain, tile_surface::kNone);
  lv_obj_t* plain_title = label(plain, "Lamp", ui_theme::kLight.text);
  tile_icon_source::set_tile_tint(plain, amber, 20);
  expect(tile_surface::get(plain) == tile_surface::kNone && text(plain_title) == ui_theme::kLight.text, "no rule: light");

  // Media: the dark design while playing, light when it stops.
  lv_obj_t* media = lv_obj_create(lv_screen_active());
  lv_obj_remove_style_all(media);
  tile_icon_source::apply_card_background(media, ui_theme::kLight.card);
  tile_surface::set(media, tile_surface::kNone);
  tile_surface::set_rule(media, tile_surface::kNone, tile_surface::kMedia);
  lv_obj_t* song = label(media, "Song", ui_theme::kLight.text);
  const Tile tile;
  tile_icon_source::set_playing(media, true, tile);
  uint32_t design = 0;
  {
    const ui_theme::SurfaceScope dark(0);
    design = tone_color::dark_design(tileDefaultBgColor());
  }
  expect(tile_surface::get(media) == tile_surface::kDarkDesign && text(song) == 0xFFFFFF, "playing: dark design");
  expect(bg(media) == design, "playing card", bg(media), design);
  expect(g_refreshed == 2, "playing refreshes tint and controls", g_refreshed, 2);
  tile_icon_source::set_playing(media, false, tile);
  expect(tile_surface::get(media) == tile_surface::kNone && text(song) == ui_theme::kLight.text &&
         bg(media) == ui_theme::kLight.card, "stopped: light");

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
console.log('Tinted tiles dark: in and out of the dark design with the tint, texts and the running update follow; Media while playing.');
