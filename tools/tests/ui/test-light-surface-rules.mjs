// The light theme's color rules agreed in the color lab (user 2026-10-10,
// build/analysis/2026-10-09-analyse.md "Regel-Liste Hell"):
//   - the tile decides: a tile in its own color draws with the rules of the
//     theme its lightness belongs to (OKLCH L 0.72), in either theme;
//   - Media and Weather (and the selected Settings category) show the dark
//     design in the light theme: the dark card, 0.24 L lighter, no hairline;
//   - marks on a colored surface (power symbol, slider notches) are dark on a
//     light surface and white on a dark one;
//   - a white light shows Home Assistant's light grey (HSV value 225) as its
//     fill and power button; its popup header icon stays a mid grey below its
//     circle, also for pure white (it flashed to the icon grey before);
//   - the light theme's tile circle is the icon's color at 20 % over the card;
//   - unavailable is fainter than off in the light theme.
// Device (C++) and Web Admin preview (JS) compute the same values.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractDeliveredFunction} from '../../lib/admin-source.mjs';
import {lvglHost} from '../../lib/lvgl-host.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

// One place for the values (ui_theme.h).
const theme = read('src/ui/shared/ui_theme.h');
for (const marker of ['inline constexpr float kLightSurfaceL = 0.72f;', 'inline constexpr float kLightCircleShare = 0.8f;',
  'inline constexpr float kDarkDesignLift = 0.24f;',
  'inline bool light() { return g_surface >= 0 ? g_surface == 1 : theme_light(); }',
  'if (!(owner_ && saved_owner_ == owner_)) g_surface = saved_;'])
  assert.ok(theme.includes(marker), `ui_theme.h: ${marker}`);

// Every tile renders inside its surface; later color paths reopen it.
const renderer = read('src/tiles/runtime/tile_renderer.cpp');
assert.ok(renderer.includes('const ui_theme::SurfaceScope scope(tile_surface::theme_of(surface));') &&
  renderer.includes('tile_surface::set(tile_obj, surface);') &&
  renderer.includes('if (surface == tile_surface::kDarkDesign) tile_icon_source::apply_dark_design(tile_obj);'),
  'render_tile opens and marks the surface');
assert.ok(renderer.includes('if (tile.design == TILE_DESIGN_DARK || tile.type == TILE_WEATHER) return tile_surface::kDarkDesign;') &&
  renderer.includes('if (media_playing) return tile_surface::kDarkDesign;') &&
  renderer.includes('return tone_color::light_surface(own) ? tile_surface::kLight : tile_surface::kDark;'),
  'Weather, Media while playing and Design Dark: dark design; own colors: by their lightness');
assert.ok(renderer.includes('if (!tileBorderEnabled(tile) || dark_design) ui_surface_style::disable_tile_border(tile_obj);'),
  'the dark design has no hairline');
const disc = read('src/tiles/runtime/tile_icon_disc.h');
assert.ok(disc.includes('const ui_theme::SurfaceScope surface = tile_surface::scope(disc);'), 'circles follow the surface');
assert.ok(disc.includes('if (ui_theme::light() && !see_through_card) {') &&
  disc.includes('return tone_color::tile_fill(card, over, tinted, percent);'), 'the light theme tile circle');
const source = read('src/tiles/runtime/tile_icon_source.cpp');
assert.ok(source.includes('if (tile_surface::dark_design(tile_surface::get(card))) tint = tone_color::dark_design(tint);'),
  'tints of the dark design are lifted');
for (const [file, count] of [['src/tiles/runtime/tile_renderer.cpp', 5], ['src/types/binary_sensor/renderer.cpp', 1],
  ['src/types/cover/renderer.cpp', 1]]) {
  assert.equal((read(file).match(/State colors follow the tile's surface/g) || []).length, count, `${file}: update scopes`);
}
const settings = read('src/ui/tabs/settings/settings_screen.cpp');
assert.ok(settings.includes('return ui_theme::theme_light() && index == static_cast<uint8_t>(g_category) ? 0 : -1;') &&
  settings.includes('const uint32_t tile = tone_color::dark_design(dark);'), 'the selected Settings category: dark design');
const popup = read('src/ui/popups/light/light_popup.cpp');
assert.ok(popup.includes('ctx->brightness_draw_color = tone_color::light_accent(icon_rgb);'), 'white light fill');
assert.ok(read('src/ui/popups/popup_shell.cpp').includes(
  'lv_color_hex(ui_theme::light() && tone_color::no_color(rgb) ? tone_color::below_circle(fill.disc, rgb)'),
  'the header of a white light: below its circle, pure white too');
assert.ok(read('src/types/media/renderer.cpp').includes('if (primary) tile_icon_disc::mark_cutout(label);') &&
  source.includes('tile_icon_disc::refresh_cutouts(card);'), 'the play glyph follows the tinted card');
assert.ok(renderer.includes('if (!state.available) return ui_theme::icon_unavailable();'), 'unavailable lights fainter');

// The preview's functions, exactly as delivered.
const names = ['toneToLinear', 'toneToSrgb', 'toneOklch', 'toneLinear', 'toneRgb', 'toneBlend', 'toneHex', 'panelVar',
  'panelLight', 'panelRole', 'surfaceRoleTable', 'toneLightSurface', 'toneDarkDesign', 'toneNoColor', 'toneLightAccent', 'toneMarkOn'];
const js = new Function(names.map(extractDeliveredFunction).join('\n') +
  '; return {toneLightSurface, toneDarkDesign, toneLightAccent, toneMarkOn, toneBlend};')();
const light = run => { globalThis.hometilesPreviewSurface = 1; try { return run(); } finally { delete globalThis.hometilesPreviewSurface; } };
const dark = run => { globalThis.hometilesPreviewSurface = 0; try { return run(); } finally { delete globalThis.hometilesPreviewSurface; } };
const rgb = hex => [16, 8, 0].map(s => (hex >> s) & 255);
const hex = c => (c[0] << 16) | (c[1] << 8) | c[2];

const host = await lvglHost(root);
if (!host) { console.log('SKIP: light surface rules need a C++ compiler'); process.exit(0); }
const out = path.join(root, 'build/tests/light-surface-rules');
fs.mkdirSync(out, {recursive: true});
const surfaces = [0x43A047, 0xFFE082, 0x3D58A9, 0xFFFFFF, 0x1A1A1A, 0xF8BBD0];
const accents = [0xFFFFFF, 0xFFFEFA, 0xFFC107, 0x2196F3, 0x8B8B8B];
const cpp = `#include <cstdio>
#include "src/ui/shared/tone_color.h"
int main() {
  const unsigned surfaces[] = {${surfaces.map(v => v + 'u').join(', ')}};
  const unsigned accents[] = {${accents.map(v => v + 'u').join(', ')}};
  for (unsigned s : surfaces) std::printf("surface %u %d\\n", s, tone_color::light_surface(s) ? 1 : 0);
  std::printf("design %u\\n", tone_color::dark_design(0x1A1A1Au));
  ui_theme::set(1);
  for (unsigned a : accents) {
    std::printf("light %u %u %u\\n", a, tone_color::light_accent(a), tone_color::mark_on(tone_color::light_accent(a), 0xFFFFFFu));
  }
  {
    const ui_theme::SurfaceScope surface(0);
    for (unsigned a : accents) std::printf("dark %u %u %u\\n", a, tone_color::light_accent(a), tone_color::mark_on(a, 0x2A2A2Au));
  }
  std::printf("restored %d\\n", ui_theme::light() ? 1 : 0);
  const tone_color::Fill fill = tone_color::tile_fill(0xFFFFFFu, 0xFFC107u, true, 25);
  std::printf("tile %u %u %u\\n", fill.disc, fill.control, fill.raised);
  std::printf("below %u %u\\n", tone_color::below_circle(0xEFEEECu, 0xFFFFFFu), tone_color::below_circle(0xEFEEECu, 0xFFFEFAu));
  return 0;
}
`;
const file = path.join(out, 'test.cpp');
const binary = path.join(out, process.platform === 'win32' ? 'test.exe' : 'test');
fs.writeFileSync(file, cpp);
let result = spawnSync(host.cxx, ['-std=c++17', '-I', root, file, '-o', binary], {encoding: 'utf8'});
assert.equal(result.status, 0, result.stdout + result.stderr);
result = spawnSync(binary, [], {encoding: 'utf8'});
assert.equal(result.status, 0, result.stderr);
const near = (a, b) => rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= 1);
const lines = result.stdout.trim().split(/\r?\n/).map(line => line.split(' '));
for (const [kind, ...values] of lines) {
  const n = values.map(Number);
  if (kind === 'surface') {
    assert.equal(n[1] === 1, js.toneLightSurface(rgb(n[0])), `surface #${n[0].toString(16)}`);
  } else if (kind === 'design') {
    assert.ok(near(n[0], hex(js.toneDarkDesign([26, 26, 26]))), 'dark design of #1A1A1A');
    assert.ok(near(n[0], 0x575757), `dark design #${n[0].toString(16)}`);
  } else if (kind === 'light') {
    light(() => {
      assert.ok(near(n[1], hex(js.toneLightAccent(rgb(n[0])))), `light accent #${n[0].toString(16)}`);
      assert.ok(near(n[2], hex(js.toneMarkOn(js.toneLightAccent(rgb(n[0])), [255, 255, 255]))), `light mark #${n[0].toString(16)}`);
    });
  } else if (kind === 'dark') {
    dark(() => {
      assert.ok(near(n[1], hex(js.toneLightAccent(rgb(n[0])))), `dark accent #${n[0].toString(16)}`);
      assert.ok(near(n[2], hex(js.toneMarkOn(rgb(n[0]), [42, 42, 42]))), `dark mark #${n[0].toString(16)}`);
    });
  }
}
const value = kind => lines.find(line => line[0] === kind).slice(1).map(Number);
// White and almost white become HA's light grey; colors stay.
const lightRows = lines.filter(line => line[0] === 'light').map(line => line.slice(1).map(Number));
assert.equal(lightRows[0][1], 0xE1E1E1);
assert.equal(lightRows[1][1], 0xE1E0DD);
assert.equal(lightRows[2][1], 0xFFC107);
// Marks: dark on light grey and amber, white on blue and mid grey (the light
// theme; #8B8B8B lies below the light surface limit).
assert.deepEqual(lightRows.map(row => row[2]), [0x1A1A1A, 0x1A1A1A, 0x1A1A1A, 0xFFFFFF, 0xFFFFFF]);
// The dark theme keeps its cut-out on light accents and colors.
const darkRows = lines.filter(line => line[0] === 'dark').map(line => line.slice(1).map(Number));
assert.deepEqual(darkRows.map(row => row[1]), accents, 'no light accent in the dark theme');
assert.deepEqual(darkRows.map(row => row[2]), [0x2A2A2A, 0x2A2A2A, 0x2A2A2A, 0xFFFFFF, 0xFFFFFF]);
assert.equal(value('restored')[0], 1, 'the surface scope closes again');
// The light tile circle: 20 % amber over white, controls the same, raised twice.
const [tileDisc, tileControl, tileRaised] = value('tile');
assert.ok(near(tileDisc, hex(js.toneBlend([255, 255, 255], [255, 193, 7], 51))), `tile circle #${tileDisc.toString(16)}`);
assert.equal(tileControl, tileDisc);
assert.ok(near(tileRaised, hex(js.toneBlend([255, 255, 255], [255, 193, 7], 102))));
// The header of a white light: the same mid grey for pure and almost white.
const [pure, almost] = value('below');
assert.ok(Math.abs(rgb(pure)[0] - rgb(almost)[0]) <= 3 && rgb(pure)[0] < 0xC0 && rgb(pure)[0] > 0x90,
  `mid grey #${pure.toString(16)} / #${almost.toString(16)}`);

// The preview marks the surface and draws it like the device.
const grid = read('src/web/admin/tiles/grid-preview.js');
assert.ok(grid.includes("if (chosen === '2' || previewKind === 'weather') return 'darkdesign';") &&
  grid.includes("if (previewKind === 'media' && playing) return 'darkdesign';") &&
  grid.includes("if (table) el.style.setProperty('--pv-' + name, 'var(--pv' + table + '-' + name + ')');"),
  'preview surfaces');
assert.ok(read('src/web/admin/tiles/icon-colors.js').includes(
  "if ((surface === 'darkdesign' || surface === 'darktint') && typeof toneDarkDesign === 'function') {"),
  'preview tints of the dark design');
assert.ok(read('src/web/assets/admin.css').includes('color:var(--tile-cut, var(--tile-card, #1A1A1A)); }'), 'preview play cut-out');
console.log('Light surface rules: tile surfaces, dark design, marks, white light accent, tile circle, device == preview');
