
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
  // 13-15 the style (0 digital, 1 analog, 2 wall clock, 3 big date), 16-18 the wall
  // clock's dial color, 19-20 its hands' color (clock_face.h).
  function clockDateOptions(raw) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return {format: 0, weekday: 0, roll: false, align: 0, style: 0, dial: 0, hands: 0};
    const weekday = (num >> 8) & 3;
    const align = (num >> 11) & 3;
    const style = (num >> 13) & 7;
    const dial = (num >> 16) & 7;
    return {format: normalizeClockDateFormat(num & 0xFF), weekday: weekday <= 2 ? weekday : 0,
      roll: ((num >> 10) & 1) === 1, align: align <= 2 ? align : 0, style: style < 4 ? style : 0,
      dial: dial < 6 ? dial : 0, hands: (num >> 19) & 3};
  }
  function packClockDateOptions(format, weekday, roll, align = 0, style = 0, dial = 0, hands = 0) {
    const day = Number(weekday), side = Number(align), kind = Number(style), face = Number(dial), ink = Number(hands);
    return normalizeClockDateFormat(format) | ((day === 1 || day === 2 ? day : 0) << 8) | (roll ? 1024 : 0)
      | ((side === 1 || side === 2 ? side : 0) << 11) | ((kind >= 1 && kind <= 3 ? kind : 0) << 13)
      | ((face >= 0 && face < 6 ? face : 0) << 16) | ((ink >= 0 && ink < 4 ? ink : 0) << 19);
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
    const styleEl = document.getElementById(tab + '_clock_style');
    if (styleEl) styleEl.value = String(dateOptions.style);
    const dialEl = document.getElementById(tab + '_clock_dial');
    if (dialEl) dialEl.value = String(dateOptions.dial);
    const handsEl = document.getElementById(tab + '_clock_hands');
    if (handsEl) handsEl.value = String(dateOptions.hands);
    syncClockStyleFields(tab);
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
    layoutClockFacePreview(tileElem);
    layoutClockBigDatePreview(tileElem);
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
    if (!tileElem || tileElem.querySelector(':scope > .tile-clock-face, :scope > .tile-clock-bigdate')) return;
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
      document.getElementById(tab + '_clock_align')?.value || '0',
      document.getElementById(tab + '_clock_style')?.value || '0',
      document.getElementById(tab + '_clock_dial')?.value || '0',
      document.getElementById(tab + '_clock_hands')?.value || '0')));
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
    for (const id of ['_clock_style', '_clock_dial', '_clock_hands']) {
      const el = document.getElementById(tab + id);
      if (el) el.value = '0';
    }
    syncClockStyleFields(tab);
  }

  // The wall clock's colors only with the wall clock.
  function syncClockStyleFields(tab) {
    const wall = document.getElementById(tab + '_clock_wall_colors');
    if (wall) wall.classList.toggle('hidden', document.getElementById(tab + '_clock_style')?.value !== '2');
  }

  // clock_face.h: the wall clock's colors; the analog clock takes the theme.
  const CLOCK_DIAL_COLORS = ['#5E6C82', '#1E1F22', '#F4F4F2', '#7C8C74', '#26364F', '#B86B4B'];
  const CLOCK_HAND_COLORS = ['#C9A45C', '#C3C7CC', '#1A1A1A', '#FFFFFF'];

  // The analog face's circle: the theme's icon circle over the card
  // (tile_icon_disc::tile_fill for the untinted theme icon): the light theme
  // blends the icon grey over the card, the dark one lifts the card.
  function clockDialColor(tileElem) {
    const card = cssColorChannels(getComputedStyle(tileElem).backgroundColor) || [0, 0, 0];
    const glowRaw = String(getComputedStyle(document.documentElement).getPropertyValue('--icon-glow-pct')).trim();
    const glowValue = glowRaw === '' ? 25 : Number(glowRaw);
    const glowPct = Math.min(100, Math.max(0, Number.isFinite(glowValue) ? glowValue : 25));
    const icon = panelRole('icon') || [255, 255, 255];
    if (panelLight()) {
      const over = toneNoColor(icon) ? [189, 189, 189] : icon;
      const share = Number(panelVar('--pv-light-circle', '0.8'));
      const amount = glowPct * (Number.isFinite(share) ? share : 0.8) / 100;
      return toneHex(glowPct ? toneBlend(card, over, Math.round(Math.min(1, amount) * 255)) : card);
    }
    return toneHex(toneFill(card, icon, false, glowPct).disc);
  }

  // The face (clock_face::create) as SVG in device pixels.
  function clockFaceSvg(size, options, small, dialColor) {
    const r = size / 2, wall = options.style === 2;
    const ink = CLOCK_HAND_COLORS[options.hands] || CLOCK_HAND_COLORS[0];
    const dial = wall ? (CLOCK_DIAL_COLORS[options.dial] || CLOCK_DIAL_COLORS[0]) : dialColor;
    const major = wall ? ink : panelRoleHex('text', '#FFFFFF'), minor = wall ? ink : panelRoleHex('icon-off', '#B0B0B0');
    const at = (deg, share) => [r + share * r * Math.sin(deg * Math.PI / 180), r - share * r * Math.cos(deg * Math.PI / 180)];
    let marks = '';
    for (let i = 0; i < 12; i++) {
      const quarter = i % 3 === 0;
      if (wall) {
        const [x0, y0] = at(i * 30, small ? 0.62 : 0.68), [x1, y1] = at(i * 30, 0.86);
        marks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${ink}" stroke-width="${Math.max(1, Math.floor(size / 50))}" stroke-linecap="round"/>`;
      } else if (quarter || !small) {
        const [x, y] = at(i * 30, 0.8), d = Math.max(3, Math.floor(size * (quarter ? 0.048 : 0.028)));
        marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${d / 2}" fill="${quarter ? major : minor}"/>`;
      }
    }
    const now = new Date();
    const hourDeg = ((now.getHours() % 12) + now.getMinutes() / 60) * 30, minDeg = now.getMinutes() * 6;
    const hand = (deg, share, width) => {
      const [x, y] = at(deg, share);
      return `<line x1="${r}" y1="${r}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${wall ? ink : major}" stroke-width="${width}" stroke-linecap="round"/>`;
    };
    const hw = Math.max(2, Math.floor(size * (wall ? 0.022 : 0.05))), mw = Math.max(2, Math.floor(size * (wall ? 0.016 : 0.032)));
    const center = Math.max(4, Math.floor(size * (wall ? 0.036 : 0.09)));
    return `<circle cx="${r}" cy="${r}" r="${r}" fill="${dial}"/>${marks}`
      + hand(hourDeg, wall ? 0.5 : 0.45, hw) + hand(minDeg, wall ? 0.78 : 0.66, mw)
      + `<circle cx="${r}" cy="${r}" r="${center / 2}" fill="${wall ? ink : major}"/>`;
  }

  // clock/renderer.cpp clock_face_layout in device pixels (m, gap: the
  // margins of clock_face.h, --clock-face-*; fonts: the widths of the clock
  // sample and the line heights per time size, --tw / --lh): the face and its
  // lines beside or below it, or the face alone.
  const CLOCK_FACE_TIME_SIZES = [56, 40, 32, 24, 20];
  function clockFaceTimeFit(fonts, maxSize, width, height, below) {
    for (let i = 0; i < CLOCK_FACE_TIME_SIZES.length; i++) {
      if (CLOCK_FACE_TIME_SIZES[i] > maxSize) continue;
      if (fonts.timeW[i] <= width && fonts.timeH[i] + below <= height) return i;
    }
    return -1;
  }
  function clockFaceLayout(w, h, top, compact, timeLine, dateLine, fonts, m, gap) {
    const areaH = h - top, y = top + m;
    if (compact) {
      const size = areaH - 2 * m, textX = size + 2 * m + gap, textW = w - textX - m;
      const date = dateLine && textW >= 2 * size;
      const fit = timeLine ? clockFaceTimeFit(fonts, 24, textW, areaH, date ? fonts.date20H : 0) : -1;
      return {x: m, y, size, beside: true, textX, textY: top, textW, textH: areaH, showTime: fit >= 0,
        showDate: date && (fit >= 0 || fonts.date20H <= areaH), timeSize: fit >= 0 ? CLOCK_FACE_TIME_SIZES[fit] : 0, dateSize: 20};
    }
    if ((timeLine || dateLine) && w >= 2 * areaH) {
      const size = areaH - 2 * m, textW = w - size - 3 * m, dateH = dateLine ? fonts.date20H : 0;
      const fit = timeLine ? clockFaceTimeFit(fonts, 56, textW, areaH, dateH) : -1;
      if (timeLine ? fit >= 0 : dateH <= areaH) {
        return {x: m, y, size, beside: true, textX: size + 2 * m, textY: top, textW, textH: areaH,
          showTime: timeLine, showDate: dateLine, timeSize: fit >= 0 ? CLOCK_FACE_TIME_SIZES[fit] : 0, dateSize: 20};
      }
    }
    if ((timeLine || dateLine) && areaH * 2 >= w * 3) {
      const size = w - 2 * m, textY = y + size, dateH = dateLine ? fonts.date20H : 0;
      const fit = timeLine ? clockFaceTimeFit(fonts, 40, w - 2 * m, h - textY, dateH) : -1;
      if (timeLine ? fit >= 0 : dateH <= h - textY) {
        return {x: m, y, size, beside: false, textX: 0, textY, textW: w, textH: h - textY,
          showTime: timeLine, showDate: dateLine, timeSize: fit >= 0 ? CLOCK_FACE_TIME_SIZES[fit] : 0, dateSize: 20};
      }
    }
    const full = Math.min(w, areaH) - 2 * m;
    if (dateLine) {
      const withDate = Math.min(w - 2 * m, areaH - 3 * m - fonts.date24H);
      if (withDate * 10 >= full * 7) {
        return {x: Math.trunc((w - withDate) / 2), y, size: withDate, beside: false, textX: 0, textY: y + withDate,
          textW: w, textH: h - y - withDate, showTime: false, showDate: true, dateSize: 24};
      }
    }
    return {x: Math.trunc((w - full) / 2), y, size: full, showTime: false, showDate: false};
  }

  // The big date (clock/renderer.cpp clock_big_date_sizes, _extent, _step,
  // _fit): the sizes by the tile's spans, stepped down together until the
  // language's longest weekday and month and the clock sample fit.
  function clockBigDateSizes(spanW, spanH, compact, time) {
    const s = {number: 0, weekday: 0, month: 0, time: 0, column: false, year: false, timeRight: false, monthLine: true};
    if (compact) {
      s.number = spanW < 2 ? 40 : 48;
      s.weekday = s.month = 20;
      s.time = time ? (spanW < 2 ? 20 : 40) : 0;
      s.year = spanW >= 2;
      s.timeRight = time && spanW >= 2;
      s.monthLine = !(time && spanW < 2);
      return s;
    }
    if (spanH >= 2) {
      s.number = 96;
      if (spanW < 2) Object.assign(s, {column: true, weekday: 24, month: 20, time: time ? 48 : 0});
      else Object.assign(s, {column: !time, weekday: 28, month: 24, year: true, time: time ? 56 : 0});
      return s;
    }
    if (spanW < 1.5) Object.assign(s, {number: 72, weekday: 20, month: 20, time: time ? 24 : 0});
    else if (spanW < 2.5) Object.assign(s, {number: 72, weekday: 24, month: 20, time: time ? 28 : 0, year: true});
    else Object.assign(s, {number: 96, weekday: time ? 24 : 28, month: time ? 20 : 24, time: time ? 40 : 0, year: true});
    return s;
  }
  function clockBigDateExtent(s, m) {
    let weekdayW = 0, monthW = 0;
    for (const day of m.weekdays) weekdayW = Math.max(weekdayW, m.width(s.weekday, day));
    for (const month of m.months) monthW = Math.max(monthW, m.width(s.month, s.year ? month + ' 8888' : month));
    const numberW = m.width(s.number, '88'), timeW = s.time ? m.width(s.time, m.timeSample) : 0;
    const monthH = s.monthLine ? m.line(s.month) : 0;
    if (!s.monthLine) monthW = 0;
    if (s.column) {
      return [Math.max(weekdayW, numberW, monthW, timeW), m.line(s.weekday) + m.line(s.number) + monthH + (s.time ? m.line(s.time) : 0)];
    }
    const timeInColumn = s.time && !s.timeRight;
    const columnW = Math.max(weekdayW, monthW, timeInColumn ? timeW : 0);
    const columnH = m.line(s.weekday) + monthH + (timeInColumn ? m.line(s.time) : 0);
    return [numberW + m.gap + columnW + (s.timeRight ? m.gap + timeW : 0),
      Math.max(m.line(s.number), columnH, s.timeRight ? m.line(s.time) : 0)];
  }
  function clockBigDateStep(size) {
    for (let i = CLOCK_PREVIEW_FONT_SIZES.length - 1; i >= 0; i--) if (CLOCK_PREVIEW_FONT_SIZES[i] < size) return CLOCK_PREVIEW_FONT_SIZES[i];
    return size;
  }
  function clockBigDateFit(sizes, availW, availH, m) {
    let s = {...sizes};
    for (let round = 0; round < 12; round++) {
      const [w, h] = clockBigDateExtent(s, m);
      if (w <= availW && h <= availH) break;
      const next = {...s, number: clockBigDateStep(s.number), weekday: clockBigDateStep(s.weekday),
        month: clockBigDateStep(s.month), time: s.time ? clockBigDateStep(s.time) : 0};
      if (next.number === s.number && next.weekday === s.weekday && next.month === s.month && next.time === s.time) break;
      s = next;
    }
    return s;
  }

  function clockBigDateChoose(sizes, compact, availW, availH, m) {
    const row = clockBigDateFit(sizes, availW, availH, m);
    if (compact || sizes.column || row.number >= 2 * row.weekday) return row;
    const column = clockBigDateFit({...sizes, column: true, timeRight: false, monthLine: true}, availW, availH, m);
    return column.number > row.number ? column : row;
  }

  // The big date's lines (layoutClockBigDatePreview fills and places them).
  function clockBigDatePreviewHtml(showTime, timeText) {
    const part = name => '<div class="tile-clock-bigdate-line" data-part="' + name + '"><div class="tile-clock-bigdate-text">'
      + (name === 'time' ? clockDigitsHtml(timeText) : '') + '</div></div>';
    return '<div class="tile-clock-bigdate">' + part('number') + part('weekday') + part('month')
      + (showTime ? part('time') : '') + '</div>';
  }

  // The big date in the preview: the panel's sizes for this tile, measured
  // with the panel's widths (clockPanelTextWidth) and line heights (--lh),
  // centered or aligned like render_clock_big_date, inside the 3 px editor
  // border (the panel's card has none).
  function layoutClockBigDatePreview(tileElem) {
    const block = tileElem?.querySelector(':scope > .tile-clock-bigdate');
    if (!block) return;
    const style = getComputedStyle(tileElem);
    const device = (name, fallback) => {
      const v = parseFloat(style.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    const scale = device('--radius-preview-scale', 0.5) || 0.5;
    const compact = tileElem.classList.contains('clock-compact');
    const parts = Object.fromEntries([...block.querySelectorAll('.tile-clock-bigdate-line')].map(el => [el.dataset.part, el]));
    const text = name => parts[name]?.firstElementChild;
    const timeEl = text('time');
    const timeText = timeEl ? timeEl.textContent : '';
    const i18n = typeof CLOCK_I18N === 'object' && CLOCK_I18N ? CLOCK_I18N : {};
    const weekdays = i18n.weekdays?.length === 7 ? i18n.weekdays : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = i18n.months?.length === 12 ? i18n.months
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const sample = text('number');
    const m = {
      width: (size, value) => clockPanelTextWidth(sample, value, size, getClockPreviewCssPx(size, size, tileElem), tileElem),
      line: size => device('--lh' + size, size * 0.6),
      weekdays, months, timeSample: /[AP]M/.test(timeText) ? '88:88 PM' : '88:88', gap: device('--clock-bigdate-gap', 12) * scale,
    };
    const padX = parseFloat(style.paddingLeft) || 0;
    const top = tileElem.classList.contains('clock-has-header') ? device('--clock-face-header', 0) * scale : 0;
    const margin = device('--clock-face-m-compact', 6) * scale;
    const areaW = tileElem.offsetWidth - 2 * padX, areaY = top + margin, areaH = tileElem.offsetHeight - top - 2 * margin;
    const s = clockBigDateChoose(clockBigDateSizes(Number(tileElem.dataset.spanW) || 1, Number(tileElem.dataset.spanH) || 1,
      compact, !!timeEl), compact, areaW, areaH, m);
    const now = new Date();
    const monthName = months[now.getMonth()] || '';
    const texts = {number: String(now.getDate()), weekday: weekdays[now.getDay()] || '',
      month: s.year ? monthName + ' ' + now.getFullYear() : monthName};
    const sizes = {number: s.number, weekday: s.weekday, month: s.month, time: s.time};
    for (const name of Object.keys(parts)) {
      const el = text(name);
      if (texts[name] !== undefined) el.innerHTML = clockDigitsHtml(texts[name]);
      applyClockPreviewLine(el, sizes[name], getClockPreviewCssPx(sizes[name], sizes[name], tileElem));
      el.style.color = name === 'month' ? panelRoleHex('text-secondary', '#A0A0A0') : panelRoleHex('text', '#FFFFFF');
    }
    if (parts.month) parts.month.hidden = !s.monthLine;
    // Places by the lines' own widths in the preview (their .tnum digit
    // boxes as wide as the panel's tabular digits); the sizes above came
    // from the panel's widths.
    const w = name => parts[name] && !parts[name].hidden ? parts[name].offsetWidth : 0;
    const h = name => parts[name] && !parts[name].hidden ? m.line(sizes[name]) : 0;
    const timeInColumn = !!timeEl && !s.timeRight;
    let blockW, blockH;
    if (s.column) {
      blockW = Math.max(w('number'), w('weekday'), w('month'), w('time'));
      blockH = h('weekday') + h('number') + h('month') + h('time');
    } else {
      blockW = w('number') + m.gap + Math.max(w('weekday'), w('month'), timeInColumn ? w('time') : 0)
        + (s.timeRight ? m.gap + w('time') : 0);
      blockH = Math.max(h('number'), h('weekday') + h('month') + (timeInColumn ? h('time') : 0), h('time'));
    }
    const options = clockDateOptions(tileElem.dataset.clockOptions);
    const x0 = options.align === 1 ? 0 : options.align === 2 ? areaW - blockW : (areaW - blockW) / 2;
    const y0 = areaY + (areaH - blockH) / 2;
    const border = tileElem.clientLeft || 0;
    const place = (name, x, y) => {
      if (!parts[name]) return;
      parts[name].style.left = (padX + x - border) + 'px';
      parts[name].style.top = (y - border) + 'px';
    };
    if (s.column) {
      let y = y0;
      for (const name of ['weekday', 'number', 'month', 'time']) {
        if (!parts[name] || parts[name].hidden) continue;
        const lineX = options.align === 1 ? x0 : options.align === 2 ? x0 + blockW - w(name) : x0 + (blockW - w(name)) / 2;
        place(name, lineX, y);
        y += h(name);
      }
      return;
    }
    place('number', x0, y0 + (blockH - h('number')) / 2);
    const columnX = x0 + w('number') + m.gap;
    let y = y0 + (blockH - (h('weekday') + h('month') + (timeInColumn ? h('time') : 0))) / 2;
    place('weekday', columnX, y);
    y += h('weekday');
    if (!parts.month?.hidden) { place('month', columnX, y); y += h('month'); }
    if (timeInColumn) place('time', columnX, y);
    if (timeEl && s.timeRight) place('time', columnX + Math.max(w('weekday'), w('month')) + m.gap, y0 + (blockH - h('time')) / 2);
  }

  // The analog and the wall clock in the preview, placed after the tile has
  // its size: the device layout in device pixels, scaled like the grid
  // (--radius-preview-scale), inside the 3 px editor border.
  function layoutClockFacePreview(tileElem) {
    const face = tileElem?.querySelector(':scope > .tile-clock-face');
    if (!face) return;
    const options = clockDateOptions(face.dataset.options);
    const style = getComputedStyle(tileElem);
    const devicePx = (name, fallback) => {
      const v = parseFloat(style.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    const scale = devicePx('--radius-preview-scale', 0.5) || 0.5;
    const w = Math.round(tileElem.offsetWidth / scale), h = Math.round(tileElem.offsetHeight / scale);
    const compact = tileElem.classList.contains('clock-compact');
    const top = tileElem.classList.contains('clock-has-header') ? devicePx('--clock-face-header', 0) : 0;
    const text = tileElem.querySelector(':scope > .tile-clock-face-text');
    const time = text?.querySelector('.tile-clock-time'), date = text?.querySelector('.tile-clock-date');
    // The panel's measures per nominal size, scaled (web_admin_styles.cpp).
    const measure = (name, fallback) => Math.round(devicePx(name, fallback * scale) / scale);
    const fonts = {timeW: CLOCK_FACE_TIME_SIZES.map(n => measure('--tw' + n, n * 4)),
      timeH: CLOCK_FACE_TIME_SIZES.map(n => measure('--lh' + n, n * 1.21)),
      date20H: measure('--lh20', 24), date24H: measure('--lh24', 29)};
    const l = clockFaceLayout(w, h, top, compact, !!time, !!date, fonts,
      devicePx(compact ? '--clock-face-m-compact' : '--clock-face-m', compact ? 6 : 16),
      devicePx('--clock-face-gap', 6));
    const border = tileElem.clientLeft || 0;
    face.style.left = (l.x * scale - border) + 'px';
    face.style.top = (l.y * scale - border) + 'px';
    face.style.width = face.style.height = (l.size * scale) + 'px';
    face.setAttribute('viewBox', `0 0 ${l.size} ${l.size}`);
    face.innerHTML = clockFaceSvg(l.size, options, compact, clockDialColor(tileElem));
    if (!text) return;
    text.hidden = !l.showTime && !l.showDate;
    if (text.hidden) return;
    if (time) {
      time.hidden = !l.showTime;
      applyClockPreviewTextStyle(time, l.timeSize || 40, 40, panelRoleHex('text', '#fff'));
    }
    if (date) {
      date.hidden = !l.showDate;
      applyClockPreviewTextStyle(date, l.dateSize || 20, 20, panelRoleHex('text', '#fff'));
    }
    text.style.alignItems = l.beside ? 'flex-start' : 'center';
    text.style.left = (l.textX * scale - border) + 'px';
    text.style.top = (l.textY * scale - border) + 'px';
    text.style.width = (l.textW * scale) + 'px';
    text.style.height = (l.textH * scale) + 'px';
  }
