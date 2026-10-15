#pragma once

// Maps the active device to its speaker board file (speaker_board.h). Only
// speaker files include this header, so adding a speaker device never
// rebuilds the rest of the firmware.

#include "src/devices/device_select.h"

// Waveshare ESP32-P4-WIFI6-Touch-LCD-7B: ES8311 codec and NS4150B amplifier
// on the PH 2.0 speaker connector, ES7210 microphone ADC for Assist capture
// and the on-panel wake word (microWakeWord on TensorFlow Lite Micro).
#if defined(DEVICE_WAVESHARE_TOUCH_LCD_7B)
#define HOMETILES_SPEAKER 1
#define HOMETILES_SPEAKER_BOARD "src/devices/waveshare_touch_lcd_7b/speaker_board.h"
#define HOMETILES_WAKE_WORD 1
// Waveshare ESP32-P4-WIFI6-Touch-LCD-8: the same codec, amplifier and
// microphone ADC on the same pins as the 7B (Waveshare BSP
// esp32_p4_wifi6_touch_lcd_x).
#elif defined(DEVICE_WAVESHARE_TOUCH_LCD_8)
#define HOMETILES_SPEAKER 1
#define HOMETILES_SPEAKER_BOARD "src/devices/waveshare_touch_lcd_8/speaker_board.h"
#define HOMETILES_WAKE_WORD 1
#endif
