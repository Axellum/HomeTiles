// The tile frame line (user 2026-10-11, like Tessera's theme::LINE and
// theme::outline): a solid line, on the theme's plain card a fixed neutral
// (light #DDDDDD, dark #292929), on any other card (filled, an own color)
// that card a little lighter when it is dark and a little darker when it is
// light. The Web Admin preview computes the same line.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');

const style = read('src/ui/shared/ui_surface_style.cpp');
const header = read('src/ui/shared/ui_surface_style.h');
const frame = style.slice(style.indexOf('lv_color_t frame_line(lv_obj_t* obj) {'), style.indexOf('void apply_style('));
for (const marker of [
  'const uint32_t plain = ui_theme::roles_of(ui_theme::kThemeSurface).card;',
  'if (card == plain) return lv_color_hex(ui_theme::theme_light() ? 0xDDDDDD : 0x292929);',
  'tone_color::from_rgb(card).L <= ui_theme::kLightSurfaceL ? lv_color_mix(lv_color_white(), lv_color_hex(card), 23)',
  ': lv_color_mix(lv_color_black(), lv_color_hex(card), 36);',
]) assert.ok(frame.includes(marker), 'frame_line: ' + marker);
assert.match(style, /const lv_color_t color = frame_line\(obj\);\s*const lv_opa_t opa = LV_OPA_COVER;/, 'A solid line');
assert.doesNotMatch(style + header, /border_hint|set_tile_border_tint|clear_tile_border_tint|kBorderTintStore|kTileBorderOpa/,
  'The old icon hint of the border is gone');
// A card that changes its color (a fill, a theme change) draws its line again.
assert.match(read('src/tiles/runtime/tile_icon_source.cpp'), /ui_surface_style::refresh_tile_border\(card\);/);

// Preview: the same thresholds, neutrals and mixes.
const preview = read('src/web/admin/tiles/grid-preview.js');
const fn = preview.slice(preview.indexOf('function applyFrameLine(el) {'), preview.indexOf('function applyTileSurface('));
assert.ok(fn.includes("const plain = panelThemeLight() ? [255, 255, 255] : [26, 26, 26];"));
assert.ok(fn.includes("line = panelThemeLight() ? [221, 221, 221] : [41, 41, 41];"));
assert.ok(fn.includes('toneOklch(card).L <= 0.72'));
assert.ok(fn.includes('Math.floor((255 * 23 + v * 232) * 0x8081 / 0x800000)'));
assert.ok(fn.includes('Math.floor((v * 219) * 0x8081 / 0x800000)'));
const theme = read('src/ui/shared/ui_theme.h');
assert.ok(theme.includes('inline constexpr float kLightSurfaceL = 0.72f;'), 'Same light threshold as the preview');
assert.match(theme, /kDark = \{0x000000, 0x1A1A1A,/, 'Dark plain card #1A1A1A like the preview');
assert.match(theme, /kLight = \{0xE9EBEE, 0xFFFFFF,/, 'Light plain card #FFFFFF like the preview');
// Both previews draw it after the surface is known.
assert.match(preview, /if \(typeValue !== '0'\) applyFrameLine\(el\);/);
assert.ok(read('src/web/admin/tiles/live-preview.js').includes('applyFrameLine(tileElem);'));
const css = read('src/web/assets/admin.css');
assert.ok(css.includes('outline:1px solid var(--tile-border-tint, rgba(var(--pv-text-rgb, 255,255,255),0.20));'));

// LVGL lv_color_mix == the preview's mix, for the white and the black side.
const mix = (c1, c2, m) => Math.floor(((c1 * m + c2 * (255 - m)) * 0x8081) / 0x800000);
for (const v of [0, 26, 67, 128, 200, 255]) {
  assert.equal(Math.floor((255 * 23 + v * 232) * 0x8081 / 0x800000), mix(255, v, 23));
  assert.equal(Math.floor((v * 219) * 0x8081 / 0x800000), mix(0, v, 36));
}

// The popup hairline stays the plain popup line, drawn once.
const shell = read('src/ui/popups/popup_shell.cpp');
assert.ok(shell.includes('ui_surface_style::apply_popup_border(shell.frame, lv_color_hex(ui_theme::text()),'), 'Popup hairline is fixed');
assert.ok(!shell.includes('ui_surface_style::apply_global_tile_border(parts.card);'), 'One popup hairline, not two');
console.log('Tile frame line: fixed neutral on plain cards, own card lighter/darker on filled cards, preview identical');
