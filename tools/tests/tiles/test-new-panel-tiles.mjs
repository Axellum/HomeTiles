// A brand-new panel's first page (user 2026-10-12: "das Standardlayout ist
// immer noch das klassische und Settings unten"): it starts in the head bar
// layout with the gear in the head and the Settings tile parked, a
// transparent analog clock with the time, weekday and date beside the face,
// the folders "Lights" and "Climate" and a transparent "Welcome to
// HomeTiles!", in the panel's language, arranged as the user did it in the
// Web Admin ("bitte als Standard am Anfang so einrichten"); a language change
// during the setup renames the defaults nobody changed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileAndRun} from '../../lib/cpp-host.mjs';
import {cppFunctionDefinitions} from '../../lib/cpp-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

// The places in every grid a panel has: the classic profiles (at least 4 x 4)
// and the head bar layouts (6 x 4, 5 x 3, 4 x 3, square 3 x 3, upright 4 x 6
// and 3 x 5): inside, without overlaps, clear of the classic Settings tile in
// the bottom right corner.
const grids = [[7, 5], [7, 4], [6, 4], [5, 4], [4, 6], [4, 4], [6, 4], [5, 3], [4, 3], [3, 3], [4, 6], [3, 6], [3, 5]];
const harness = String.raw`
#include <cstdio>
#include "src/tiles/config/new_panel_tiles.h"
int main() {
  const int grids[][2] = {${grids.map(([c, r]) => `{${c}, ${r}}`).join(', ')}};
  for (const auto& g : grids) {
    new_panel_tiles::Place p[new_panel_tiles::kSlotCount];
    const bool ok = new_panel_tiles::places(g[0], g[1], p);
    std::printf("%d %d %d", g[0], g[1], ok ? 1 : 0);
    for (const auto& at : p) std::printf(" %g %g %g %g", at.col, at.row, at.span_w, at.span_h);
    std::printf("\n");
  }
  new_panel_tiles::Place p[new_panel_tiles::kSlotCount];
  std::printf("small %d %d\n", new_panel_tiles::places(2, 4, p) ? 1 : 0, new_panel_tiles::places(4, 2, p) ? 1 : 0);
  return 0;
}
`;
const output = compileAndRun({label: 'New panel places', harness});
if (output !== null) {
  const lines = output.trim().split('\n');
  const small = lines.pop().trim().split(' ');
  assert.deepEqual(small, ['small', '0', '0'], 'grids below 3 x 3 get no first page');
  for (const line of lines) {
    const [cols, rows, ok, ...v] = line.trim().split(' ').map(Number);
    assert.equal(ok, 1, `${cols} x ${rows}`);
    const places = [0, 1, 2, 3].map(i => v.slice(i * 4, i * 4 + 4));
    assert.deepEqual(places[0], [0, 0, 2, 1], 'the clock 2 x 1 top left');
    assert.deepEqual(places[3], [0, 1, 2, 1], 'the welcome text 2 x 1 below it');
    assert.deepEqual(places[1], [2, 0, 1, 1], 'Lights right of the clock');
    assert.deepEqual(places[2], [2, 1, 1, 1], 'Climate below Lights');
    for (const [c, r, w, h] of places) assert.ok(c + w <= cols && r + h <= rows, `${cols} x ${rows}: inside`);
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        const [p, q] = [places[a], places[b]];
        assert.ok(!(p[0] < q[0] + q[2] && q[0] < p[0] + p[2] && p[1] < q[1] + q[3] && q[1] < p[1] + p[3]), `${cols} x ${rows}: ${a} and ${b} apart`);
      }
    }
    for (const [c, r, w, h] of places) {
      assert.ok(!(c + w > cols - 1 && r + h > rows - 1), `${cols} x ${rows}: the Settings corner stays free`);
    }
  }
}

// The seed: an untouched Home only, the folders and tiles as the Web Admin
// would store them, the head bar places by the saved IDs, the gear on, the
// layout of the panel's own orientation, loaded again before the UI.
const seed = read('src/tiles/config/new_panel_tiles.cpp');
const fn = name => cppFunctionDefinitions(seed).find(f => f.name === name).source;
assert.match(fn('seed'), /if \(tile\.type != TILE_SETTINGS\) return false;/);
assert.match(fn('seed'), /tileConfig\.createFolder\(TileConfig::rootFolderId\(\), tr\.new_panel_lights, kLightsIcon, lights\)/);
assert.match(fn('seed'), /tileConfig\.createFolder\(TileConfig::rootFolderId\(\), tr\.new_panel_climate, kClimateIcon, climate\)/);
assert.match(fn('seed'), /const Layout layout = grid_layout::native_portrait\(\) \? Layout::kPortrait : Layout::kBar;/);
// Places in both head bar layouts, so the setup's landscape / upright
// choice finds them.
assert.match(fn('seed'), /const Layout kBarLayouts\[\] = \{Layout::kBar, Layout::kPortrait\};[\s\S]*?tile_layouts::set\(each, TileConfig::rootFolderId\(\), view_id,/);
assert.match(fn('seed'), /configManager\.saveHeadGear\(true\)/);
assert.match(fn('seed'), /configManager\.saveLayout\(static_cast<uint8_t>\(layout\)\)/);
assert.match(fn('seed'), /grid_layout::apply\(static_cast<uint8_t>\(layout\)\);\s*tileConfig\.load\(\);/);
// The Settings tile starts parked (user 2026-10-12: "bitte standardmäßig in
// Parkzone"): without a place it sat in the head bar layouts' storage and in
// the classic grid. It keeps its look and place like a Web Admin park.
assert.match(fn('seed'), /configManager\.saveLayout\(static_cast<uint8_t>\(layout\)\)\) \{[\s\S]*?\}\s*[\s\S]*?if \(!park_settings_tile\(\*grid\)\)[\s\S]*?grid_layout::apply/);
const park = fn('park_settings_tile');
assert.match(park, /if \(tile\.type == TILE_SETTINGS\) TileConfig::snapshotSettingsTile\(tile, cfg->settings_tile_snapshot\);/);
assert.match(park, /cfg->settings_tile_hidden = true;\s*cfg->settings_swipe_enabled = true;/);
assert.match(park, /configManager\.save\(\*cfg\) &&\s*tileConfig\.setSettingsTileVisible\(false\) == SettingsTileVisibilityResult::Success/);
// The Web Admin's park takes the same snapshot.
assert.match(read('src/web/server/handlers/web_admin_handlers.cpp'),
  /if \(hide_tile && settings_tile_present\) \{\s*TileConfig::snapshotSettingsTile\(settings_tile, cfg\.settings_tile_snapshot\);/);
assert.match(fn('clock_tile_default'), /tile\.sensor_decimals = 3;/);
assert.match(fn('clock_tile_default'), /options\.style = clock_tile::STYLE_ANALOG;\s*options\.weekday = clock_tile::WEEKDAY_LONG;/);
assert.match(fn('make_transparent'), /tile\.bg_color = TILE_BG_COLOR_EXPLICIT;\s*tile\.sensor_display_mode = 1;/);
assert.match(fn('welcome_tile'), /tile\.scene_alias = text;/);
assert.match(fn('folder_tile'), /setNavigateTargetId\(tile, folder_id\);/);
assert.match(seed, /kLightsIcon = "lightbulb-group"/);
assert.match(seed, /kClimateIcon = "thermostat"/);

// Only a new panel, after the first load.
const sketch = read('HomeTiles.ino');
assert.match(sketch, /const bool new_panel = !has_config && settings_begin_new_panel\(\);/);
assert.match(sketch, /tileConfig\.load\(\);[\s\S]{0,300}if \(new_panel\) new_panel_tiles::seed\(\);[\s\S]{0,400}displayManager\.applyShownScreen\(\);/);

// The setup's language renames only the untouched defaults.
const follow = fn('follow_language');
assert.match(follow, /tile\.title == before\.new_panel_lights\s*\? after\.new_panel_lights/);
assert.match(follow, /tile\.scene_alias == before\.new_panel_welcome/);
assert.match(read('src/ui/tabs/settings/tab_settings.cpp'),
  /if \(list == LocaleList::Language && setup_step\(\) >= 0\) \{\s*new_panel_tiles::follow_language\(language_before, cfg\.language\);/);

// The names in every language.
const i18n = read('src/core/i18n/i18n.cpp');
for (const words of [['Licht', 'Klima', 'Willkommen bei HomeTiles!'], ['Lights', 'Climate', 'Welcome to HomeTiles!'],
  ['Lumières', 'Climat', String.raw`Bienvenue sur HomeTiles\u00A0!`], ['Światła', 'Klimat', 'Witaj w HomeTiles!']]) {
  assert.ok(i18n.includes(words.map(w => `    "${w}"`).join(',\n')), words.join(' '));
}
console.log('New panel: head bar layout, parked Settings, analog clock, two folders and a welcome text');
