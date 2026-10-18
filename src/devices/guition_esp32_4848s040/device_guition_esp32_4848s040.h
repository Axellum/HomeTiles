#pragma once

#include "src/devices/device_types.h"
#include "src/devices/guition_esp32_4848s040/hardware_io_profile.h"
#include "src/devices/guition_esp32_4848s040/st7701_s3_board.h"
#include "src/devices/guition_esp32_4848s040/st7701_s3_driver.h"

namespace DeviceGuitionESP324848S040 {

inline constexpr Device::Profile kProfile{
    "guition_esp32_4848s040",
    "GUITION ESP32-4848S040",
    480,
    480,
    4,
    4,
    10,
    3,
    111,
    111,
    4,
    // Hardware-calibrated lower visible limit: with the former raw 3..255
    // mapping the first reliably visible setting was 15 %, i.e. raw 39.
    // Raw 0 remains reserved for deliberately switching the backlight off.
    39,
    Device::RotationStepMode::QuarterTurns,
    2,
    0,
    Device::Capabilities{false, false, false, false, false, false},
    kHardwareIoProfile,
};

// Board description of the shared ST7701 S3 driver (see README.md).
inline constexpr St7701S3Board::Description kBoard{
    "GUITION ESP32-4848S040",
    // ST7701 SPI command bus: CS39, SCK48, MOSI47. SCK/MOSI are shared with
    // the microSD card, which uses CS42.
    39,
    48,
    47,
    St7701S3Board::RgbPins{
        18,  // DE
        17,  // VSYNC
        16,  // HSYNC
        21,  // PCLK
        {11, 12, 13, 14, 0},
        {8, 20, 3, 46, 9, 10},
        {4, 5, 6, 7, 15},
    },
    St7701S3Board::PanelInit::Type9,
    "type9-cd00",
    // Arduino_GFX's exact-board profile samples on the rising edge.
    false,
    // GPIO38 switches the board's backlight driver on and off as a whole. At
    // the former 1 kHz that switching and its harmonics sit in the ear's most
    // sensitive range, and the driver whines whenever the backlight is dimmed
    // (Issue #45: silent at duty 0, silent with EspControl on the same
    // board). Ultrasonic rates do not work on this board: EspControl's former
    // 20 kHz setting made every level below roughly 85 % go dark, and openHASP
    // users settled on 100 Hz. 150 Hz matches EspControl's current exact-board
    // value, chosen there over the visible shimmer at 100 Hz, and the ESPHome
    // device page. The 10-bit resolution is unchanged (40 MHz XTAL divider
    // ~260), so the raw 0..255 mapping and the calibrated visible floor stay
    // identical; each pulse only gets longer at the same duty.
    38,
    150,
    // GT911 I2C: SDA19, SCL45.
    19,
    45,
    // microSD in SPI mode: SCK48, MISO41, MOSI47, CS42.
    true,
    St7701S3Board::SdSpiPins{48, 41, 47, 42},
};

}  // namespace DeviceGuitionESP324848S040
