#include "src/types/camera/web_html.h"

#include "src/core/config/config_manager.h"
#include "src/core/i18n/i18n.h"
#include "src/types/switch/web_html.h"
#include "src/web/server/web_admin_utils.h"

// The entity is a camera or an image (the screensaver picture's list). With
// "Picture" the tile shows the Bridge's picture of it (picture.h): its
// placement, a camera's interval and the transparency of the circle and the
// title pill; the editor shows those rows only for a picture
// (syncCameraFields in types/camera/admin.js).
void append_camera_fields_html(String& html, const String& tab_id) {
  const auto& tr = i18n::strings(configManager.getConfig().language);
  html += R"html(
            <div id=")html";
  html += tab_id;
  html += R"html(_camera_fields" class="type-fields">
              )html";
  appendEntityPickerField(html, tab_id, "camera_entity", tr.screensaver_picture_entity, "images");
  html += "\n";
  const SwitchChoice shows[] = {{"0", tr.camera_show_icon}, {"1", tr.camera_show_picture}};
  append_switch_choice(html, tab_id, "camera_display", tr.camera_show, shows, 2);
  html += R"html(              <div id=")html";
  html += tab_id;
  html += R"html(_camera_picture_fields" class="camera-picture-fields hidden">
)html";
  const SwitchChoice fits[] = {{"fill", tr.screensaver_fit_fill},
                               {"fit", tr.screensaver_fit_contain},
                               {"original", tr.screensaver_fit_original}};
  append_switch_choice(html, tab_id, "camera_fit", tr.screensaver_picture_fit, fits, 3);
  // A camera's interval; an image entity sends each new picture at once.
  html += R"html(              <div id=")html";
  html += tab_id;
  html += R"html(_camera_every_row" class="hidden"><label for=")html";
  html += tab_id;
  html += R"html(_camera_every">)html";
  appendHtmlEscaped(html, tr.screensaver_picture_every);
  html += R"html(</label><input type="number" id=")html";
  html += tab_id;
  html += R"html(_camera_every" min="3" max="60" step="1" value="10"></div>
              <label class="tile-radius-control camera-transparency-control"><span>)html";
  appendHtmlEscaped(html, tr.camera_head_transparency);
  html += R"html(</span><input type="range" id=")html";
  html += tab_id;
  html += R"html(_camera_transparency" min="0" max="100" step="5" value="0"><output id=")html";
  html += tab_id;
  html += R"html(_camera_transparency_value" class="global-tile-opacity-value">0 %</output></label>
              <p class="hint">)html";
  appendHtmlEscaped(html, tr.screensaver_picture_hint);
  html += R"html(</p>
              </div>
            </div>
)html";
}
