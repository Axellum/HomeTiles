<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/readme-brand-dark.png">
  <img src="docs/images/readme-brand-light.png" alt="HomeTiles" height="73">
</picture>

Touch dashboards for Home Assistant on ESP32 displays.<br>
Lights, climate, sensors, energy, weather, cameras and more on a 4 to 10.1 inch touch screen.

<a href="https://galusperes.github.io/"><img src="docs/images/readme-nav-docs.png" alt="Documentation" height="42"></a>
<a href="https://galusperes.github.io/installer/"><img src="docs/images/readme-nav-flasher.png" alt="Online flasher" height="42"></a>
<a href="https://github.com/GalusPeres/HomeTiles/releases/latest"><img src="docs/images/readme-nav-release-v090.png" alt="Latest release" height="42"></a>
<a href="https://buymeacoffee.com/galusperes"><img src="docs/images/readme-nav-coffee.png" alt="Buy Me a Coffee" height="42"></a>
<a href="LICENSE"><img src="docs/images/readme-nav-license.png" alt="MIT License" height="42"></a>
<br>
<img src="docs/images/readme-hero-v090.png" alt="HomeTiles Home page on a 10.1 inch display" width="100%"><br>
Every tile opens a popup with its controls and history.

</div>

## Screenshots

### Popups

<img src="docs/images/v09-popups.png" alt="Popups for a light, climate, weather, sensor history, a lock and media" width="100%">

### Tiles

<img src="docs/images/v09-tiles.png" alt="Tiles for weather, lights, a fan, sensors, a vacuum, a lock, a coffee machine and status chips" width="100%">

### Web Admin

Build the dashboard in the browser; the Web Admin preview matches the display.

<img src="docs/images/v09-webadmin-home.png" alt="Web Admin with the live preview of the Home page and its page fields" width="100%">

## New in v0.9.0

- **[Direct link to Home Assistant](https://galusperes.github.io/installer/#set-up-the-display):** press Pair on the display and add it in Home Assistant. No MQTT broker needed; existing MQTT setups keep working.
- **[Head bar and pages](https://galusperes.github.io/device-ui/#head-bar-and-pages):** fewer, larger tiles under a head with title, time and gear, up to five folders as pages beside Home, and an [upright layout](https://galusperes.github.io/device-ui/#layouts) for ESP32-P4 displays.
- **[Light theme](https://galusperes.github.io/device-ui/#light-theme):** Dark, Light or Automatic, on the display and in the Web Admin.
- **[New Settings](https://galusperes.github.io/device-ui/#settings):** on the display, with a first-start setup in four steps.
- **[Entity picker](https://galusperes.github.io/web-admin/#creating-a-tile):** searches every entity like Home Assistant, with Recent and Favorites on top.
- **[Clock](https://galusperes.github.io/tiles/#clock) and [Camera](https://galusperes.github.io/tiles/#camera) tiles:** analog and wall clocks, camera tiles that show the picture, and cameras in full screen.

Before updating, update HomeTiles Bridge to **v0.9.0** and [export your dashboard](https://galusperes.github.io/updating/). [All changes](docs/releases/v0.9.0.md)

## Get started

You need a compatible display, Home Assistant and [HomeTiles Bridge](https://github.com/GalusPeres/HomeTiles-Bridge).

1. Find your exact model in the [device list](https://galusperes.github.io/#device-support).
2. Follow the [installation](https://galusperes.github.io/installer/): flash the display in the browser, install the Bridge, pair the display and add your tiles.

## Help

[Firmware updates](https://galusperes.github.io/updating/) · [Troubleshooting](https://galusperes.github.io/faq/) · [Report a problem](https://github.com/GalusPeres/HomeTiles/issues) · [Contribute](CONTRIBUTING.md) · [Architecture](ARCHITECTURE.md)

HomeTiles is free and open source under the [MIT License](LICENSE).
