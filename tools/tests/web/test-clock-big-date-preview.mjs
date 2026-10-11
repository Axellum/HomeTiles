// The big date in the Web Admin preview (user 2026-10-12): the delivered
// preview code fills today's day, weekday and month from the panel's
// language tables (CLOCK_I18N) and places them on the real admin.css like
// render_clock_big_date: the number left of its lines in a wide tile, the
// lines stacked in a 1x1 tile, the month in the secondary text color, a
// narrow half tile with the time instead of the month.
import {extractDeliveredFunction, inlineScriptSafe, readRepoFile} from '../../lib/admin-source.mjs';
import {runDomHarness} from '../../lib/headless-dom.mjs';

const admin = readRepoFile('src/types/clock/admin.js');
const constant = name => new RegExp(`(?:const|let) ${name} = .*;(?=\r?\n)`).exec(admin)[0];
const functions = ['clockBigDatePreviewHtml', 'layoutClockBigDatePreview', 'clockBigDateSizes', 'clockBigDateExtent',
  'clockBigDateStep', 'clockBigDateFit', 'clockBigDateChoose', 'clockDigitsHtml', 'clockPanelTextWidth',
  'measureClockPreviewText', 'getClockPreviewCssPx', 'normalizeClockPreviewFont', 'applyClockPreviewLine',
  'clockDateOptions', 'normalizeClockDateFormat'].map(extractDeliveredFunction).join('\n');
const css = readRepoFile('src/web/assets/admin.css');
// A 1280x800 panel's device measures at half size.
const lh = {20: 24, 24: 29, 28: 34, 32: 39, 40: 49, 48: 58, 56: 68, 64: 78, 72: 87, 80: 97, 96: 116};
const vars = ['--radius-preview-scale:0.5', '--clock-face-m-compact:6px', '--clock-face-header:67px', '--clock-bigdate-gap:12px',
  ...Object.entries(lh).map(([n, v]) => `--lh${n}:${v / 2}px;--fs${n}:${n / 2}px`)].join(';');
const tile = (id, spanW, spanH, w, h, cls, time) => `<div class="tile clock ${cls}" id="${id}" data-span-w="${spanW}" data-span-h="${spanH}"
  data-clock-options="${3 << 13}" style="position:absolute;left:10px;top:${10 + 120 * Number(id.slice(1))}px;width:${w / 2}px;height:${h / 2}px;box-sizing:border-box">
  ${'${clockBigDatePreviewHtml(' + time + ", '12:34')}"}</div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
:root{${vars};--pv-text:#FFFFFF;--pv-text-secondary:#A0A0A0}
body{margin:0}
</style></head><body><div id="grid"></div>
<pre id="result"></pre><script>
${constant('CLOCK_HTML_ESCAPES')}
${constant('CLOCK_PREVIEW_FONT_SIZES')}
${constant('CLOCK_WIDTH_SAMPLE')}
${constant('clockPreviewMeasureContext')}
const CLOCK_I18N = {weekdays: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']};
const panelRoleHex = (name, fallback) => name === 'text-secondary' ? '#A0A0A0' : '#FFFFFF';
${inlineScriptSafe(functions)}
try {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  document.getElementById('grid').innerHTML = \`${tile('t0', 2, 1, 406, 150, '', true)}${tile('t1', 1, 1, 194, 150, '', false)}${tile('t2', 1, 0.5, 194, 64, 'clock-compact', true)}\`;
  const part = (tile, name) => tile.querySelector('[data-part="' + name + '"]');
  const box = el => el.getBoundingClientRect();
  const now = new Date();
  // 2x1 with the time: a row, the number at 72 left of its lines.
  const t0 = document.getElementById('t0');
  layoutClockBigDatePreview(t0);
  check(part(t0, 'number').textContent === String(now.getDate()), 'today: ' + part(t0, 'number').textContent);
  check(part(t0, 'weekday').textContent === CLOCK_I18N.weekdays[now.getDay()], 'the weekday from the tables');
  check(part(t0, 'month').textContent === CLOCK_I18N.months[now.getMonth()] + ' ' + now.getFullYear(), 'the month with the year');
  check(part(t0, 'number').firstElementChild.style.fontSize === '36px', 'the number at 72 (36 px at half size): ' + part(t0, 'number').firstElementChild.style.fontSize);
  check(box(part(t0, 'number')).right <= box(part(t0, 'weekday')).left, 'the number left of the weekday');
  check(Math.abs(box(part(t0, 'weekday')).left - box(part(t0, 'time')).left) < 0.5, 'the time under the month');
  check(getComputedStyle(part(t0, 'month').firstElementChild).color === 'rgb(160, 160, 160)', 'the month in the secondary color');
  check(getComputedStyle(part(t0, 'number')).position === 'absolute', 'placed by the layout');
  // 1x1 without the time: stacked, centered under each other.
  const t1 = document.getElementById('t1');
  layoutClockBigDatePreview(t1);
  check(box(part(t1, 'weekday')).bottom <= box(part(t1, 'number')).top + 0.5 &&
    box(part(t1, 'number')).bottom <= box(part(t1, 'month')).top + 0.5, 'weekday, number, month stacked');
  const center = el => (box(el).left + box(el).right) / 2;
  check(Math.abs(center(part(t1, 'weekday')) - center(part(t1, 'month'))) < 1.5, 'centered lines');
  // A narrow half tile with the time: no month.
  const t2 = document.getElementById('t2');
  layoutClockBigDatePreview(t2);
  check(part(t2, 'month').hidden && !part(t2, 'time').hidden, 'the time instead of the month');
  document.body.dataset.result = 'pass';
} catch (error) { document.body.dataset.result = 'fail'; document.getElementById('result').textContent = error.message; }
</script></body></html>`;
try { runDomHarness({label: 'Clock big date preview', html, tmpPrefix: 'hometiles-clock-bigdate-'}); }
catch (error) { throw Error(error.message.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1] || error.message.slice(0, 300)); }
console.log('Clock big date preview: the day, weekday and month placed like the panel');
