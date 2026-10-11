#include "src/ui/shared/tabular_digits.h"

namespace tabular_digits {
namespace {

struct Copy {
  lv_font_t font;
  const lv_font_t* base;
  uint16_t advance;
};

// Clock, screensaver and head bar sizes (ui_fonts: 20 to 96).
constexpr int kMaxCopies = 16;
Copy g_copies[kMaxCopies];
int g_count = 0;

bool is_digit(uint32_t letter) { return letter >= '0' && letter <= '9'; }

// The base font's own lookup on the copy (same descriptor data), then every
// digit widened to the widest digit's advance and centered in it.
bool glyph_dsc(const lv_font_t* font, lv_font_glyph_dsc_t* dsc, uint32_t letter, uint32_t letter_next) {
  const Copy* copy = static_cast<const Copy*>(font->user_data);
  const bool digit = is_digit(letter);
  if (!copy->base->get_glyph_dsc(font, dsc, letter, digit || is_digit(letter_next) ? 0 : letter_next)) return false;
  if (digit && dsc->adv_w < copy->advance) {
    dsc->ofs_x = static_cast<int16_t>(dsc->ofs_x + (copy->advance - dsc->adv_w) / 2);
    dsc->adv_w = copy->advance;
  }
  return true;
}

}  // namespace

const lv_font_t* font(const lv_font_t* base) {
  if (!base || !base->get_glyph_dsc) return base;
  for (int i = 0; i < g_count; ++i) {
    if (g_copies[i].base == base) return &g_copies[i].font;
  }
  if (g_count >= kMaxCopies) return base;
  uint16_t advance = 0;
  for (uint32_t letter = '0'; letter <= '9'; ++letter) {
    lv_font_glyph_dsc_t dsc{};
    if (base->get_glyph_dsc(base, &dsc, letter, 0) && dsc.adv_w > advance) advance = dsc.adv_w;
  }
  if (!advance) return base;
  Copy& copy = g_copies[g_count++];
  copy.font = *base;
  copy.base = base;
  copy.advance = advance;
  copy.font.get_glyph_dsc = glyph_dsc;
  copy.font.user_data = &copy;
  return &copy.font;
}

}  // namespace tabular_digits
