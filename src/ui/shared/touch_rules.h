#pragma once

#include "src/ui/popups/popup_layout.h"

// One touch, one meaning (user 2026-10-13: the page dots opened sometimes
// and sometimes not, a held finger lost the press pill; swipes must not
// cause false input): the same distances decide a tap, a hold and a swipe
// on Home and its pages.
namespace touch_rules {

// A finger that moved further is no tap: the tile under it gets no click and
// no long press (ui_manager.cpp).
constexpr int kTapSlop = popup_layout::scale(20);
// Sideways this far a swipe turns the page; on the head's dots it is a press
// until then (home_bar.cpp).
constexpr int kSwipeDistance = popup_layout::scale(48);

}  // namespace touch_rules
