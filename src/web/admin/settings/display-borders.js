
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

// Icon discs are a root class: every preview grid, including cached and lazily
// inserted folders, follows it without re-rendering a tile.
let iconDiscsSaveSequence = 0;
function iconDiscsEnabled() {
  return !document.documentElement.classList.contains('icon-discs-off');
}
function applyIconDiscsPreview(enabled) {
  document.documentElement.classList.toggle('icon-discs-off', !enabled);
  document.querySelectorAll('.global-icon-disc-toggle').forEach(input => {
    input.checked = !!enabled;
  });
  // A dark icon is lifted against its circle or, without one, the tile.
  document.querySelectorAll('.tile').forEach(tile => applyIconDiscTint(tile));
}
async function saveIconDiscs(enabled) {
  const wanted = !!enabled;
  const sequence = ++iconDiscsSaveSequence;
  applyIconDiscsPreview(wanted);
  try {
    const response = await fetch('/api/display/icon-discs', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'enabled=' + (wanted ? '1' : '0')
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
  } catch (error) {
    if (sequence !== iconDiscsSaveSequence) return;
    applyIconDiscsPreview(!wanted);
    showNotification(t('networkErrorSave'), false);
  }
}

// Glow strength of colored icon discs: previews read the root variable
// --icon-glow-pct (applyIconDiscTint); the device rebuilds its tiles after
// the save. Range and step mirror icon_glow.h.
let iconGlowConfirmed = null;
let iconGlowSaveSequence = 0;
function currentIconGlow() {
  const raw = String(getComputedStyle(document.documentElement).getPropertyValue('--icon-glow-pct')).trim();
  const value = Number(raw);
  return raw !== '' && Number.isFinite(value) ? value : 25;
}
function previewIconGlowLive(value) {
  const number = Math.round(Number(value) / 5) * 5;
  const percent = Math.min(100, Math.max(0, Number.isFinite(number) ? number : 25));
  if (iconGlowConfirmed === null) iconGlowConfirmed = currentIconGlow();
  document.documentElement.style.setProperty('--icon-glow-pct', String(percent));
  document.querySelectorAll('.global-icon-glow').forEach(input => { input.value = String(percent); });
  document.querySelectorAll('.global-icon-glow-value').forEach(output => { output.textContent = percent + ' %'; });
  document.querySelectorAll('.tile').forEach(tile => applyIconDiscTint(tile));
  return percent;
}
async function saveIconGlow(value) {
  const percent = previewIconGlowLive(value);
  const sequence = ++iconGlowSaveSequence;
  try {
    const response = await fetch('/api/display/icon-glow', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'percent=' + percent
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (sequence === iconGlowSaveSequence) iconGlowConfirmed = percent;
  } catch (error) {
    if (sequence !== iconGlowSaveSequence) return;
    const confirmed = iconGlowConfirmed;
    iconGlowConfirmed = null;
    if (confirmed !== null) previewIconGlowLive(confirmed);
    showNotification(t('networkErrorSave'), false);
  }
}

// The global default tile color paints every tile without its own color
// through --tile-default-bg; reset and new tiles take it as their default.
let defaultTileColorConfirmed = null;
let defaultTileColorSaveSequence = 0;
function currentDefaultTileColor() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--tile-default-bg').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '#2A2A2A';
}
function previewDefaultTileColor(value) {
  const color = String(value || '').trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) return;
  if (defaultTileColorConfirmed === null) {
    defaultTileColorConfirmed = currentDefaultTileColor();
  }
  document.documentElement.style.setProperty('--tile-default-bg', color);
  Object.values(typeof TILE_TYPE_REGISTRY === 'object' ? TILE_TYPE_REGISTRY : {})
    .forEach(meta => { if (meta && meta.sharedBg) meta.defaultBg = color; });
  // Circles are opaque steps above their tile (tone_color.h): recompute them
  // for the new background.
  if (typeof applyIconDiscTint === 'function') document.querySelectorAll('.tile').forEach(tile => applyIconDiscTint(tile));
  document.querySelectorAll('.global-tile-color').forEach(input => { input.value = color; });
  // Open editors of tiles without their own color show the new default.
  document.querySelectorAll('input[type="color"][id$="_tile_color"]').forEach(input => {
    if (input.dataset.bgColorDefault !== '1') return;
    const tab = input.id.slice(0, -'_tile_color'.length);
    const type = document.getElementById(tab + '_tile_type')?.value || '0';
    if (getTileTypeMeta(type).sharedBg) input.value = color;
  });
  return color;
}
async function saveDefaultTileColor(value) {
  const color = previewDefaultTileColor(value);
  if (!color) return;
  const sequence = ++defaultTileColorSaveSequence;
  try {
    const response = await fetch('/api/display/tile-color', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({color}).toString()
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const result = await response.json();
    if (!result.success || String(result.color).toUpperCase() !== color) {
      throw new Error('invalid response');
    }
    if (sequence === defaultTileColorSaveSequence) defaultTileColorConfirmed = color;
  } catch (error) {
    if (sequence !== defaultTileColorSaveSequence) return;
    previewDefaultTileColor(defaultTileColorConfirmed || color);
    showNotification(t('networkErrorSave'), false);
  }
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
  // The tile's Design field shows while the panel can be light.
  if (typeof syncTileDesign === 'function' && typeof currentTileTab === 'string' && currentTileTab) syncTileDesign(currentTileTab);
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
// Light theme: tinted tiles in the dark design while tinted (tile_surface);
// html[data-dark-tinted] tells the preview (grid-preview.js tileSurfaceOf).
let darkTintedSaveSequence = 0;
function darkTintedEnabled() {
  return document.documentElement.dataset.darkTinted === '1';
}
function applyDarkTintedPreview(enabled) {
  if (enabled) document.documentElement.dataset.darkTinted = '1';
  else delete document.documentElement.dataset.darkTinted;
  document.querySelectorAll('.global-dark-tinted-toggle').forEach(input => { input.checked = !!enabled; });
  tileDataLoadedTabs.forEach(tab => {
    getTilesData(tab).forEach((tile, index) => { if (tile) renderTileFromData(tab, index, tile, sensorMetaCache); });
  });
  if (typeof currentTileTab === 'string' && currentTileTab) updateTilePreview(currentTileTab);
}
async function saveDarkTinted(enabled) {
  const wanted = !!enabled;
  const sequence = ++darkTintedSaveSequence;
  applyDarkTintedPreview(wanted);
  try {
    const response = await fetch('/api/display/dark-tinted', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'enabled=' + (wanted ? '1' : '0')
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
  } catch (error) {
    if (sequence !== darkTintedSaveSequence) return;
    applyDarkTintedPreview(!wanted);
    showNotification(t('networkErrorSave'), false);
  }
}
function syncGlobalDisplayControls(tabEl) {
  tabEl.querySelectorAll('.global-icon-disc-toggle').forEach(input => {
    input.checked = iconDiscsEnabled();
  });
  const color = currentDefaultTileColor();
  tabEl.querySelectorAll('.global-tile-color').forEach(input => { input.value = color; });
  const glow = currentIconGlow();
  tabEl.querySelectorAll('.global-icon-glow').forEach(input => { input.value = String(glow); });
  tabEl.querySelectorAll('.global-icon-glow-value').forEach(output => { output.textContent = glow + ' %'; });
  if (themeChosen !== null) tabEl.querySelectorAll('.global-theme').forEach(select => { select.value = themeChosen; });
  tabEl.querySelectorAll('.global-dark-tinted-toggle').forEach(input => { input.checked = darkTintedEnabled(); });
}

// The shared root variables also reach cached and lazily inserted folder grids.
let tileRadiusConfirmed = null;
let tileRadiusWanted = null;
let tileRadiusSaving = false;
let tileRadiusRevision = 0;
let tileRadiusPreviewTimer = null;
let tileRadiusLiveWanted = null;
function previewTileRadiusLive(value) {
  const radius = previewTileRadius(value);
  tileRadiusLiveWanted = radius;
  if (tileRadiusPreviewTimer === null) tileRadiusPreviewTimer = setTimeout(() => {
    tileRadiusPreviewTimer = null;
    queueTileRadius(tileRadiusLiveWanted, false);
  }, 80);
}
function previewTileRadius(value) {
  const input = document.querySelector('.global-tile-radius');
  if (!input) return;
  const radius = Math.max(Number(input.min), Math.min(Number(input.max), Math.round(Number(value))));
  if (!Number.isFinite(radius)) return;
  const root = document.documentElement;
  if (tileRadiusConfirmed === null) {
    tileRadiusConfirmed = Number(getComputedStyle(root).getPropertyValue('--tile-radius-device'));
  }
  const scale = Number(getComputedStyle(root).getPropertyValue('--radius-preview-scale'));
  // Unrounded like the server's --tile-radius: the corner disc is concentric
  // with the card corner only at the exact device radius.
  root.style.setProperty('--tile-radius', (radius * scale).toFixed(2) + 'px');
  root.style.setProperty('--tile-radius-device', String(radius));
  document.querySelectorAll('.global-tile-radius').forEach(control => { control.value = radius; });
  document.querySelectorAll('.global-tile-radius-value').forEach(output => { output.textContent = radius; });
  tileRadiusRevision++;
  return radius;
}
function saveTileRadius(value) {
  clearTimeout(tileRadiusPreviewTimer);
  tileRadiusPreviewTimer = null;
  return queueTileRadius(value, true);
}
async function queueTileRadius(value, persist) {
  const radius = previewTileRadius(value);
  if (radius === undefined) return;
  tileRadiusWanted = { radius, persist };
  if (tileRadiusSaving) return;
  tileRadiusSaving = true;
  try {
    while (tileRadiusWanted !== null) {
      const wanted = tileRadiusWanted;
      const revision = tileRadiusRevision;
      tileRadiusWanted = null;
      try {
        const response = await fetch('/api/display/tile-radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ radius: String(wanted.radius), preview: wanted.persist ? '0' : '1' }).toString()
        });
        if (!response.ok) throw new Error('save failed');
        const result = await response.json();
        if (!result.success || result.radius !== wanted.radius) throw new Error('invalid response');
        if (wanted.persist) tileRadiusConfirmed = wanted.radius;
      } catch (error) {
        if (tileRadiusWanted === null && revision === tileRadiusRevision) {
          previewTileRadius(tileRadiusConfirmed);
          showNotification(t('networkErrorSave'), false);
        }
      }
    }
  } finally { tileRadiusSaving = false; }
}
function syncTileRadiusControls(tabEl) {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--tile-radius-device').trim();
  tabEl.querySelectorAll('.global-tile-radius').forEach(control => { control.value = value; });
  tabEl.querySelectorAll('.global-tile-radius-value').forEach(output => { output.textContent = value; });
}
