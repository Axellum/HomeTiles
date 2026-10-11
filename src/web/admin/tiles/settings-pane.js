
  // The settings panel's tabs (web_admin_html.cpp): "Tile" shows the selected
  // tile's settings, "Global" the global tile settings; the screensaver page
  // has "Tile", "Slideshow" (its picture settings, pane "global") and
  // "Global" (its tile options and design, pane "options"). Selecting a tile
  // shows its settings again; the panel's data-pane picks what admin.css
  // shows.
  function setSettingsPane(tab, pane) {
    const panel = document.getElementById(tab + 'Settings');
    if (panel) panel.dataset.pane = pane === 'tile' || pane === 'options' ? pane : 'global';
  }

  function showSettingsPane(tab, pane) {
    // The screensaver's picture settings are its background's selection.
    if (pane === 'global' && isScreensaverTileTab(tab) && typeof selectScreensaverBackground === 'function') {
      selectScreensaverBackground();
    }
    setSettingsPane(tab, pane);
  }
