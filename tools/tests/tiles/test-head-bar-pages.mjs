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

// Storage: in the layout file, five places at most, each folder once, never
// Home. Every page stays in its place and free places stay free (user
// 2026-10-12: nothing moves up); the dots skip the free places, and a
// deleted folder leaves its place free.
const layoutsH = read('src/tiles/config/tile_layouts.h');
const layouts = read('src/tiles/config/tile_layouts.cpp');
// Five pages beside Home, six dots with it (user 2026-10-12).
assert.match(layoutsH, /inline constexpr size_t kMaxPages = 5;/);
const store = slice(layouts, 'bool store_pages_locked(', '\n}\n');
assert.match(store, /for \(size_t i = 0; i < count && i < kMaxPages; \+\+i\)/);
assert.match(store, /wanted\[i\] = folder;\s*used = i \+ 1;/, 'In its own place');
const pageNumber = slice(layouts, 'int page_number(uint16_t folder_id) {', '\n}\n');
assert.match(pageNumber, /if \(!g_page_count\) return -1;\s*if \(folder_id == 0\) return 0;/, 'Home is page 0 only with pages');
assert.match(pageNumber, /if \(!g_pages\[i\]\) continue;\s*\+\+number;/, 'The dots skip free places');
assert.match(slice(layouts, 'size_t pages(uint16_t out[kMaxPages]) {', '\n}\n'), /if \(g_pages\[i\]\) out\[count\+\+\] = g_pages\[i\];/);
assert.match(slice(layouts, 'void drop_folder(', '\n}\n'), /std::replace\(kept, kept \+ kMaxPages, folder_id, static_cast<uint16_t>\(0\)\);/);
// Both ways in (/api/pages, the layout window's /api/layouts) keep a 0 as a
// free place: one check for the slots.
const savedPages = read('src/web/server/handlers/web_admin_tiles.cpp');
assert.match(slice(savedPages, 'const char* checkPageSlots(', '\n}\n'), /if \(!id\) continue;/, 'The device keeps free places');
assert.match(savedPages, /\/\/ 0: a free slot, kept in its place \(user 2026-10-12\)\.\s*if \(id < 0 \|\| id >= 0xFFFF\) \{[\s\S]*?\}\s*wanted\.push_back\(static_cast<uint16_t>\(id\)\);/);
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
// The grey dots and, last, the line in the text color (user 2026-10-12:
// it follows the finger; mockup build/design-mockups/pages/dots-swipe.html).
const dotsRow = slice(bar, 'lv_obj_t* create_dots(', '\n}\n');
assert.match(dotsRow, /for \(int i = 0; i <= count; \+\+i\) \{[\s\S]*lv_obj_set_size\(dot, i == count \? d\.active : d\.dot, d\.dot\);[\s\S]*lv_color_hex\(dot_color\(i == count\)\)/);
assert.match(dotsRow, /lay_out_line\(dots, active, active, 0, 0\);/);
const line = slice(bar, 'void lay_out_line(lv_obj_t* dots, int i, int j, float p, int stretch) {', '\n}\n');
assert.match(line, /left = l0 \+ \(l1 - l0\) \* ease_in\(p\);\s*right = l0 \+ d\.active \+ \(l1 - l0\) \* ease_out\(p\);/, 'Its leading edge runs ahead');
assert.match(line, /const float x = k == i \? to_x : k == j \? from_x : from_x \+ \(to_x - from_x\) \* p;/, 'The grey dots stand still');
// Sized like the mockup: 12 and 34 on an 800 px short side.
assert.match(bar, /const int dot = \(12 \* side \+ 400\) \/ 800;\s*return \{dot, \(34 \* side \+ 400\) \/ 800, dot\};/);
// A page turn: the line goes over on the old page first (120 ms) and the
// new page shows as it arrives, its line at rest (user 2026-10-12: started
// after the new page, the dots trailed behind it).
const shown = slice(bar, 'void shown(lv_obj_t* grid, uint16_t folder_id, uint16_t previous_folder_id) {', '\n}\n');
assert.match(shown, /if \(!dots \|\| page < 0 \|\| from < 0 \|\| from == page\) return;[\s\S]*lay_out_line\(dots, page, page, 0, 0\);/);
assert.match(slice(bar, 'bool lead(', '\n}\n'), /move_line\(dots, from, to, 0\.0f, 1\.0f, 0, duration\);/);
const leadManager = read('src/ui/ui_manager.cpp');
const lead = slice(leadManager, 'void UIManager::showPage(int number) {', '\n}\n');
assert.match(lead, /if \(current >= 0 && home_bar::lead\(tiles_visible_grid\(\), current, number, kPageLeadMs\)\) \{\s*g_page_lead_target = number;\s*g_page_lead = lv_timer_create\(page_lead_done, kPageLeadMs, nullptr\);/);
assert.match(leadManager, /static constexpr uint32_t kPageLeadMs = 120;/);
assert.doesNotMatch(bar, /start_waiting|move_line_after_frame/);
// No line following the finger (user 2026-10-12: it snaps at once).
assert.doesNotMatch(bar, /void drag\(|int release\(|g_handoff/);
// The press pill shows once the finger has rested 50 ms (user 2026-10-12:
// at once it flashed up at the start of a sideways swipe over the head),
// goes as soon as the finger moves, and whenever a swipe takes over (it
// stayed after swipes).
assert.match(bar, /constexpr uint32_t kPressShowMs = 50;/);
assert.match(bar, /if \(code == LV_EVENT_PRESSED\) \{\s*g_press_dots = dots;\s*g_press_ms = lv_tick_get\(\);\s*if \(input\) lv_indev_get_point\(input, &g_press_at\);\s*\} else if/,
  'Not on the press itself');
assert.match(bar, /const int32_t limit = popup_layout::scale\(8\);\s*if \(dx \* dx \+ dy \* dy > limit \* limit\) \{\s*release_press\(dots\);\s*\} else if \(lv_tick_elaps\(g_press_ms\) >= kPressShowMs && !lv_obj_has_state\(dots, LV_STATE_USER_1\)\) \{\s*lv_obj_add_state\(dots, LV_STATE_USER_1\);/);
assert.equal((read('src/ui/ui_manager.cpp').match(/home_bar::cancel_press\(\);/g) || []).length, 2, 'A page turn and an edge action take the pill away');
assert.doesNotMatch(bar, /g_press_timer|press_show/);
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
assert.match(press, /bool page_swipe = tab == 0 && grid_layout::head_bar\(\) &&\s*tile_layouts::page_number\(tileConfig\.getActiveFolderId\(\)\) >= 0 &&\s*\(\(!over_preview && point\.y < GRID_PAD_TOP && !home_bar::is_button\(pressed_object\)\) \|\|\s*on_empty_place \|\| distance\[0\] < kSettingsGestureCaptureWidth \|\|\s*distance\[1\] < kSettingsGestureCaptureWidth\);/);
// The empty places of the grid turn the page too (user 2026-10-12): a press
// on the shown grid itself or behind it, never on a tile.
assert.match(press, /for \(lv_obj_t\* object = tiles_visible_grid\(\); !over_preview && object; object = lv_obj_get_parent\(object\)\) \{\s*if \(object == pressed_object\) on_empty_place = true;\s*if \(object == pressed_object \|\| object == self->tab_panels\[tab\]\) break;/);
assert.match(press, /if \(!lv_obj_has_flag\(object, LV_OBJ_FLAG_GESTURE_BUBBLE\)\) page_swipe = false;/);
assert.match(press, /if \(edge == swipe_gestures::kEdgeOff && !page_swipe\) return;/);
assert.match(press, /self->access_gesture_action = edge != swipe_gestures::kEdgeOff \? actions\[edge\] : kPageSwipe;/);
assert.match(bar, /lv_obj_set_user_data\(button, &g_button_marker\);/, 'The gear and the X are marked');
const motion = slice(manager, 'void UIManager::processSettingsGestureMotion(', '\n}\n');
assert.match(motion, /if \(!matches\) \{\s*if \(access_page_swipe && abs_dx >= threshold && abs_dx > abs_dy\) \{\s*processPageSwipeMotion\(input, released\);/);
assert.match(read('src/tiles/runtime/level_bar.h'), /lv_obj_remove_flag\(bar, LV_OBJ_FLAG_GESTURE_BUBBLE\);/,
  'The level bar keeps its drags');
const swipe = slice(manager, 'void UIManager::processPageSwipeMotion(', '\n}\n');
// One swipe, one step: past the threshold the page turns while the finger
// is still down (user 2026-10-12: it snaps at once, step by step).
assert.match(swipe, /abs_dx < kSettingsGestureThreshold \|\| abs_dx <= abs_dy/);
assert.match(swipe, /if \(!released\) lv_indev_wait_release\(input\);\s*lv_indev_reset\(input, nullptr\);\s*(?:\/\/[^\n]*\n\s*)*page_preview::close\(\);\s*turnPage\(dx < 0 \? 1 : -1\);/);
assert.doesNotMatch(manager, /page_drag_tick/);
const showPage = slice(manager, 'void UIManager::openPage(int number) {', '\n}\n');
assert.match(showPage, /if \(number < 0 \|\| number > count\) return;/);
assert.match(showPage, /requestFolderAccess\(folder_id, folder->name, folder->icon_name\);/, 'A lock set anyway still asks');

// /api/pages: head bar only, Home folders, six at most, a lock removed only
// after the browser asked, the tile off Home in both bar layouts, a folder
// taken out placed on the shown grid (or nothing changes).
const handler = slice(read('src/web/server/handlers/web_admin_tiles.cpp'), 'void WebAdminServer::handleSavePages() {', '\nvoid WebAdminServer::handleGetFolderTab');
assert.match(handler, /if \(grid_layout::active\(\) == grid_layout::Layout::kClassic\) \{\s*sendJsonError\(server, 409, "Pages need the head bar"\);/);
// The slots and the lock are checked like the layout window's save does
// (checkPageSlots, lockedNewPage).
const tilesSource = read('src/web/server/handlers/web_admin_tiles.cpp');
const slotCheck = slice(tilesSource, 'const char* checkPageSlots(', '\n}\n');
assert.match(slotCheck, /tileConfig\.getFolderParent\(id\) != TileConfig::rootFolderId\(\)/);
assert.match(slotCheck, /if \(slots\.size\(\) > tile_layouts::kMaxPages\) return "Too many pages";/);
assert.match(handler, /if \(const char\* error = checkPageSlots\(wanted\)\) \{/);
assert.match(slice(tilesSource, 'uint16_t lockedNewPage(', '\n}\n'),
  /if \(unlock\) return 0;[\s\S]*?tileConfig\.isFolderPinEnabled\(id\)\) \{\s*return id;/);
assert.match(handler, /if \(const uint16_t locked = lockedNewPage\(wanted, before, before_count, server\.arg\("unlock"\) == "1"\)\) \{\s*server\.send\(409/);
assert.match(handler, /tile_layouts::remove\(grid_layout::Layout::kBar, TileConfig::rootFolderId\(\), tile->view_id\);\s*tile_layouts::remove\(grid_layout::Layout::kPortrait, TileConfig::rootFolderId\(\), tile->view_id\);/);
const noRoom = handler.indexOf('sendJsonError(server, 409, "No free cell");');
const firstWrite = handler.indexOf('tileConfig.clearFolderPin(id)');
assert.ok(noRoom >= 0 && firstWrite > noRoom, 'Room is checked before anything is written');
assert.match(read('src/web/server/web_admin.cpp'), /server\.on\("\/api\/pages", HTTP_POST,/);
// The layout window may leave a page's folder tile off Home.
assert.match(read('src/web/server/handlers/web_admin_tiles.cpp'),
  /if \(pages && std::find\(pages->begin\(\), pages->end\(\), getNavigateTargetId\(tile\)\) != pages->end\(\)\) continue;/);

// The preview card: a tap on the head's dots; its dot row lies exactly on
// the head's (same row, same x, same y), the pictures from the built grids'
// card colors, no dimming (the catcher is never drawn), the popups' cached
// shadow, closed by every navigation and a theme change.
assert.match(bar, /lv_obj_add_event_cb\(dots, on_dots, LV_EVENT_CLICKED, nullptr\);/);
assert.match(bar, /void on_dots\(lv_event_t\* event\) \{ page_preview::open\(/);
const preview = read('src/ui/tabs/tiles/page_preview.cpp');
// Its top on the head circle's top line, its dots in a band as high as
// the circle (user 2026-10-12).
assert.match(preview, /const int card_y = head\.center_y - head\.disc \/ 2;/);
assert.match(preview, /const int card_h = head\.disc \+ rows \* cell_h/);
// The shown page's cell filled like a pressed one, a pressed one the same;
// every name in the text color.
assert.match(preview, /lv_obj_set_style_bg_opa\(cell, i == current \? LV_OPA_COVER : LV_OPA_TRANSP, 0\);\s*lv_obj_set_style_bg_opa\(cell, LV_OPA_COVER, LV_STATE_PRESSED\);/);
assert.match(preview, /tone_color::pressed_card\(ui_theme::popup_card\(\)\)/);
assert.match(preview, /lv_obj_set_style_text_color\(name, lv_color_hex\(ui_theme::text\(\)\), 0\);/);
// The overview's fixed rules for every panel (user 2026-10-12, mockup
// build/design-mockups/pages/dots-swipe.html).
const rules = slice(preview, 'Geometry geometry() {', '\n}\n');
assert.match(rules, /g\.pic_w = static_cast<int>\(std::lround\(side \* 0\.22f\)\);/, 'A picture: 22 % of the short side');
assert.match(rules, /g\.gap = std::max\(3, static_cast<int>\(std::lround\(2\.0f \* GRID_GAP \* g\.pic_w \/ w\)\)\);/);
assert.match(rules, /g\.tile_radius = std::max\(2, static_cast<int>\(std::lround\(\(g\.cell_h - g\.gap\) \/ 4\.0f\)\)\);/, 'The panel\'s tile corner rule');
assert.match(rules, /g\.pic_radius = g\.tile_radius \+ g\.gap;/);
assert.match(rules, /g\.card_radius = popup_layout::kCardRadius \+ Device::kGridGap;\s*g\.pad = std::max\(g\.gap, g\.card_radius - g\.pic_radius\);/, 'Concentric with the popup corner');
assert.match(rules, /g\.font = tile_layout::header_title_font\(\);/);
assert.match(preview, /ui_surface_style::apply_popup_border\(card, lv_color_hex\(ui_theme::text\(\)\),/, 'The popup hairline');
// Only a tap counts there; a swipe over the overview does nothing.
assert.match(preview, /void on_picture\(lv_event_t\* event\) \{\s*if \(!was_tap\(\)\) return;/);
assert.match(preview, /void on_close\(lv_event_t\*\) \{\s*if \(was_tap\(\)\) close\(\);\s*\}/);
assert.match(preview, /tappable\(card, on_close, nullptr\);/, 'Its free parts close it too');
assert.doesNotMatch(preview, /bar_w|bar_h/, 'No bar under the shown page\'s name');
assert.match(preview, /home_bar::create_dots\(card, count, current, \(grid_layout::screen_w\(\) - dots_w\) \/ 2 - card_x,\s*head\.center_y - dot\.dot \/ 2 - card_y\);/);
// The head's row sits where the card's does; its pill as high as the
// head's circle, as much beside; a tap reaches it 20 px around.
assert.match(build, /const int row_x = \(grid_layout::screen_w\(\) - dots_width\(count\)\) \/ 2;[\s\S]{0,400}?const int pad = \(g\.disc - d\.dot\) \/ 2;\s*const int box_h = d\.dot \+ 2 \* pad;\s*lv_obj_t\* dots = create_dots\(bar, count, page, row_x - pad, g\.center_y - box_h \/ 2\);/,
  'The head and the card build the same row');
assert.match(build, /lv_obj_set_ext_click_area\(dots, \(20 \* side \+ 400\) \/ 800\);/);
assert.match(build, /lv_obj_set_style_bg_opa\(dots, 31, LV_STATE_USER_1\);/);
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
  kStringsDe: ['"Seiten"', '"Seiten gespeichert"', '"%u Ordner haben in diesem Layout keinen Platz.', '"Seiten haben keine PIN."'],
  kStringsEn: ['"Pages"', '"Pages saved"', '"%u folders have no place in this layout.', '"Pages have no PIN."'],
  kStringsFr: ['"Pages"', '"Pages enregistrées"', '"%u dossiers n\'ont pas de place', '"Les pages n\'ont pas de code PIN."'],
  kStringsPl: ['"Strony"', '"Zapisano strony"', '"Foldery bez miejsca w tym układzie: %u.', '"Strony nie mają kodu PIN."']})) {
  const start = i18n.indexOf(`static const Strings ${table} = {`);
  const body = i18n.slice(start, i18n.indexOf('};', start));
  for (const word of words) assert.ok(body.includes(word), `${table} ${word}`);
  // The refusal: one count and one button name.
  const refusal = body.slice(body.indexOf('"%u') >= 0 ? body.indexOf('"%u') : body.indexOf('"Foldery bez'));
  const refusalLine = refusal.slice(0, refusal.indexOf('\n'));
  assert.ok((refusalLine.match(/%u/g) || []).length === 1 && (refusalLine.match(/%s/g) || []).length === 1, `${table}: %u and %s`);
}
const scripts = read('src/web/server/render/web_admin_scripts.cpp');
for (const key of ['pageUnlockConfirm', 'pagesSaved']) assert.ok(scripts.includes(`appendJsEntry("${key}"`), key);

// A page has no PIN: refused by the device, no PIN option in the editor.
const access = slice(read('src/web/server/handlers/web_admin_tiles.cpp'), 'void WebAdminServer::handleSaveFolderAccess() {', '\n}\n');
assert.match(access, /if \(enable && tile_layouts::page_number\(folder_id\) > 0\) \{\s*sendError\(409, tr\.folder_pin_page\);/);
assert.match(read('src/types/navigate/admin.js'), /if \(fields\) fields\.classList\.toggle\('is-hidden', !isFolderTile \|\| isPage\);/);
// The card's dots close it like the head's.
assert.match(preview, /tappable\(card_dots, on_close, nullptr\);/);
// A page change shows before the flash write and keeps the prepared grids
// (user 2026-10-12: dragging in or out took long, every page was built
// again): their heads are built again, Home's tiles move without a rebuild.
assert.ok(handler.indexOf('tiles_rebuild_heads(awake);') > handler.indexOf('tile_layouts::set_pages(') &&
          handler.indexOf('tiles_show_active_layout_now()') > handler.indexOf('tiles_rebuild_heads(awake);') &&
          handler.indexOf('tile_layouts::commit()') > handler.indexOf('tiles_show_active_layout_now()'),
          'Shown first, written after');
assert.doesNotMatch(handler, /tiles_invalidate_folder\(/, 'No prepared grid is dropped');
assert.match(handler, /if \(Tile\* tile = id \? folder_tile\(id\) : nullptr\) tile->layout_hidden = true;/);
const tabs = read('src/ui/tabs/tiles/tab_tiles_unified.cpp');
assert.match(slice(tabs, 'void tiles_rebuild_heads(bool draw_now) {', '\n}\n'), /home_bar::rebuild\(entry\.grid, entry\.folder_id\);/);
assert.match(slice(bar, 'void rebuild(lv_obj_t* grid, uint16_t folder_id) {', '\n}\n'), /if \(is_bar\(child\)\) lv_obj_delete\(child\);[\s\S]*build\(grid, folder_id\);/);

// The Web Admin (user 2026-10-13): the page fields and the Settings field
// are cells of Home's grid (page-fields.js; its behaviour in
// test-page-fields.mjs), no boxes of their own, nothing made smaller.
const markup = read('src/web/server/render/web_admin_html.cpp');
assert.ok(markup.indexOf('id=\\"pageSlots\\"') > markup.indexOf('<!-- Grid Preview -->'), "The fields' markup after the preview");
assert.ok(markup.indexOf('id=\\"pageSlots\\"') < markup.indexOf('id=\\"settingsHiddenSlot\\"'), 'Before the Settings field');
assert.match(markup, /if \(!page_fields\) \{\s*html \+= "<div class=\\"settings-parking-texts/);
assert.match(markup, /html \+= "\\"><div class=\\"page-fields-label\\">";\s*appendHtmlEscaped\(html, tr\.pages_title\);/, 'One word over the page fields');
assert.match(markup, /html \+= "<div class=\\"page-field\\" data-slot=\\"" \+ String\(i\) \+ "\\"><\/div>";/);
assert.match(markup, /if \(page_fields\) html \+= " data-in-grid=\\"1\\"";/);
assert.match(markup, /if \(grid_layout::head_bar\(\)\) html \+= " with-page-fields";/);
assert.match(markup, /static bool previewSlotsBeside\(\) \{\s*return grid_layout::screen_w\(\) <= grid_layout::screen_h\(\);\s*\}/);
assert.doesNotMatch(markup, /page-stack|page-group|page-settings|pageSlotsUnder/);
const css = read('src/web/assets/admin.css');
assert.doesNotMatch(css, /page-stack|page-group|page-settings|slot-zoom|stack-zoom|page-slots-under/);
assert.doesNotMatch(read('src/web/server/render/web_admin_styles.cpp'), /slot-zoom/);
assert.match(css, /\.tile-grid\.has-page-fields \{[\s\S]*?padding-right:calc\(var\(--preview-pad-right, var\(--preview-pad\)\) \+ var\(--fields-right, 0px\)\);/,
  "The fields take their room as the grid's padding: its pointer mapping stays");
assert.match(css, /\.tile-grid > \.page-field,\s*\.tile-grid > \.tile-grid\.settings-hidden-slot \{[\s\S]*?width:var\(--preview-cell-w\);\s*height:var\(--preview-cell-h\);/,
  "A field is a tile's size");
assert.match(markup, /if \(previewSlotsBeside\(\)\) html \+= " compact-grid";/);

console.log('Head bar pages: storage, dots, swipe, preload, preview card, /api/pages, no PIN, no folder out of reach');
