
  let normalTileBordersSaveSequence = 0;
  function applyNormalTileBordersPreview(enabled) {
    document.querySelectorAll('.normal-tile-border-toggle').forEach(input => {
      input.checked = !!enabled;
    });
    document.querySelectorAll('.tile-grid:not(.screensaver-tile-grid)').forEach(grid => {
      grid.classList.toggle('tiles-bordered', !!enabled);
    });
  }
  async function saveNormalTileBorders(enabled) {
    const wanted = !!enabled;
    const previous = !wanted;
    const sequence = ++normalTileBordersSaveSequence;
    applyNormalTileBordersPreview(wanted);
    try {
      const response = await fetch('/api/display/tile-borders', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'enabled=' + (wanted ? '1' : '0')
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
    } catch (error) {
      if (sequence !== normalTileBordersSaveSequence) return;
      applyNormalTileBordersPreview(previous);
      showNotification(t('networkErrorSave'), false);
    }
  }

// The gear in Home's head with a bar layout (a Settings tile option): saved
// at once, the preview's head follows.
async function saveHeadGear(enabled) {
  const show = value => {
    document.querySelectorAll('.settings-head-gear').forEach(box => { box.checked = value; });
    document.querySelectorAll('.head-bar-preview .head-gear').forEach(gear => gear.classList.toggle('is-off', !value));
  };
  show(!!enabled);
  try {
    const response = await fetch('/api/display/head-gear', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'enabled=' + (enabled ? '1' : '0')
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
  } catch (error) {
    show(!enabled);
    showNotification(t('networkErrorSave'), false);
  }
}

// A layout (grid_layout.h) is read at boot: the layout window restarts the
// panel after choosing one.
function restartPanelForLayout() {
  const restartForm = document.getElementById('admin_restart_form');
  // form.submit() cannot carry the CSRF header a password-protected panel
  // requires (hardware/editor.js restartHardwareIoNow).
  if (restartForm && !window.HomeTilesAuth?.csrfToken()) {
    window.setTimeout(() => restartForm.submit(), 100);
    return;
  }
  fetch('/restart', {method: 'POST'}).catch(() => {}).finally(() => {
    window.setTimeout(() => window.location.assign('/'), 300);
  });
}
// The head bar preview's time (web_admin_html.cpp), from the browser clock
// in the panel's 12/24-hour format.
function refreshHeadBarTime() {
  const now = new Date();
  document.querySelectorAll('.head-bar-preview .head-time').forEach(el => {
    let hour = now.getHours();
    if (el.dataset.hour12 === '1') hour = hour % 12 || 12;
    el.textContent = String(hour).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  });
}
// The layout window shows the head with any layout.
if (typeof window !== 'undefined' && window.setInterval) {
  window.setInterval(refreshHeadBarTime, 30000);
}

// The fixed Circle strength (icon_glow::kDefault, user 2026-10-11: no circle
// settings): previews read the root variable --icon-glow-pct.
function currentIconGlow() {
  const raw = String(getComputedStyle(document.documentElement).getPropertyValue('--icon-glow-pct')).trim();
  const value = Number(raw);
  return raw !== '' && Number.isFinite(value) ? value : 25;
}
// The theme (ui_theme.h): the panel switches while running; every grid's
// field shows the saved choice.
let themeSaveSequence = 0;
let themeChosen = null;
// The preview follows the theme at once: the roles (--pv-*) switch with
// html[data-panel-theme], and what the script computes from them (circles,
// tints, readable icons, bars, the head circle) is computed again.
function applyPanelThemePreview(theme) {
  document.documentElement.dataset.panelTheme = theme === '1' ? 'light' : 'dark';
  const glow = currentIconGlow();
  const parse = hex => /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : null;
  const card = parse(panelVar('--tile-card', '')) || [26, 26, 26];
  // The neutral circle for tiles the script does not tint (web_admin_styles).
  const disc = toneFill(card, [255, 255, 255], false, glow, false);
  document.documentElement.style.setProperty('--icon-disc-bg',
    'rgba(' + disc.discColor.join(',') + ',' + (disc.discOpa / 255).toFixed(3) + ')');
  // The head's circle: the gear's circle over the screen (light) or the tile
  // color (dark), like home_bar.cpp.
  const headBase = panelLight() ? (panelRole('screen') || card) : card;
  document.documentElement.style.setProperty('--head-disc-color',
    toneHex(toneFill(headBase, [0x9E, 0x9E, 0x9E], false, glow, false).disc));
  tileDataLoadedTabs.forEach(tab => {
    getTilesData(tab).forEach((tile, index) => { if (tile) renderTileFromData(tab, index, tile, sensorMetaCache); });
  });
  // The parked Settings tile keeps its card color from its last render: draw
  // it again in the new theme (settings/access.js).
  const parked = document.getElementById('settingsHiddenTile');
  if (parked && typeof renderSettingsHiddenSlot === 'function') renderSettingsHiddenSlot(parked.dataset.hidden === '1');
  document.querySelectorAll('.tile').forEach(tile => applyIconDiscTint(tile));
  if (typeof currentTileTab === 'string' && currentTileTab) updateTilePreview(currentTileTab);
}
// Automatic ('2', theme_schedule.h) shows what the panel picked for the time
// of day: the answer's "effective" theme.
function shownPanelTheme() {
  return document.documentElement.dataset.panelTheme === 'light' ? '1' : '0';
}
async function saveTheme(value) {
  const theme = ['0', '1', '2'].includes(String(value)) ? String(value) : '0';
  const previous = themeChosen !== null ? themeChosen
    : (document.querySelector('.global-theme option[selected]')?.value || shownPanelTheme());
  const previousShown = shownPanelTheme();
  themeChosen = theme;
  document.querySelectorAll('.global-theme').forEach(select => { select.value = theme; });
  if (theme !== '2') applyPanelThemePreview(theme);
  const sequence = ++themeSaveSequence;
  try {
    const response = await fetch('/api/display/theme', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'theme=' + theme
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const answer = await response.json().catch(() => null);
    if (sequence !== themeSaveSequence) return;
    const shown = String(answer?.effective ?? (theme === '2' ? previousShown : theme));
    if (shown !== shownPanelTheme()) applyPanelThemePreview(shown === '1' ? '1' : '0');
  } catch (error) {
    if (sequence !== themeSaveSequence) return;
    themeChosen = previous;
    document.querySelectorAll('.global-theme').forEach(select => { select.value = previous; });
    if (previousShown !== shownPanelTheme()) applyPanelThemePreview(previousShown);
    showNotification(t('networkErrorSave'), false);
  }
}
function syncGlobalDisplayControls(tabEl) {
  if (themeChosen !== null) tabEl.querySelectorAll('.global-theme').forEach(select => { select.value = themeChosen; });
}
