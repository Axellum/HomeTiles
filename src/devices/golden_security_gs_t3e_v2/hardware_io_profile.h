#pragma once

#include "src/devices/hardware_io_profile.h"

namespace DeviceGoldenSecurityGST3EV2 {

// No configurable GPIOs yet. The relay outputs differ between the published
// variants (openHASP: EU v2.3 GPIO45/46/44, CN 4-gang GPIO1/2/46/45; ESPHome:
// EU v2.4 GPIO45/46/2), and GPIO43/44 also carry the UART0 log. They stay
// unexposed until a board owner confirms them.
inline constexpr Device::HardwareIoProfile kHardwareIoProfile{};

}  // namespace DeviceGoldenSecurityGST3EV2
