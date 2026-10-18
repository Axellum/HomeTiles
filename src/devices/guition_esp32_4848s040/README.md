# GUITION ESP32-4848S040

Supported HomeTiles target for the GUITION/Jingcai
`ESP32-4848S040C_I` family:

- ESP32-S3, 16 MB flash and 8 MB octal PSRAM
- 480 x 480 ST7701 RGB panel
- GT911 capacitive touch
- PWM backlight on GPIO 38
- microSD card in SPI mode

The pin mapping and panel configuration were cross-checked against:

- [GUITION's product documentation](https://www.guition.com/esp32-display-module/4-inch-esp32s3-display-module)
- [Espressif's Apache-2.0 `ESP32_Display_Panel` board definition](https://github.com/esp-arduino-libs/ESP32_Display_Panel)
- [Arduino_GFX's BSD-licensed `ESP32_4848S040_86BOX_GUITION` example](https://github.com/moononournation/Arduino_GFX)
- [public hardware reports for the same board family](https://github.com/arendst/Tasmota/discussions/20527)

HomeTiles uses Arduino_GFX's included ST7701 type-9 initialization table.
No code from the PolyForm Noncommercial-licensed EspControl repository is
included here.

The release profile uses a conservative 10 MHz RGB pixel clock and selects the
scanout mode from the SDK capabilities:

- Stock Arduino SDK: direct PSRAM framebuffer (`bounce_buffer_size_px = 0`),
  matching Arduino_GFX's example for this exact panel. LittleFS transactions
  briefly blank the backlight, then explicitly restart the RGB DMA at the next
  VSYNC before revealing a clean frame. This resets a scan position that can
  otherwise remain wrapped after the flash write.
- High-performance S3 SDK: ten-line bounce buffers when PSRAM XIP and a 64-byte
  cache line are both enabled, matching Espressif's documented RGB drift fix
  and its [Jingcai test configuration](https://github.com/esp-arduino-libs/ESP32_Display_Panel/blob/master/test_apps/board/jingcai/sdkconfig.defaults.esp32s3).

This distinction is required because the cache-fed bounce path cannot continue
while the stock SDK disables the external-memory cache for main-flash writes.
See Espressif's [RGB LCD documentation](https://docs.espressif.com/projects/esp-idf/en/v5.5.1/esp32s3/api-reference/peripherals/lcd/rgb_lcd.html).

## Shared driver

This driver also runs boards built like this one
(`DEVICE_GUITION_ESP32_4848S040_FAMILY` in `src/devices/device_select.h`, for
example the Golden Security GS-T3E v2). Everything the boards differ in lives
in one constexpr `kBoard` description per exact board (`st7701_s3_board.h`):
log name, ST7701 SPI pins, RGB pins, init table, PCLK edge, backlight pin and
PWM rate, GT911 pins and the microSD wiring. This board's description is in
`device_guition_esp32_4848s040.h`; the driver API is `st7701_s3_driver.h`.
Without an SD card every SD path is a no-op; the flash-write display guards
apply to every board.
