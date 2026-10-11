
function getClockPreviewLanguage() {
    return document.getElementById('language')?.value || document.documentElement.lang || 'en';
  }

  function normalizeClockTimeFormat(raw) {
    const num = Number(raw);
    return (num === 1 || num === 2) ? num : 0;
  }

  function normalizeClockDateFormat(raw) {
    const num = Number(raw);
    return (Number.isInteger(num) && num >= 1 && num <= 7) ? num : 0;
  }

  // clock_tile::unpack_date_options / pack_date_options: bits 0-7 the date
  // format, 8-9 the weekday (0 none, 1 short, 2 long), bit 10 rolling digits,
  // 11-12 the alignment (0 centered, 1 left, 2 right).
  function clockDateOptions(raw) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return {format: 0, weekday: 0, roll: false, align: 0};
    const weekday = (num >> 8) & 3;
    const align = (num >> 11) & 3;
    return {format: normalizeClockDateFormat(num & 0xFF), weekday: weekday <= 2 ? weekday : 0,
      roll: ((num >> 10) & 1) === 1, align: align <= 2 ? align : 0};
  }
  function packClockDateOptions(format, weekday, roll, align = 0) {
    const day = Number(weekday), side = Number(align);
    return normalizeClockDateFormat(format) | ((day === 1 || day === 2 ? day : 0) << 8) | (roll ? 1024 : 0)
      | ((side === 1 || side === 2 ? side : 0) << 11);
  }
  // The tile's alignment in the preview (renderer.cpp render_clock_tile).
  function applyClockPreviewAlign(tileElem, align) {
    if (!tileElem || !tileElem.classList) return;
    tileElem.classList.toggle('clock-align-left', Number(align) === 1);
    tileElem.classList.toggle('clock-align-right', Number(align) === 2);
  }

  // "Auto" shows the panel's format (Settings, Localization), like the
  // device (clock_tile::resolve_time_format); the language only without it.
  function resolveClockTimeFormat(raw) {
    const safe = normalizeClockTimeFormat(raw);
    if (safe !== 0) return safe;
    if (typeof PANEL_TIME_FORMAT === 'number' && [1, 2].includes(PANEL_TIME_FORMAT)) return PANEL_TIME_FORMAT;
    return getClockPreviewLanguage().toLowerCase().startsWith('de') ? 1 : 2;
  }

  function resolveClockDateFormat(raw) {
    const safe = normalizeClockDateFormat(raw);
    if (safe !== 0) return safe;
    if (typeof PANEL_DATE_FORMAT === 'number' && [1, 2, 3].includes(PANEL_DATE_FORMAT)) return PANEL_DATE_FORMAT;
    return getClockPreviewLanguage().toLowerCase().startsWith('de') ? 1 : 2;
  }

  // tabular_digits (src/ui/shared/tabular_digits.cpp): every digit as wide as
  // the widest one and centered in it, so the time never shifts. The Admin's
  // Inter has no tabular figures (a subset without features): a box per digit
  // (.tnum, the width of Inter's widest digit, the 4) does it like the panel.
  const CLOCK_HTML_ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  function clockDigitsHtml(text) {
    return Array.from(String(text), ch => (ch >= '0' && ch <= '9'
      ? '<span class="tnum">' + ch + '</span>' : (CLOCK_HTML_ESCAPES[ch] || ch))).join('');
  }
  function setClockDigits(el, text) {
    if (!el) return;
    const html = clockDigitsHtml(text);
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  function getClockPreviewTime(rawFormat) {
    const now = new Date();
    const format = resolveClockTimeFormat(rawFormat);
    if (format === 2) {
      let hh = now.getHours() % 12;
      if (hh === 0) hh = 12;
      const mm = String(now.getMinutes()).padStart(2, '0');
      return String(hh) + ':' + mm + (now.getHours() < 12 ? ' AM' : ' PM');
    }
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  // clock_tile::format_date_line: the weekday (CLOCK_I18N, the panel's
  // language) and the date in its format.
  function getClockPreviewDate(rawFormat, weekday = 0, showDate = true) {
    const now = new Date();
    const format = resolveClockDateFormat(rawFormat);
    const texts = typeof CLOCK_I18N === 'object' && CLOCK_I18N ? CLOCK_I18N : null;
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    let date = '';
    if (showDate) {
      if (format === 2) date = mm + '/' + dd + '/' + yyyy;
      else if (format === 3) date = yyyy + '/' + mm + '/' + dd;
      else if (format === 4) date = dd + '/' + mm + '/' + yyyy;
      else if (format === 5) date = dd + '.' + mm + '.';
      else if (format === 6 || format === 7) {
        const month = (texts && texts.months && texts.months[now.getMonth()]) || mm;
        date = String((texts && texts.pattern) || '{d} {M}').replace('{d}', String(now.getDate())).replace('{M}', month)
          + (format === 7 ? ' ' + yyyy : '');
      } else date = dd + '.' + mm + '.' + yyyy;
    }
    const day = Number(weekday);
    const list = day === 2 ? texts?.weekdays : day === 1 ? texts?.weekdaysShort : null;
    const name = (list && list[now.getDay()]) || '';
    return name && date ? name + ', ' + date : (name || date);
  }

  function normalizeClockPreviewFont(raw, fallback) {
    const num = Number(raw);
    switch (num) {
      case 20:
      case 24:
      case 28:
      case 32:
      case 40:
      case 48:
      case 56:
      case 64:
      case 72:
      case 80:
      case 96:
        return num;
      default:
        return fallback;
    }
  }

  function getClockPreviewCssPx(raw, fallback, el) {
    const n = normalizeClockPreviewFont(raw, fallback);
    // Same scaling as the CSS variables (LVGL pixels * preview factor), as the
    // tile's own grid sets them (a grid may scale its preview).
    const v = parseFloat(getComputedStyle(el?.isConnected ? el : document.documentElement).getPropertyValue('--fs' + n));
    return (v > 0) ? v : Math.round(n / 2);
  }

  // Each clock line is as tall as its LVGL font's line height, with the
  // glyphs on the LVGL baseline (--lh/--ldy, web_admin_styles.cpp).
  function clockPreviewLineCss(size) {
    return 'line-height:var(--lh' + size + '); top:var(--ldy' + size + ', 0px);';
  }

  function applyClockPreviewLine(el, size, px) {
    el.style.fontSize = px + 'px';
    el.style.lineHeight = 'var(--lh' + size + ')';
    el.style.top = 'var(--ldy' + size + ', 0px)';
  }

  function getClockPreviewTextStyle(raw, fallback, color) {
    const font = normalizeClockPreviewFont(raw, fallback);
    const size = getClockPreviewCssPx(raw, fallback);
    const safeColor = color || panelRoleHex('text', '#fff');
    return 'data-clock-font="' + font + '" style="font-size:' + size + 'px; ' +
      clockPreviewLineCss(font) + ' color:' + safeColor + ';"';
  }

  function applyClockPreviewTextStyle(el, raw, fallback, color) {
    if (!el) return;
    const font = normalizeClockPreviewFont(raw, fallback);
    el.dataset.clockFont = String(font);
    applyClockPreviewLine(el, font, getClockPreviewCssPx(raw, fallback, el));
    el.style.color = color || panelRoleHex('text', '#fff');
  }

  function normalizeClockFlags(raw) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return 1;
    const flags = num & 3;
    return flags === 0 ? 1 : flags;
  }

  function getClockFlagsFromInputs(prefix) {
    const timeEl = document.getElementById(prefix + '_clock_show_time');
    const dateEl = document.getElementById(prefix + '_clock_show_date');
    let flags = 0;
    if (timeEl && timeEl.checked) flags |= 1;
    if (dateEl && dateEl.checked) flags |= 2;
    if (flags === 0) flags = 1;
    return flags;
  }

  function applyClockFlagsToInputs(prefix, flags) {
    const safe = normalizeClockFlags(flags);
    const timeEl = document.getElementById(prefix + '_clock_show_time');
    const dateEl = document.getElementById(prefix + '_clock_show_date');
    if (timeEl) timeEl.checked = (safe & 1) !== 0;
    if (dateEl) dateEl.checked = (safe & 2) !== 0;
  }

  function ensureClockSelection(prefix) {
    const timeEl = document.getElementById(prefix + '_clock_show_time');
    const dateEl = document.getElementById(prefix + '_clock_show_date');
    if (!timeEl || !dateEl) return;
    if (!timeEl.checked && !dateEl.checked) timeEl.checked = true;
  }

  function loadClockFields(tab, data) {
    loadIconColorFields(tab, data);
    const border = document.getElementById(tab + '_clock_tile_border');
    if (border) border.checked = data?.tile_border !== undefined ? !['0','false'].includes(String(data.tile_border)) : Number(data?.sensor_display_mode) !== 1;
    const timeFontEl = document.getElementById(tab + '_clock_time_font');
    if (timeFontEl) {
      const timeFont = (data && data.key_code !== undefined) ? Number(data.key_code) : 40;
      timeFontEl.value = String(timeFont);
    }
    const dateFontEl = document.getElementById(tab + '_clock_date_font');
    if (dateFontEl) {
      const storedDateFont = (data && data.key_modifier !== undefined)
        ? Number(data.key_modifier) : 20;
      const dateFont = Math.min(72, storedDateFont || 20);
      dateFontEl.value = String(dateFont);
    }
    const timeFormatEl = document.getElementById(tab + '_clock_time_format');
    if (timeFormatEl) {
      const timeFormat = (data && data.sensor_gauge_min !== undefined) ? data.sensor_gauge_min : (data ? data.clock_time_format : 0);
      timeFormatEl.value = String(timeFormat !== undefined ? timeFormat : 0);
    }
    // The date format, the weekday and rolling digits in one value.
    const dateOptions = clockDateOptions((data && data.sensor_gauge_max !== undefined)
      ? data.sensor_gauge_max : (data ? data.clock_date_format : 0));
    const dateFormatEl = document.getElementById(tab + '_clock_date_format');
    if (dateFormatEl) dateFormatEl.value = String(dateOptions.format);
    const weekdayEl = document.getElementById(tab + '_clock_weekday');
    if (weekdayEl) weekdayEl.value = String(dateOptions.weekday);
    const rollEl = document.getElementById(tab + '_clock_roll');
    if (rollEl) rollEl.checked = dateOptions.roll;
    const alignEl = document.getElementById(tab + '_clock_align');
    if (alignEl) alignEl.value = String(dateOptions.align);
    if (data && (data.clock_show_time !== undefined || data.clock_show_date !== undefined)) {
      const showTime = String(data.clock_show_time || '0') === '1';
      const showDate = String(data.clock_show_date || '0') === '1';
      let flags = 0;
      if (showTime) flags |= 1;
      if (showDate) flags |= 2;
      if (flags === 0) flags = 1;
      applyClockFlagsToInputs(tab, flags);
      return;
    }
    const flags = (data && data.clock_flags !== undefined && data.clock_flags !== null)
      ? data.clock_flags
      : (data ? data.sensor_decimals : 1);
    applyClockFlagsToInputs(tab, flags);
  }

  function updateClockValuePreview(tab) {
    if (currentTileIndex === -1) return;
    const prefix = tab;
    const tileId = tab + '-tile-' + currentTileIndex;
    const tileElem = document.getElementById(tileId);
    if (!tileElem) return;

    const flags = getClockFlagsFromInputs(prefix);
    const timeFont = document.getElementById(prefix + '_clock_time_font')?.value || '40';
    const dateFont = Math.min(72,
      Number(document.getElementById(prefix + '_clock_date_font')?.value || 20));
    const timeFormat = document.getElementById(prefix + '_clock_time_format')?.value || '0';
    const dateFormat = document.getElementById(prefix + '_clock_date_format')?.value || '0';
    const weekday = Number(document.getElementById(prefix + '_clock_weekday')?.value || 0);
    const timeEl = tileElem.querySelector('.tile-clock-time');
    const dateEl = tileElem.querySelector('.tile-clock-date');

    const needsTime = (flags & 1) !== 0;
    // The date line also holds a weekday alone.
    const needsDate = (flags & 2) !== 0 || weekday !== 0;
    if ((needsTime && !timeEl) || (needsDate && !dateEl) || (!needsTime && timeEl) || (!needsDate && dateEl)) {
      updateTilePreview(tab);
      return;
    }

    if (timeEl) {
      setClockDigits(timeEl, getClockPreviewTime(timeFormat));
      applyClockPreviewTextStyle(timeEl, timeFont, 40, panelRoleHex('text', '#fff'));
    }
    if (dateEl) {
      // The panel's date digits are fixed-width too (tabular_digits, both lines).
      setClockDigits(dateEl, getClockPreviewDate(dateFormat, weekday, (flags & 2) !== 0));
      applyClockPreviewTextStyle(dateEl, dateFont, 20, panelRoleHex('text', '#fff'));
    }
    fitCompactClockPreview(tileElem);
  }

  const CLOCK_PREVIEW_FONT_SIZES = [20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96];
  let clockPreviewMeasureContext = null;

  function measureClockPreviewText(el, text, px) {
    clockPreviewMeasureContext = clockPreviewMeasureContext ||
      document.createElement('canvas').getContext('2d');
    if (!clockPreviewMeasureContext) return 0;
    const style = getComputedStyle(el);
    clockPreviewMeasureContext.font = style.fontWeight + ' ' + px + 'px ' + style.fontFamily;
    return clockPreviewMeasureContext.measureText(text).width;
  }

  // The panel's width of a text in the preview: the browser width scaled by
  // the LVGL width of the sample "88:88 PM" in that font (--tw<size>,
  // web_admin_styles.cpp). The browser's Inter runs a few percent wider than
  // the panel's (user 2026-10-11: "8:01 PM" wrapped only in the preview).
  const CLOCK_WIDTH_SAMPLE = '88:88 PM';
  function clockPanelTextWidth(el, text, size, px, scope) {
    const browser = measureClockPreviewText(el, text, px);
    const lvgl = parseFloat(getComputedStyle(scope?.isConnected ? scope : document.documentElement)
      .getPropertyValue('--tw' + size));
    const sample = measureClockPreviewText(el, CLOCK_WIDTH_SAMPLE, px);
    return lvgl > 0 && sample > 0 ? browser * lvgl / sample : browser;
  }

  // Worst-case samples keep the chosen size stable while the time changes.
  function clockPreviewSample(el, isTime) {
    return isTime ? (/[AP]M/.test(el.textContent) ? '88:88 PM' : '88:88')
      : el.textContent.replace(/[0-9]/g, '8');
  }

  // Half-height clocks use one row: the largest configured-or-smaller size whose
  // rendered size fits 80% of the tile height and whose text fits the width.
  // The date follows only from width 2 and only when it still fits.
  // The firmware applies the same rule (fit_compact_clock in clock/renderer.cpp).
  function fitCompactClockPreview(tileElem) {
    if (!tileElem) return;
    const lines = [tileElem.querySelector('.tile-clock-time'), tileElem.querySelector('.tile-clock-date')];
    lines.forEach(el => {
      if (!el) return;
      el.hidden = false;
      const font = normalizeClockPreviewFont(el.dataset.clockFont, 40);
      applyClockPreviewLine(el, font, getClockPreviewCssPx(font, 40, tileElem));
    });
    const style = getComputedStyle(tileElem);
    // The tile's own grid sizes (inherited variables), not the page's.
    const root = tileElem.isConnected ? style : getComputedStyle(document.documentElement);
    const cellW = parseFloat(root.getPropertyValue('--preview-cell-w'));
    const cellH = parseFloat(root.getPropertyValue('--preview-cell-h'));
    const gridGap = parseFloat(root.getPropertyValue('--preview-gap')) || 0;
    const span = (value, cell) => (Number(value) || 1) * (cell + gridGap) - gridGap;
    // Hidden folder tabs have no layout yet; the grid variables still hold the size.
    const tileW = cellW > 0 ? span(tileElem.dataset.spanW, cellW) : tileElem.clientWidth;
    const tileH = cellH > 0 ? span(tileElem.dataset.spanH, cellH) : tileElem.clientHeight;
    const availW = tileW - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    if (!tileElem.classList.contains('clock-compact')) {
      // A line wraps where the panel's label (as wide as the card) wraps.
      lines.forEach(el => {
        if (!el) return;
        const font = normalizeClockPreviewFont(el.dataset.clockFont, 40);
        const width = clockPanelTextWidth(el, el.textContent, font, getClockPreviewCssPx(font, 40, tileElem), tileElem);
        el.style.whiteSpace = width <= availW + 0.5 ? 'nowrap' : '';
      });
      return;
    }
    const maxPx = tileH * 0.8;
    const gap = parseFloat(style.columnGap || 0) || 0;
    const [time, date] = lines;
    const primary = time || date;
    const secondary = time && date && Number(tileElem.dataset.spanW) >= 2 ? date : null;
    if (date && date !== primary && date !== secondary) date.hidden = true;
    if (!primary) return;
    const fit = (el, capPx, usedW) => {
      const sample = clockPreviewSample(el, el === time);
      for (const size of [...CLOCK_PREVIEW_FONT_SIZES].reverse()) {
        const px = getClockPreviewCssPx(size, size, tileElem);
        if (size > Number(el.dataset.clockFont || 40) || px > capPx) continue;
        const width = clockPanelTextWidth(el, sample, size, px, tileElem);
        if (usedW + width <= availW) return { size, px, width };
      }
      return null;
    };
    const first = fit(primary, maxPx, 0) || { size: 20, px: getClockPreviewCssPx(20, 20, tileElem), width: 0 };
    applyClockPreviewLine(primary, first.size, first.px);
    if (!secondary) return;
    const second = fit(secondary, first.px, first.width + gap);
    if (second) applyClockPreviewLine(secondary, second.size, second.px);
    else secondary.hidden = true;
  }

  function saveClockFields(tab, formData) {
    saveIconColorFields(tab, formData);
    formData.append('tile_border', document.getElementById(tab + '_clock_tile_border')?.checked === false ? '0' : '1');
    ensureClockSelection(tab);
    const flags = getClockFlagsFromInputs(tab);
    formData.append('clock_show_time', (flags & 1) ? '1' : '0');
    formData.append('clock_show_date', (flags & 2) ? '1' : '0');
    formData.append('key_code', document.getElementById(tab + '_clock_time_font')?.value || '40');
    formData.append('key_modifier', document.getElementById(tab + '_clock_date_font')?.value || '20');
    formData.append('clock_time_format', document.getElementById(tab + '_clock_time_format')?.value || '0');
    formData.append('clock_date_format', String(packClockDateOptions(
      document.getElementById(tab + '_clock_date_format')?.value || '0',
      document.getElementById(tab + '_clock_weekday')?.value || '0',
      document.getElementById(tab + '_clock_roll')?.checked === true,
      document.getElementById(tab + '_clock_align')?.value || '0')));
  }

  function resetClockFields(tab) {
    resetIconColorFields(tab);
    const border = document.getElementById(tab + '_clock_tile_border');
    if (border) border.checked = true;
    applyClockFlagsToInputs(tab, 1);
    const timeFontEl = document.getElementById(tab + '_clock_time_font');
    if (timeFontEl) timeFontEl.value = '40';
    const dateFontEl = document.getElementById(tab + '_clock_date_font');
    if (dateFontEl) dateFontEl.value = '24';
    const timeFormatEl = document.getElementById(tab + '_clock_time_format');
    if (timeFormatEl) timeFormatEl.value = '0';
    const dateFormatEl = document.getElementById(tab + '_clock_date_format');
    if (dateFormatEl) dateFormatEl.value = '0';
    const weekdayEl = document.getElementById(tab + '_clock_weekday');
    if (weekdayEl) weekdayEl.value = '0';
    const rollEl = document.getElementById(tab + '_clock_roll');
    if (rollEl) rollEl.checked = false;
    const alignEl = document.getElementById(tab + '_clock_align');
    if (alignEl) alignEl.value = '0';
  }
