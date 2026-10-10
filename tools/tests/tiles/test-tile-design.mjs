// A tile's own Design in the light theme (user 2026-10-10: "wo ist die neue
// Option Design von dunkler Thema für hell"): Automatic, Light or Dark. It is
// stored without changing PackedTileV7 (top bits of the popup mode byte),
// goes through GET/POST, drafts, copy/paste and import/export, and the device
// and the preview pick the same surface from it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractDeliveredFunction} from '../../lib/admin-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

// Tile field, equality and the V7 byte.
const header = read('src/tiles/config/tile_config.h');
assert.ok(header.includes('  uint8_t design = 0;') && header.includes('a.design == b.design') &&
  header.includes('TILE_DESIGN_AUTO = 0,') && header.includes('TILE_DESIGN_LIGHT = 1,') && header.includes('TILE_DESIGN_DARK = 2'));
const config = read('src/tiles/config/tile_config.cpp');
assert.ok(config.includes('static constexpr uint8_t kDesignShift = 6;') && config.includes('static constexpr uint8_t kPopupModeMask = 0x3Fu;'));
assert.ok(config.includes('out.popup_open_mode = static_cast<uint8_t>(out.popup_open_mode | (normalizeTileDesign(in.design) << kDesignShift));'),
  'pack: the Design beside the popup mode');
assert.ok(config.includes('(in.popup_open_mode & kPopupModeMask) == TILE_POPUP_OPEN_SHORT_PRESS') &&
  config.includes('out.design = out.type == TILE_EMPTY ? TILE_DESIGN_AUTO : normalizeTileDesign(in.popup_open_mode >> kDesignShift);'),
  'unpack: popup mode and Design apart');
// The byte keeps both: a short-press tile with Design Dark.
const packed = (1 | (2 << 6)) & 0xFF;
assert.equal(packed & 0x3F, 1);
assert.equal(packed >> 6, 2);

// HTTP: GET exports it, partial POSTs keep it.
const tiles = read('src/web/server/handlers/web_admin_tiles.cpp');
assert.ok(tiles.includes('out += ",\\"design\\":";') &&
  tiles.includes('if (server.hasArg("design")) tile.design = normalizeTileDesign(server.arg("design").toInt());'));

// Editor: Automatic, Light, Dark like the tile color choice; drafts, copy,
// paste, import and export carry it.
const html = read('src/web/server/render/web_admin_html.cpp');
assert.ok(html.includes('_tile_design_row') && html.includes('_tile_design_modes') && html.includes('_tile_design\\" value=\\"0\\"') &&
  html.includes('{{"0", tr.theme_auto}, {"1", tr.theme_light}, {"2", tr.theme_dark}}') &&
  html.includes("onclick=\\\"setTileDesign('"), 'the Design field');
const snapshots = read('src/web/admin/tiles/snapshots.js');
assert.ok(snapshots.includes("if (typeValue !== '0') out.design = typeof tileDesignValue === 'function' ? tileDesignValue(prefix) : '0';") &&
  snapshots.includes("if (design) design.value = ['0', '1', '2'].includes(String(data?.design)) ? String(data.design) : '0';") &&
  snapshots.includes("'icon_disc', 'icon_glow', 'design'];"), 'drafts and copy/paste');
assert.ok(read('src/web/admin/tiles/import-export.js').includes("fd.append('design', ['1', '2'].includes(String(tile.design)) ? String(tile.design) : '0');"));
const grid = read('src/web/admin/tiles/grid-preview.js');
assert.match(grid, /function setTileDesign\(tab, value\) \{[\s\S]*?updateTilePreview\(tab\);\s*updateDraft\(tab\);\s*scheduleAutoSave\(tab\);/,
  'a choice updates the preview, the draft and saves');

// Device: the surface (tile_renderer.cpp).
const renderer = read('src/tiles/runtime/tile_renderer.cpp');
const surfaceOf = renderer.slice(renderer.indexOf('static uint8_t tile_surface_of(const Tile& tile, GridType grid_type, int8_t media_playing) {'),
  renderer.indexOf('static uint8_t tile_surface_rule_of('));
for (const step of ['if (tile_has_own_color(tile)) {',
  'if (!ui_theme::theme_light() || tile.design == TILE_DESIGN_LIGHT) return tile_surface::kNone;',
  'if (tile.design == TILE_DESIGN_DARK || tile.type == TILE_WEATHER) return tile_surface::kDarkDesign;',
  'if (media_playing) return tile_surface::kDarkDesign;']) {
  assert.ok(surfaceOf.includes(step), 'tile_surface_of: ' + step);
}
assert.ok(surfaceOf.indexOf('tile_has_own_color') < surfaceOf.indexOf('TILE_DESIGN_LIGHT'), 'an own color comes first');

// Preview: the same choice, run as delivered.
const names = ['isDefaultTileGrey', 'tileBgFollowsDefault', 'tileBgValueIsSet', 'toneToLinear', 'toneOklch', 'toneLightSurface',
  'tileHasOwnColor', 'tileSurfaceOf', 'tileFollowsTint'];
const page = {theme: 'light', darkTinted: '1', screensaver: false};
globalThis.document = {documentElement: {dataset: {}}};
const preview = new Function('page', `
  const panelVar = (name, fallback) => fallback;
  const panelThemeLight = () => page.theme === 'light';
  const isScreensaverTileTab = () => page.screensaver;
  const parseIconColorRecord = record => ({fill: /\\nfill (\\d+)/.exec(record || '')?.[1] || 0});
  ${names.map(extractDeliveredFunction).join('\n')}
  return {tileSurfaceOf, tileFollowsTint};`)(page);
const sync = () => {
  document.documentElement.dataset = {panelTheme: page.theme};
  if (page.darkTinted === '1') document.documentElement.dataset.darkTinted = '1';
};
sync();
const fromIcon = 'v2\n\nfill 20';
const own = 0x01000000 | 0x3D58A9;
const cases = [
  // [kind, bg, icon colors, design, playing] -> surface
  [['switch', 0, fromIcon, '0', false], ''],
  [['switch', 0, fromIcon, '2', false], 'darkdesign'],
  [['weather', 0, '', '0', false], 'darkdesign'],
  [['weather', 0, '', '1', false], ''],
  [['media', 0, '', '0', true], 'darkdesign'],
  [['media', 0, '', '0', false], ''],
  [['media', 0, '', '1', true], ''],
  [['switch', own, '', '2', false], 'dark'],
];
for (const [[kind, bg, record, design, playing], want] of cases) {
  assert.equal(preview.tileSurfaceOf('folder0', kind, bg, record, design, playing), want, `${kind} design ${design}`);
}
assert.equal(preview.tileFollowsTint('folder0', 'switch', 0, fromIcon, '0'), true, 'From icon with the option');
assert.equal(preview.tileFollowsTint('folder0', 'switch', 0, fromIcon, '1'), false, 'Design Light');
assert.equal(preview.tileFollowsTint('folder0', 'weather', 0, '', '0'), false, 'Weather is always dark');
assert.equal(preview.tileFollowsTint('folder0', 'switch', own, '', '0'), false, 'own color');
page.darkTinted = '0'; sync();
assert.equal(preview.tileFollowsTint('folder0', 'switch', 0, fromIcon, '0'), false, 'without the option');
page.theme = 'dark'; sync();
assert.equal(preview.tileSurfaceOf('folder0', 'weather', 0, '', '2', true), '', 'the dark theme ignores the Design');
page.screensaver = true;
page.theme = 'light'; sync();
assert.equal(preview.tileSurfaceOf('screensaver', 'weather', 0, '', '2', true), '', 'the screensaver keeps the theme');
console.log('Tile Design: stored in V7, HTTP, editor, drafts, import/export; device and preview pick the same surface');
