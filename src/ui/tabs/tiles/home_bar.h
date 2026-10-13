#pragma once

#include <lvgl.h>
#include <stddef.h>
#include <stdint.h>

// The head bar above the tiles (layouts, grid_layout.h): the Settings screen's
// head on Home and in every folder. A circle with the page's icon, its title,
// the time, and the gear (Home: opens Settings) or the X (a folder: back to
// its parent). It replaces the Settings and Back tiles, which the shown grid
// then leaves out (shownTileLayout()).
namespace home_bar {

// The bar's places in screen pixels (the Settings head's): the Web Admin
// preview draws the same head from them (web_admin_styles.cpp).
struct Geometry {
  int disc;      // circle diameter
  int disc_x;    // circle left
  int center_y;  // the X's centre line
  int close;     // the X's (or gear's) box
  int close_x;   // its left
  int title_x;
  int title_w;
  int time_x;
  int time_w;
  int line;       // line height of the head font (the title)
  int time_line;  // line height of the time font
  // Home without the gear: the time's digits as far from the screen's right
  // edge as from its top, the title wider by as much.
  int time_x_alone;
  int title_w_alone;
};
Geometry geometry();
// The head font for the title, when it fits.
const lv_font_t* head_font();
// The time's font, a size larger than the head font (user 2026-10-08).
const lv_font_t* time_font();
// HH:MM in the panel's time format; dashes until the clock is set.
void format_time(char* out, size_t size);

// The page dots (user 2026-10-12, mockup build/design-mockups/pages): their
// size, the active one's width and the gap; the active one in the text
// color, the others light grey. The Web Admin preview draws the same.
struct DotSizes {
  int dot;
  int active;
  int gap;
};
DotSizes dot_sizes();
uint32_t dot_color(bool active);
// The row of `count` dots with `active` wide, at x, y in `parent`; the head
// and the pages' preview (page_preview.h) draw the same row.
int dots_width(int count);
lv_obj_t* create_dots(lv_obj_t* parent, int count, int active, int x, int y);

// Builds the bar into a tile grid (one floating child at the screen's top,
// in the grid's top margin). Does nothing without the head bar layout.
// Home and its pages (tile_layouts::pages, user 2026-10-12) show the page
// dots in the middle and the gear; a folder its X.
void build(lv_obj_t* grid, uint16_t folder_id);
// A swipe took over a press on the dots: their pill goes (the row never
// hears the release then).
void cancel_press();
// The pages changed: the grid's bar again, with its new dots, gear or X.
void rebuild(lv_obj_t* grid, uint16_t folder_id);
// The folder's grid became visible: a page's line is at rest on its own dot,
// wherever it came from (lead() moved it on the page when it was left).
void shown(lv_obj_t* grid, uint16_t folder_id, uint16_t previous_folder_id);
// A page turn: the shown grid's line goes over from page `from` to `to` in
// `duration` ms before the new page shows (user 2026-10-12: started after
// the new page, the dots trailed behind it). False without dots.
bool lead(lv_obj_t* grid, int from, int to, uint32_t duration);
// Any dot row's line (the pages' overview's own): from page `from` to `to`
// in `duration` ms, at rest on `to` without one.
void glide(lv_obj_t* dots, int from, int to, uint32_t duration);
// The head's dot row (its press is its own, home_bar.cpp).
bool is_dots(const lv_obj_t* obj);

// The camera's circle (camera_indicator.h, user 2026-10-08): with the head
// bar it takes the place of the camera pill. The page circle's size on the
// head's centre line, in the middle of the screen, with the webcam icon in
// `color`: a button on `parent`, the caller adds its tap and shows it.
lv_obj_t* create_camera_circle(lv_obj_t* parent, uint32_t color);
// With pages the circle sits before the time instead (user 2026-10-12);
// called whenever the indicator refreshes (the time moves with the gear).
void place_camera_circle(lv_obj_t* circle);
// Colors the circle (user 2026-10-11: the full red circle was too loud): the
// page circle's grey (page_circle_tone) with the icon readable in `color`.
// Called again when the theme changes.
void color_camera_circle(lv_obj_t* circle, uint32_t color);

// True for the bar's object among a grid's children: it is neither a tile
// nor an empty cell placeholder.
bool is_bar(const lv_obj_t* obj);
// True for the head's gear or X (or something in it): no page swipe starts
// there.
bool is_button(const lv_obj_t* obj);

}  // namespace home_bar
