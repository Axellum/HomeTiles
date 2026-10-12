// Pages in the head bar layouts (user 2026-10-12, mockup
// build/design-mockups/pages): up to six Home folders become pages beside
// Home; dots in the head, swipes left and right, the neighbours preloaded, a
// page's folder tile off Home in the bar layouts only, and the Web Admin's
// /api/pages that keeps every folder reachable.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const slice = (text, start, end) => {
  const from = text.indexOf(start);
  assert.ok(from >= 0, 'missing ' + start);
  const to = end ? text.indexOf(end, from + start.length) : text.length;
  assert.ok(to > from, 'missing end ' + end);
  return text.slice(from, to);
};

// Storage: in the layout file, six at most, each once, never Home; a deleted
// folder leaves the pages.
const layoutsH = read('src/tiles/config/tile_layouts.h');
const layouts = read('src/tiles/config/tile_layouts.cpp');
assert.match(layoutsH, /inline constexpr size_t kMaxPages = 6;/);
const store = slice(layouts, 'bool store_pages_locked(', '\n}\n');
assert.match(store, /for \(size_t i = 0; i < count && wanted_count < kMaxPages; \+\+i\)/);
assert.match(store, /if \(!folder \|\| std::find\(wanted, wanted \+ wanted_count, folder\) != wanted \+ wanted_count\) continue;/);
const pageNumber = slice(layouts, 'int page_number(uint16_t folder_id) {', '\n}\n');
assert.match(pageNumber, /if \(!g_page_count\) return -1;\s*if \(folder_id == 0\) return 0;/, 'Home is page 0 only with pages');
assert.match(pageNumber, /return static_cast<int>\(i\) \+ 1;/);
assert.match(slice(layouts, 'void drop_folder(', '\n}\n'), /if \(g_pages\[i\] != folder_id\) kept\[kept_count\+\+\] = g_pages\[i\];/);
assert.match(layouts, /for \(JsonVariantConst folder : doc\["pages"\]\.as<JsonArrayConst>\(\)\)/);
assert.match(layouts, /out \+= ",\\"pages\\":\[";/);

// A page's folder tile leaves Home in the bar layouts; the classic layout
// keeps it (it returns before).
const tileConfig = read('src/tiles/config/tile_config.cpp');
const apply = slice(tileConfig, 'static void applyLayoutPlaces(', 'showUnplacedSettingsTile(grid);');
const classicReturn = apply.indexOf('if (active == Layout::kClassic) {');
const pageHide = apply.indexOf('tile_layouts::page_number(getNavigateTargetId(tile)) > 0');
assert.ok(classicReturn >= 0 && pageHide > classicReturn, 'Pages only in the bar layouts');
assert.match(apply, /if \(folder_id == TileConfig::rootFolderId\(\) && tile\.type == TILE_FOLDER &&/);

// The head: dots on Home and its pages, the gear there; a folder keeps its X.
const bar = read('src/ui/tabs/tiles/home_bar.cpp');
const build = slice(bar, 'void build(lv_obj_t* grid, uint16_t folder_id) {', '\n}\n');
assert.match(build, /const int page = tile_layouts::page_number\(folder_id\);\s*const bool home_level = home \|\| page > 0;/);
assert.match(build, /getMdiChar\(home_level \? "cog" : "window-close"\)/);
assert.match(build, /if \(page >= 0\) \{/);
assert.match(build, /const int count = static_cast<int>\(tile_layouts::pages\(pages\)\) \+ 1;/);
assert.match(slice(bar, 'lv_obj_t* create_dots(', '\n}\n'), /lv_obj_set_size\(dot, i == active \? d\.active : d\.dot, d\.dot\);/);
// Sized like the mockup: 12 and 34 on an 800 px short side.
assert.match(bar, /const int dot = \(12 \* side \+ 400\) \/ 800;\s*return \{dot, \(34 \* side \+ 400\) \/ 800, dot\};/);
// The glide: only between two pages, 150 ms.
const shown = slice(bar, 'void shown(lv_obj_t* grid, uint16_t folder_id, uint16_t previous_folder_id) {', '\n}\n');
assert.match(shown, /if \(page < 0 \|\| from < 0 \|\| from == page\) return;/);
assert.match(shown, /lv_anim_set_duration\(&anim, 150\);/);
const tiles = read('src/ui/tabs/tiles/tab_tiles_unified.cpp');
assert.equal((tiles.match(/home_bar::shown\(target->grid, folder_id, previous \? previous->folder_id : kInvalidFolderId\);/g) || []).length, 2,
  'Both folder switch paths report the shown grid');

// The neighbours are preloaded first.
const plan = slice(tiles, 'static void schedule_navigation_preload(', '\n}\n');
const neighbours = plan.indexOf('for (const int neighbour : {page + 1, page - 1})');
const back = plan.indexOf('if (config.tiles[i].type != TILE_BACK) continue;');
assert.ok(neighbours >= 0 && back > neighbours, 'Pages before Back and folder tiles');

// The swipe: on Home or a page, only in the head beside its gear or X or
// right at a side edge (user 2026-10-12: never across the tiles), never on a
// control that drags itself (no gesture bubble), and no tap on the tile it
// started on. An edge's own action comes first; a sideways move from the
// top edge's strip still turns the page.
const manager = read('src/ui/ui_manager.cpp');
const press = slice(manager, 'void UIManager::settings_gesture_indev_event_cb', '\nvoid UIManager::nav_button_event_cb');
assert.match(press, /bool page_swipe = tab == 0 && grid_layout::head_bar\(\) &&\s*tile_layouts::page_number\(tileConfig\.getActiveFolderId\(\)\) >= 0 &&\s*\(\(point\.y < GRID_PAD_TOP && !home_bar::is_button\(pressed_object\)\) \|\|\s*distance\[0\] < kSettingsGestureCaptureWidth \|\| distance\[1\] < kSettingsGestureCaptureWidth\);/);
assert.match(press, /if \(!lv_obj_has_flag\(object, LV_OBJ_FLAG_GESTURE_BUBBLE\)\) page_swipe = false;/);
assert.match(press, /if \(edge == swipe_gestures::kEdgeOff && !page_swipe\) return;/);
assert.match(press, /self->access_gesture_action = edge != swipe_gestures::kEdgeOff \? actions\[edge\] : kPageSwipe;/);
assert.match(bar, /lv_obj_set_user_data\(button, &g_button_marker\);/, 'The gear and the X are marked');
const motion = slice(manager, 'void UIManager::processSettingsGestureMotion(', '\n}\n');
assert.match(motion, /if \(!matches\) \{\s*if \(access_page_swipe && abs_dx >= threshold && abs_dx > abs_dy\) \{\s*processPageSwipeMotion\(input, released\);/);
assert.match(read('src/tiles/runtime/level_bar.h'), /lv_obj_remove_flag\(bar, LV_OBJ_FLAG_GESTURE_BUBBLE\);/,
  'The level bar keeps its drags');
const swipe = slice(manager, 'void UIManager::processPageSwipeMotion(', '\n}\n');
assert.match(swipe, /abs_dx < kSettingsGestureThreshold \|\| abs_dx <= abs_dy/);
assert.match(swipe, /lv_indev_reset\(input, nullptr\);\s*turnPage\(dx < 0 \? 1 : -1\);/);
const showPage = slice(manager, 'void UIManager::showPage(int number) {', '\n}\n');
assert.match(showPage, /if \(number < 0 \|\| number > count\) return;/);
assert.match(showPage, /requestFolderAccess\(folder_id, folder->name, folder->icon_name\);/, 'A lock set anyway still asks');

// /api/pages: head bar only, Home folders, six at most, a lock removed only
// after the browser asked, the tile off Home in both bar layouts, a folder
// taken out placed on the shown grid (or nothing changes).
const handler = slice(read('src/web/server/handlers/web_admin_tiles.cpp'), 'void WebAdminServer::handleSavePages() {', '\nvoid WebAdminServer::handleGetFolderTab');
assert.match(handler, /if \(grid_layout::active\(\) == grid_layout::Layout::kClassic\) \{\s*sendJsonError\(server, 409, "Pages need the head bar"\);/);
assert.match(handler, /tileConfig\.getFolderParent\(static_cast<uint16_t>\(id\)\) != TileConfig::rootFolderId\(\)/);
assert.match(handler, /if \(wanted\.size\(\) > tile_layouts::kMaxPages\)/);
assert.match(handler, /if \(was_page\(id\) \|\| !tileConfig\.isFolderPinEnabled\(id\) \|\| unlock\) continue;\s*server\.send\(409/);
assert.match(handler, /tile_layouts::remove\(grid_layout::Layout::kBar, TileConfig::rootFolderId\(\), tile->view_id\);\s*tile_layouts::remove\(grid_layout::Layout::kPortrait, TileConfig::rootFolderId\(\), tile->view_id\);/);
const noRoom = handler.indexOf('sendJsonError(server, 409, "No free cell");');
const firstWrite = handler.indexOf('tileConfig.clearFolderPin(id)');
assert.ok(noRoom >= 0 && firstWrite > noRoom, 'Room is checked before anything is written');
assert.match(read('src/web/server/web_admin.cpp'), /server\.on\("\/api\/pages", HTTP_POST,/);
// The layout window may leave a page's folder tile off Home.
assert.match(read('src/web/server/handlers/web_admin_tiles.cpp'),
  /if \(pages && tile_layouts::page_number\(getNavigateTargetId\(tile\)\) > 0\) continue;/);

// The preview card: a tap on the head's dots; its dot row lies exactly on
// the head's (same row, same x, same y), the pictures from the built grids'
// card colors, no dimming (the catcher is never drawn), the popups' cached
// shadow, closed by every navigation and a theme change.
assert.match(bar, /lv_obj_add_event_cb\(dots, on_dots, LV_EVENT_CLICKED, nullptr\);/);
assert.match(bar, /void on_dots\(lv_event_t\* event\) \{ page_preview::open\(/);
const preview = read('src/ui/tabs/tiles/page_preview.cpp');
assert.match(preview, /const int card_y = head\.center_y - geo\.pad_top - geo\.head_h \/ 2;/);
assert.match(preview, /home_bar::create_dots\(card, count, current, \(grid_layout::screen_w\(\) - dots_w\) \/ 2 - card_x,\s*head\.center_y - dot\.dot \/ 2 - card_y\);/);
assert.match(build, /const int row_x = \(grid_layout::screen_w\(\) - dots_width\(count\)\) \/ 2;\s*lv_obj_t\* dots = create_dots\(bar, count, page, row_x, g\.center_y - d\.dot \/ 2\);/,
  'The head and the card build the same row');
assert.doesNotMatch(preview, /lv_obj_set_style_bg_opa\(g_state\.catcher/, 'No dimming');
assert.match(preview, /popup_layout::apply_card_shadow\(card\);/);
assert.match(preview, /lv_obj_add_event_cb\(picture, picture_draw, LV_EVENT_DRAW_MAIN_END, nullptr\);/, 'Pictures are drawn, not built of objects');
assert.match(preview, /close\(\);\s*uiManager\.showPage\(index\);/);
const schematic = slice(tiles, 'size_t tiles_page_schematic(', '\n}\n');
assert.match(schematic, /color = lv_color_to_u32\(lv_obj_get_style_bg_color\(obj, LV_PART_MAIN\)\) & 0xFFFFFF;/);
assert.match(schematic, /if \(lv_obj_get_style_bg_opa\(obj, LV_PART_MAIN\) < LV_OPA_50\) continue;/);
assert.match(slice(manager, 'void UIManager::switchToTab(uint8_t index) {', '\n}\n'), /page_preview::close\(\);/);
assert.match(slice(manager, 'void UIManager::processThemeChange() {', '\n}\n'), /viewNavigationClosePopups\(\);\s*page_preview::close\(\);/);
assert.match(slice(tiles, 'void tiles_switch_to_folder(uint16_t folder_id) {', '\n}\n'), /page_preview::close\(\);/);

// No folder is ever out of reach (user 2026-10-12): a layout where folder
// tiles have no place is not switched to, on the Web Admin (with the hint)
// nor in the setup; a page's tile needs none in the bar layouts.
const without = slice(tileConfig, 'unsigned TileConfig::foldersWithoutPlace(', '\n}\n');
assert.match(without, /if \(tile_layouts::classic_hidden\(folder\.id, tile\.view_id\)\) \+\+missing;/);
assert.match(without, /if \(folder\.id == kRootFolderId && tile_layouts::page_number\(getNavigateTargetId\(tile\)\) > 0\) continue;/);
assert.match(without, /!grid_layout::inside\(screen, place\.col, place\.row, place\.span_w, place\.span_h\)/);
const switchLayout = slice(read('src/web/server/handlers/web_admin_tiles.cpp'), 'void WebAdminServer::handleSwitchLayout() {', '\n}\n');
assert.ok(switchLayout.indexOf('tileConfig.foldersWithoutPlace(layout)') < switchLayout.indexOf('configManager.saveLayout('),
  'Checked before the layout is stored');
assert.match(switchLayout, /snprintf\(message, sizeof\(message\), tr\.layout_switch_refused, missing, tr\.layout_change\);/);
const setup = slice(read('src/ui/tabs/settings/tab_settings.cpp'), 'void layout_selected(uint8_t index) {', '\n}\n');
assert.ok(setup.indexOf('tileConfig.foldersWithoutPlace(layout)') < setup.indexOf('configManager.saveLayout('));
assert.match(read('src/web/admin/tiles/layout-window.js'), /showNotification\(error\?\.message \|\| t\('saveFailed'\), false\);/,
  'The window shows the device\'s reason');

// Every language has the page texts and the refusal (positional tables).
const i18n = read('src/core/i18n/i18n.cpp');
for (const [table, words] of Object.entries({
  kStringsDe: ['"Seiten"', '"Höchstens 6 Seiten"', '"Seiten gespeichert"', '"%u Ordner haben in diesem Layout keinen Platz.'],
  kStringsEn: ['"Pages"', '"At most 6 pages"', '"Pages saved"', '"%u folders have no place in this layout.'],
  kStringsFr: ['"Pages"', '"6 pages au maximum"', '"Pages enregistrées"', '"%u dossiers n\'ont pas de place'],
  kStringsPl: ['"Strony"', '"Maksymalnie 6 stron"', '"Zapisano strony"', '"Foldery bez miejsca w tym układzie: %u.']})) {
  const start = i18n.indexOf(`static const Strings ${table} = {`);
  const body = i18n.slice(start, i18n.indexOf('};', start));
  for (const word of words) assert.ok(body.includes(word), `${table} ${word}`);
  // The refusal is the last text: one count and one button name.
  const refusal = body.slice(body.lastIndexOf('\n'));
  assert.ok((refusal.match(/%u/g) || []).length === 1 && (refusal.match(/%s/g) || []).length === 1, `${table}: %u and %s`);
}
const scripts = read('src/web/server/render/web_admin_scripts.cpp');
for (const key of ['pagesFull', 'pageUnlockConfirm', 'pagesSaved']) assert.ok(scripts.includes(`appendJsEntry("${key}"`), key);

console.log('Head bar pages: storage, dots, swipe, preload, preview card, /api/pages and no folder out of reach');
