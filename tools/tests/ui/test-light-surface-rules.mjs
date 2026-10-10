// The light theme's color rules agreed in the color lab (user 2026-10-10,
// build/analysis/2026-10-09-analyse.md "BESCHLUSS Hell = Dunkel-Rezept"):
//   - a tile in its own color draws with the rules of the theme its lightness
//     belongs to (OKLCH L 0.72), in either theme;
//   - a tinted tile (and the selected Settings category) is filled: the card
//     kJewelBelowIcon below its icon's own lightness (at most kJewelCardMaxL)
//     in its hue, the circle one step above the card, a 1 px rim a step
//     lighter, the icon in its own color, white text;
//   - marks on a colored surface (power symbol, slider notches) are dark on a
//     light surface and white on a dark one;
//   - a light shows its color as Home Assistant does (saturation at least
//     0.4, white a grey of value 225); its popup header icon is exactly that
//     color, white light the icon grey;
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
  'inline bool light() { return g_surface >= 0 ? g_surface == 1 : theme_light(); }',
  'if (!(owner_ && saved_owner_ == owner_)) g_surface = saved_;'])
  assert.ok(theme.includes(marker), `ui_theme.h: ${marker}`);
// The preview's fallbacks are the device's values; the page passes them too.
const jewel = {below: 'kJewelBelowIcon', max: 'kJewelCardMaxL', chroma: 'kJewelChroma', 'card-share': 'kJewelCardChromaShare',
  step: 'kJewelCircleStep', 'circle-share': 'kJewelCircleChromaShare', 'circle-cap': 'kJewelCircleChromaCap',
  rim: 'kJewelRimStep', 'rim-chroma': 'kJewelRimChroma'};
const grid = read('src/web/admin/tiles/grid-preview.js');
const styles = read('src/web/server/render/web_admin_styles.cpp');
for (const [name, constant] of Object.entries(jewel)) {
  const device = Number(theme.match(new RegExp(`inline constexpr float ${constant} = ([0-9.]+)f;`))?.[1]);
  assert.ok(Number.isFinite(device), constant);
  const fallbacks = [...grid.matchAll(new RegExp(`jewelVar\\('${name}', ([0-9.]+)\\)`, 'g'))].map(m => Number(m[1]));
  assert.ok(fallbacks.length && fallbacks.every(v => v === device), `preview --pv-jewel-${name} = ${constant}`);
  assert.ok(styles.includes(`--pv-jewel-${name}:%.3f;`) && styles.includes(`ui_theme::${constant})`), `emitted ${constant}`);
}

// Every tile renders inside its surface; later color paths reopen it.
const renderer = read('src/tiles/runtime/tile_renderer.cpp');
assert.ok(renderer.includes('const ui_theme::SurfaceScope scope(surface_theme >= 0 ? surface_theme : ui_theme::kThemeSurface);') &&
  renderer.includes('tile_surface::set(tile_obj, surface);') &&
  renderer.includes('return tone_color::light_surface(own) ? tile_surface::kLight : tile_surface::kDark;'),
  'render_tile opens and marks the surface; own colors by their lightness');
assert.doesNotMatch(renderer, /kDarkDesign|dark_design|media_follow_playback/, 'no dark design any more');
const disc = read('src/tiles/runtime/tile_icon_disc.h');
assert.ok(disc.includes('const ui_theme::SurfaceScope surface = tile_surface::scope(disc);'), 'circles follow the surface');
assert.ok(disc.includes('return tone_color::jewel_fill(card, rgb, percent, tile_surface::strength(host));') &&
  disc.includes('if (ui_theme::light() && !see_through_card) {') &&
  disc.includes('return tone_color::tile_fill(card, over, tinted, percent);'), 'the filled circle and the light tile circle');
const source = read('src/tiles/runtime/tile_icon_source.cpp');
assert.ok(source.includes('tint = tone_color::jewel_card(color, percent);') &&
  source.includes('ui_surface_style::set_tile_border_rim(card, lv_color_hex(tone_color::jewel_rim(tint, color)));'),
  'a filled tile: card and rim from its icon');
for (const [file, count] of [['src/tiles/runtime/tile_renderer.cpp', 5], ['src/types/binary_sensor/renderer.cpp', 1],
  ['src/types/cover/renderer.cpp', 1]]) {
  assert.equal((read(file).match(/State colors follow the tile's surface/g) || []).length, count, `${file}: update scopes`);
}
const settings = read('src/ui/tabs/settings/settings_screen.cpp');
assert.ok(settings.includes('return ui_theme::theme_light() && index == static_cast<uint8_t>(g_category) ? ui_theme::kDarkTintedSurface : -1;') &&
  settings.includes('const uint32_t tile = tone_color::jewel_card(color, 0);'), 'the selected Settings category is filled');
const popup = read('src/ui/popups/light/light_popup.cpp');
assert.ok(popup.includes('ctx->brightness_draw_color = tone_color::light_accent(icon_rgb);'), 'light fill');
assert.ok(popup.includes('return ctx->available && ctx->is_on ? tone_color::light_icon(rgb) : rgb;'), 'light header icon');
const shell = read('src/ui/popups/popup_shell.cpp');
assert.ok(shell.includes('const lv_color_t readable = lv_color_hex(tone_color::readable_icon(rgb));') && !shell.includes('below_circle'),
  'the header shows the icon its popup gives');
assert.ok(read('src/types/media/renderer.cpp').includes('if (primary) tile_icon_disc::mark_cutout(label);') &&
  source.includes('tile_icon_disc::refresh_cutouts(card);'), 'the play glyph follows the tinted card');
assert.ok(renderer.includes('if (!state.available) return ui_theme::icon_unavailable();'), 'unavailable lights fainter');

// The preview's functions, exactly as delivered.
const names = ['toneToLinear', 'toneToSrgb', 'toneOklch', 'toneLinear', 'toneRgb', 'toneBlend', 'toneHex', 'panelVar',
  'panelLight', 'panelRole', 'surfaceRoleTable', 'toneLightSurface', 'toneLightAccent', 'toneMarkOn',
  'jewelVar', 'toneJewelCard', 'toneJewelFill', 'toneJewelRim'];
const js = new Function(names.map(extractDeliveredFunction).join('\n') +
  '; return {toneOklch, toneLightSurface, toneLightAccent, toneMarkOn, toneBlend, toneJewelCard, toneJewelFill, toneJewelRim};')();
const light = run => { globalThis.hometilesPreviewSurface = 1; try { return run(); } finally { delete globalThis.hometilesPreviewSurface; } };
const dark = run => { globalThis.hometilesPreviewSurface = 0; try { return run(); } finally { delete globalThis.hometilesPreviewSurface; } };
const rgb = hex => [16, 8, 0].map(s => (hex >> s) & 255);
const hex = c => (c[0] << 16) | (c[1] << 8) | c[2];

const host = await lvglHost(root);
if (!host) { console.log('SKIP: light surface rules need a C++ compiler'); process.exit(0); }
const out = path.join(root, 'build/tests/light-surface-rules');
fs.mkdirSync(out, {recursive: true});
const surfaces = [0x43A047, 0xFFE082, 0x3D58A9, 0xFFFFFF, 0x1A1A1A, 0xF8BBD0];
const accents = [0xFFFFFF, 0xFFFEFA, 0xFFC107, 0x2196F3, 0x8B8B8B, 0xFFE0C0, 0xC0D0FF];
const icons = [0xFFC107, 0x2196F3, 0x43A047, 0xE53935, 0x9C27B0, 0xFFE082, 0xFF9800];
const strengths = [0, 20, 30];
const cpp = `#include <cstdio>
#include "src/ui/shared/tone_color.h"
int main() {
  const unsigned surfaces[] = {${surfaces.map(v => v + 'u').join(', ')}};
  const unsigned accents[] = {${accents.map(v => v + 'u').join(', ')}};
  const unsigned icons[] = {${icons.map(v => v + 'u').join(', ')}};
  const unsigned strengths[] = {${strengths.map(v => v + 'u').join(', ')}};
  for (unsigned s : surfaces) std::printf("surface %u %d\\n", s, tone_color::light_surface(s) ? 1 : 0);
  ui_theme::set(1);
  std::printf("grey %u\\n", ui_theme::icon());
  for (unsigned a : accents) {
    std::printf("light %u %u %u %u\\n", a, tone_color::light_accent(a), tone_color::mark_on(tone_color::light_accent(a), 0xFFFFFFu),
                tone_color::light_icon(a));
  }
  {
    const ui_theme::SurfaceScope surface(0);
    for (unsigned a : accents) {
      std::printf("dark %u %u %u %u\\n", a, tone_color::light_accent(a), tone_color::mark_on(a, 0x2A2A2Au), tone_color::light_icon(a));
    }
  }
  std::printf("restored %d\\n", ui_theme::light() ? 1 : 0);
  const tone_color::Fill fill = tone_color::tile_fill(0xFFFFFFu, 0xFFC107u, true, 25);
  std::printf("tile %u %u %u\\n", fill.disc, fill.control, fill.raised);
  for (unsigned icon : icons) {
    for (unsigned strength : strengths) {
      const unsigned card = tone_color::jewel_card(icon, strength);
      const tone_color::Fill circle = tone_color::jewel_fill(card, icon, 25, strength);
      std::printf("jewel %u %u %u %u %u %u %u\\n", icon, strength, card, circle.disc, circle.control, circle.raised,
                  tone_color::jewel_rim(card, icon));
    }
    const ui_theme::SurfaceScope filled(ui_theme::kDarkTintedSurface);
    std::printf("icon %u %u\\n", icon, tone_color::readable_icon(icon));
  }
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
const rows = kind => lines.filter(line => line[0] === kind).map(line => line.slice(1).map(Number));
const value = kind => rows(kind)[0];
for (const [s, isLight] of rows('surface')) {
  assert.equal(isLight === 1, js.toneLightSurface(rgb(s)), `surface #${s.toString(16)}`);
}
for (const [a, accent, mark] of rows('light')) {
  light(() => {
    assert.ok(near(accent, hex(js.toneLightAccent(rgb(a)))), `light accent #${a.toString(16)}`);
    assert.ok(near(mark, hex(js.toneMarkOn(js.toneLightAccent(rgb(a)), [255, 255, 255]))), `light mark #${a.toString(16)}`);
  });
}
for (const [a, accent, mark] of rows('dark')) {
  dark(() => {
    assert.ok(near(accent, hex(js.toneLightAccent(rgb(a)))), `dark accent #${a.toString(16)}`);
    assert.ok(near(mark, hex(js.toneMarkOn(rgb(a), [42, 42, 42]))), `dark mark #${a.toString(16)}`);
  });
}
// Home Assistant's rule: white and almost white a grey of value 225, a pale
// color raised to saturation 0.4, colors stay.
const lightRows = rows('light');
const hsv = c => { const m = Math.max(...rgb(c)); return {v: m, s: m ? (m - Math.min(...rgb(c))) / m : 0}; };
assert.equal(lightRows[0][1], 0xE1E1E1);
assert.ok(hsv(lightRows[1][1]).v === 225 && hsv(lightRows[1][1]).s < 0.1, 'almost white: grey of value 225');
assert.equal(lightRows[2][1], 0xFFC107);
assert.equal(lightRows[3][1], 0x2196F3);
for (const row of lightRows.slice(5)) {
  assert.ok(Math.abs(hsv(row[1]).s - 0.4) < 0.01 && hsv(row[1]).v === 255, `pale #${row[0].toString(16)} at saturation 0.4`);
}
// The popup header icon: exactly the accent, white light the icon grey.
const grey = value('grey')[0];
assert.equal(lightRows[0][3], grey, 'white light: the icon grey');
assert.equal(lightRows[1][3], grey, 'almost white: the icon grey');
for (const row of lightRows.slice(2)) {
  if (hsv(row[0]).s >= 0.1) assert.equal(row[3], row[1], `icon = accent #${row[0].toString(16)}`);
}
// The dark theme keeps its cut-out on light accents and colors, no accent.
const darkRows = rows('dark');
assert.deepEqual(darkRows.map(row => row[1]), accents, 'no light accent in the dark theme');
assert.deepEqual(darkRows.map(row => row[3]), accents, 'no light icon in the dark theme');
assert.equal(value('restored')[0], 1, 'the surface scope closes again');
// The light tile circle: 20 % amber over white, controls the same, raised twice.
const [tileDisc, tileControl, tileRaised] = value('tile');
assert.ok(near(tileDisc, hex(js.toneBlend([255, 255, 255], [255, 193, 7], 51))), `tile circle #${tileDisc.toString(16)}`);
assert.equal(tileControl, tileDisc);
assert.ok(near(tileRaised, hex(js.toneBlend([255, 255, 255], [255, 193, 7], 102))));
// Filled tiles: device == preview; the card below its icon (at most 0.70),
// the circle above the card, the rim above that, all in the icon's hue.
for (const [icon, strength, card, circle, control, raised, rim] of rows('jewel')) {
  const what = `#${icon.toString(16)} at ${strength}`;
  const previewCard = js.toneJewelCard(rgb(icon), strength);
  assert.ok(near(card, hex(previewCard)), `card ${what}`);
  const previewFill = js.toneJewelFill(rgb(card), rgb(icon), 25, strength);
  assert.ok(near(circle, hex(previewFill.disc)) && near(control, hex(previewFill.control)), `circle ${what}`);
  assert.ok(near(rim, hex(js.toneJewelRim(rgb(card), rgb(icon)))), `rim ${what}`);
  const L = c => js.toneOklch(rgb(c)).L;
  assert.ok(L(card) <= 0.705 && L(card) <= L(icon) - 0.15, `card below its icon ${what}`);
  assert.ok(L(circle) > L(card) + 0.03 && L(raised) > L(control), `circle above the card ${what}`);
  assert.ok(L(rim) > L(card) + 0.1, `rim lighter ${what}`);
}
// A stronger tint is more colorful; strength 0 is the default (Settings).
const chroma = (icon, s) => js.toneOklch(rgb(rows('jewel').find(r => r[0] === icon && r[1] === s)[2])).C;
assert.ok(chroma(0x2196F3, 30) > chroma(0x2196F3, 20), 'strength raises the chroma');
assert.equal(rows('jewel').find(r => r[0] === 0x2196F3 && r[1] === 0)[2], rows('jewel').find(r => r[0] === 0x2196F3 && r[1] === 20)[2]);
// The icon keeps its own color on a filled tile.
for (const [icon, shown] of rows('icon')) assert.equal(shown, icon, `icon #${icon.toString(16)} unchanged`);

// The preview marks the surface and draws it like the device.
assert.ok(grid.includes("if (surface === 'jewel') return 2;") &&
  grid.includes("if (tileElem.dataset.followTint === '1' && tileElem.dataset.surface === 'jewel') applyTileSurface(tileElem, '');") &&
  grid.includes("if (table) el.style.setProperty('--pv-' + name, 'var(--pv' + table + '-' + name + ')');"),
  'preview surfaces');
assert.ok(read('src/web/admin/tiles/icon-colors.js').includes("if (surface === 'jewel' && typeof toneJewelCard === 'function') {"),
  'preview fills a tinted tile');
assert.doesNotMatch(grid, /darkdesign|darktint|toneDarkDesign/, 'no dark design in the preview');
assert.ok(read('src/web/assets/admin.css').includes('color:var(--tile-cut, var(--tile-card, #1A1A1A)); }'), 'preview play cut-out');
console.log('Light surface rules: tile surfaces, filled tiles, marks, Home Assistant light colors, tile circle, device == preview');
