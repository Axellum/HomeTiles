#pragma once

#include <Arduino.h>
#include <lvgl.h>

#include "src/tiles/config/tile_config.h"
#include "src/network/bridge/bridge_images_core.h"
#include "src/types/camera/picture_layout.h"

// A Camera tile can show the Bridge's picture of its entity instead of the
// icon (#50): a camera's still at an interval, an image entity's picture as
// it changes. The options live in fields the Camera tile does not use
// otherwise, so Tile and PackedTileV7 stay unchanged:
//   sensor_display_mode  1 = the picture, 0 = the icon (as before)
//   sensor_decimals      its placement (bridge_images::Fit; 0xFF = fill)
//   image_slideshow_sec  a camera's interval, 3..60 s
//   key_code             transparency of the circle and the title pill over
//                        the picture in percent (0 opaque .. 100 none)
// Over the direct link only; without it, at half height and until the first
// picture arrives the tile shows its icon and title as before.
namespace camera_picture {

constexpr uint8_t kShowIcon = 0;
constexpr uint8_t kShowPicture = 1;
constexpr uint8_t kTransparencyMax = 100;

inline bool is_image(const String& entity) { return entity.startsWith("image."); }
inline bool is_camera(const String& entity) { return entity.startsWith("camera."); }

inline bool wanted(const Tile& tile) {
  return tile.type == TILE_CAMERA && tile.sensor_display_mode == kShowPicture &&
         (is_camera(tile.sensor_entity) || is_image(tile.sensor_entity));
}

inline uint8_t fit(const Tile& tile) {
  return tile.sensor_decimals <= bridge_images::kOriginal ? tile.sensor_decimals : bridge_images::kFill;
}

inline uint8_t every(const Tile& tile) {
  const uint16_t seconds = tile.image_slideshow_sec;
  if (seconds < bridge_images::kEveryMin) return bridge_images::kEveryMin;
  if (seconds > bridge_images::kEveryMax) return bridge_images::kEveryMax;
  return static_cast<uint8_t>(seconds);
}

inline uint8_t transparency(const Tile& tile) {
  return tile.key_code > kTransparencyMax ? kTransparencyMax : tile.key_code;
}

// The Camera renderer hands a picture tile over once its card, icon and
// title exist (they show the icon look until the first picture). The tile
// keeps its own decoded pixels; everything is released with the card.
void attach(lv_obj_t* card, lv_obj_t* icon, lv_obj_t* title, const Tile& tile);

// A picture of `entity_id` arrived or was cleared (bridge_images.cpp).
void arrived(const char* entity_id);

// Loop task: keeps the picture subscriptions to the tiles that show them (a
// camera only while its tile is on screen and the display is awake) and
// decodes at most one arrived picture per call.
void service();

}  // namespace camera_picture
