#include "src/ui/tabs/tiles/page_preview.h"

#include <Arduino.h>
#include <esp_heap_caps.h>

#include <algorithm>
#include <cmath>

#include "src/core/config/config_manager.h"
#include "src/core/config/tile_radius.h"
#include "src/core/i18n/i18n.h"
#include "src/fonts/ui_fonts.h"
#include "src/tiles/config/grid_layout.h"
#include "src/tiles/config/tile_config.h"
#include "src/tiles/config/tile_geometry.h"
#include "src/tiles/config/tile_layouts.h"
#include "src/ui/popups/popup_layout.h"
#include "src/ui/shared/ui_theme.h"
#include "src/ui/tabs/tiles/home_bar.h"
#include "src/ui/tabs/tiles/tab_tiles_unified.h"
#include "src/ui/ui_manager.h"

namespace page_preview {
namespace {

constexpr int kMaxPictures = static_cast<int>(tile_layouts::kMaxPages) + 1;

// The mockup's sizes on a 1280x800 panel, by the screen's short side; the
// pictures by its width (176 px there, 86 on a 480 px panel), in its shape.
struct Geometry {
  int pad_top;
  int pad_x;
  int pad_bottom;
  int gap_x;
  int gap_y;
  int radius;
  int pic_w;
  int pic_h;
  int pic_radius;
  int head_h;
  int head_gap;
  int text_gap;
  int bar_w;
  int bar_h;
  const lv_font_t* font;
};

Geometry geometry() {
  const int w = grid_layout::screen_w();
  const int h = grid_layout::screen_h();
  const int side = w < h ? w : h;
  auto k = [side](int value) { return (value * side + 400) / 800; };
  Geometry g{};
  g.pad_top = k(26);
  g.pad_x = k(26);
  g.pad_bottom = k(22);
  g.gap_x = k(18);
  g.gap_y = k(22);
  g.radius = k(34);
  g.pic_w = (9 * w + 40) / 80 + 32;
  g.pic_h = (g.pic_w * h + w / 2) / w;
  g.pic_radius = k(16);
  // The head's dot row with a dot's height around it.
  g.head_h = 2 * home_bar::dot_sizes().dot + 2;
  g.head_gap = k(22);
  g.text_gap = k(10);
  g.bar_w = k(32);
  g.bar_h = k(7) < 2 ? 2 : k(7);
#if defined(DEVICE_LAYOUT_480X480)
  g.font = &ui_font_12;
#else
  g.font = side >= 720 ? &ui_font_20 : &ui_font_16;
#endif
  return g;
}

struct State {
  // The whole screen under the card: a tap there closes it.
  lv_obj_t* catcher = nullptr;
  // The head's dot row, hidden while the card shows its own.
  lv_obj_t* dots = nullptr;
  // Every picture's tiles, picture i from first[i] to first[i + 1].
  PageTileRect* rects = nullptr;
  uint16_t first[kMaxPictures + 1] = {};
};
State g_state;

void forget_dots(lv_event_t* event) {
  if (lv_event_get_target(event) == g_state.dots) g_state.dots = nullptr;
}

// A picture: the screen in its color, the tiles in theirs, scaled.
void picture_draw(lv_event_t* event) {
  lv_obj_t* picture = static_cast<lv_obj_t*>(lv_event_get_current_target(event));
  const int index = static_cast<int>(reinterpret_cast<intptr_t>(lv_obj_get_user_data(picture)));
  if (!g_state.rects || index < 0 || index >= kMaxPictures) return;
  lv_area_t area;
  lv_obj_get_coords(picture, &area);
  const float scale = static_cast<float>(lv_area_get_width(&area)) / grid_layout::screen_w();
  lv_draw_rect_dsc_t dsc;
  lv_draw_rect_dsc_init(&dsc);
  dsc.radius = std::max(1L, std::lround(tile_radius::kDefault * scale));
  dsc.bg_opa = LV_OPA_COVER;
  for (int i = g_state.first[index]; i < g_state.first[index + 1]; ++i) {
    const PageTileRect& rect = g_state.rects[i];
    const int x = GRID_PAD_LEFT + tile_geometry::edge(rect.col, GRID_CELL_W, GRID_GAP);
    const int y = GRID_PAD_TOP + tile_geometry::edge(rect.row, GRID_CELL_H, GRID_GAP);
    const int w = tile_geometry::extent(rect.col, rect.span_w, GRID_CELL_W, GRID_GAP);
    const int h = tile_geometry::extent(rect.row, rect.span_h, GRID_CELL_H, GRID_GAP);
    lv_area_t tile;
    tile.x1 = area.x1 + std::lround(x * scale);
    tile.y1 = area.y1 + std::lround(y * scale);
    tile.x2 = area.x1 + std::lround((x + w) * scale) - 1;
    tile.y2 = area.y1 + std::lround((y + h) * scale) - 1;
    dsc.bg_color = lv_color_hex(rect.color);
    lv_draw_rect(lv_event_get_layer(event), &dsc, &tile);
  }
}

void on_picture(lv_event_t* event) {
  const int index = static_cast<int>(reinterpret_cast<intptr_t>(lv_event_get_user_data(event)));
  close();
  uiManager.showPage(index);
}

void on_catcher(lv_event_t*) { close(); }

lv_obj_t* plain(lv_obj_t* parent) {
  lv_obj_t* obj = lv_obj_create(parent);
  lv_obj_remove_style_all(obj);
  lv_obj_remove_flag(obj, static_cast<lv_obj_flag_t>(LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE));
  return obj;
}

}  // namespace

bool is_open() { return g_state.catcher != nullptr; }

void close() {
  if (g_state.catcher) lv_obj_delete(g_state.catcher);
  g_state.catcher = nullptr;
  if (g_state.rects) heap_caps_free(g_state.rects);
  g_state.rects = nullptr;
  if (g_state.dots) {
    lv_obj_remove_event_cb(g_state.dots, forget_dots);
    lv_obj_remove_flag(g_state.dots, LV_OBJ_FLAG_HIDDEN);
  }
  g_state.dots = nullptr;
}

void open(lv_obj_t* dots) {
  if (is_open()) {
    close();
    return;
  }
  uint16_t pages[tile_layouts::kMaxPages];
  const int count = static_cast<int>(tile_layouts::pages(pages)) + 1;
  const int current = tile_layouts::page_number(tileConfig.getActiveFolderId());
  if (count < 2 || current < 0) return;
  // The pictures' tiles: the built grids' card colors, else the stored ones.
  const size_t capacity = static_cast<size_t>(count) * TILES_PER_GRID;
  g_state.rects = static_cast<PageTileRect*>(
      heap_caps_malloc(capacity * sizeof(PageTileRect), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!g_state.rects) g_state.rects = static_cast<PageTileRect*>(heap_caps_malloc(capacity * sizeof(PageTileRect), MALLOC_CAP_8BIT));
  if (!g_state.rects) {
    Serial.println("[Pages] No memory for the preview");
    return;
  }
  const uint32_t started = millis();
  size_t used = 0;
  for (int i = 0; i < count; ++i) {
    g_state.first[i] = static_cast<uint16_t>(used);
    const uint16_t folder = i == 0 ? TileConfig::rootFolderId() : pages[i - 1];
    used += tiles_page_schematic(folder, g_state.rects + used, TILES_PER_GRID);
  }
  g_state.first[count] = static_cast<uint16_t>(used);

  const Geometry geo = geometry();
  const home_bar::Geometry head = home_bar::geometry();
  const home_bar::DotSizes dot = home_bar::dot_sizes();
  const int cols = count < 3 ? count : 3;
  const int rows = (count + cols - 1) / cols;
  const int line = lv_font_get_line_height(geo.font);
  const int item_h = geo.pic_h + geo.text_gap + line + geo.text_gap + geo.bar_h;
  const int card_w = cols * geo.pic_w + (cols - 1) * geo.gap_x + 2 * geo.pad_x;
  const int card_h =
      geo.pad_top + geo.head_h + geo.head_gap + rows * item_h + (rows - 1) * geo.gap_y + geo.pad_bottom;
  // Grown out of the dots: its dot row lies exactly on the head's.
  const int card_x = (grid_layout::screen_w() - card_w) / 2;
  const int card_y = head.center_y - geo.pad_top - geo.head_h / 2;

  g_state.catcher = plain(lv_layer_top());
  lv_obj_set_size(g_state.catcher, grid_layout::screen_w(), grid_layout::screen_h());
  lv_obj_add_flag(g_state.catcher, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(g_state.catcher, on_catcher, LV_EVENT_CLICKED, nullptr);

  // The popups' card: their color, the tile corner's shape, the shadow the
  // LVGL cache keeps. A tap on it beside the pictures does nothing.
  lv_obj_t* card = plain(g_state.catcher);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_pos(card, card_x, card_y);
  lv_obj_set_size(card, card_w, card_h);
  lv_obj_set_style_bg_color(card, lv_color_hex(ui_theme::popup_card()), 0);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(card, geo.radius, 0);
  popup_layout::apply_card_shadow(card);

  const int dots_w = home_bar::dots_width(count);
  home_bar::create_dots(card, count, current, (grid_layout::screen_w() - dots_w) / 2 - card_x,
                        head.center_y - dot.dot / 2 - card_y);

  const i18n::Strings& tr = i18n::strings(configManager.getConfig().language);
  for (int i = 0; i < count; ++i) {
    const int x = geo.pad_x + (i % cols) * (geo.pic_w + geo.gap_x);
    const int y = geo.pad_top + geo.head_h + geo.head_gap + (i / cols) * (item_h + geo.gap_y);
    lv_obj_t* picture = plain(card);
    lv_obj_set_user_data(picture, reinterpret_cast<void*>(static_cast<intptr_t>(i)));
    lv_obj_set_pos(picture, x, y);
    lv_obj_set_size(picture, geo.pic_w, geo.pic_h);
    lv_obj_set_style_radius(picture, geo.pic_radius, 0);
    lv_obj_set_style_bg_color(picture, lv_color_hex(ui_theme::screen()), 0);
    lv_obj_set_style_bg_opa(picture, LV_OPA_COVER, 0);
    lv_obj_add_flag(picture, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(picture, picture_draw, LV_EVENT_DRAW_MAIN_END, nullptr);
    lv_obj_add_event_cb(picture, on_picture, LV_EVENT_CLICKED, reinterpret_cast<void*>(static_cast<intptr_t>(i)));

    const FolderEntry* folder = i == 0 ? nullptr : tileConfig.getFolder(pages[i - 1]);
    lv_obj_t* name = lv_label_create(card);
    lv_obj_set_style_text_font(name, geo.font, 0);
    lv_obj_set_style_text_color(
        name, lv_color_hex(i == current ? ui_theme::text() : ui_theme::light() ? ui_theme::icon_off() : ui_theme::icon_inactive()), 0);
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_set_size(name, geo.pic_w, line);
    lv_obj_set_pos(name, x, y + geo.pic_h + geo.text_gap);
    lv_label_set_text(name, i == 0 || !folder || !folder->name[0] ? tr.home : folder->name);

    // The current page: the active dot's bar under its name.
    if (i != current) continue;
    lv_obj_t* bar = plain(card);
    lv_obj_set_size(bar, geo.bar_w, geo.bar_h);
    lv_obj_set_pos(bar, x + (geo.pic_w - geo.bar_w) / 2, y + geo.pic_h + geo.text_gap + line + geo.text_gap);
    lv_obj_set_style_radius(bar, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(bar, lv_color_hex(ui_theme::text()), 0);
    lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, 0);
  }

  // The head's own dots hide under the card's.
  g_state.dots = dots;
  if (dots) {
    lv_obj_add_flag(dots, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(dots, forget_dots, LV_EVENT_DELETE, nullptr);
  }
  Serial.printf("[Pages] Preview of %d pages (%u tiles) in %lu ms\n", count, static_cast<unsigned>(used),
                static_cast<unsigned long>(millis() - started));
}

}  // namespace page_preview
