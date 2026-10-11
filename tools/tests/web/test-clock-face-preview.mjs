// The analog and the wall clock in the Web Admin preview (user 2026-10-12):
// the delivered preview code places the face and its lines on the real
// admin.css exactly where the panel's clock_face_layout puts them, scaled
// like the grid (--radius-preview-scale) inside the tile's 3 px editor
// border, with the wall clock's colors and the panel's measures (--tw / --lh).
import assert from 'node:assert/strict';
import {extractDeliveredFunction, inlineScriptSafe, readRepoFile} from '../../lib/admin-source.mjs';
import {runDomHarness} from '../../lib/headless-dom.mjs';

const admin = readRepoFile('src/types/clock/admin.js');
const constant = name => new RegExp(`const ${name} = [^;]*;`).exec(admin)[0];
const functions = ['layoutClockFacePreview', 'clockFaceLayout', 'clockFaceTimeFit', 'clockFaceSvg', 'clockDialColor',
  'clockDateOptions', 'normalizeClockDateFormat', 'applyClockPreviewTextStyle', 'normalizeClockPreviewFont',
  'getClockPreviewCssPx', 'applyClockPreviewLine'].map(extractDeliveredFunction).join('\n');
const css = readRepoFile('src/web/assets/admin.css');
// Device measures of a 1280x800 panel at half size in the preview.
const half = v => `${v / 2}px`;
const tw = {56: 254, 40: 181, 32: 146, 24: 109, 20: 91};
const lh = {56: 68, 40: 49, 32: 39, 24: 29, 20: 24};
const vars = [
  '--radius-preview-scale:0.5', '--clock-face-m:16px', '--clock-face-m-compact:6px', '--clock-face-gap:6px',
  '--clock-face-header:67px',
  ...Object.entries(tw).map(([n, v]) => `--tw${n}:${half(v)}`), ...Object.entries(lh).map(([n, v]) => `--lh${n}:${half(v)}`),
  ...[20, 24, 32, 40, 56].map(n => `--fs${n}:${n / 2}px`),
].join(';');
const tile = (id, w, h, options, cls = '') => `<div class="tile clock ${cls}" id="${id}" style="position:absolute;left:10px;top:${10 + 200 * Number(id.slice(1))}px;width:${w / 2}px;height:${h / 2}px;box-sizing:border-box">
<svg class="tile-clock-face" data-options="${options}"></svg><div class="tile-clock-face-text"><div class="tile-clock-time">00:42</div><div class="tile-clock-date">Mon, 12.10.</div></div></div>`;
const wall = (2 << 13) | (4 << 16) | (1 << 19);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
:root{${vars}}
body{margin:0}
</style></head><body>
${tile('t0', 406, 150, wall)}
${tile('t1', 180, 150, 1 << 13, 'clock-has-header')}
${tile('t2', 170, 64, 1 << 13, 'clock-compact')}
<pre id="result"></pre><script>
${constant('CLOCK_FACE_TIME_SIZES')}
${constant('CLOCK_DIAL_COLORS')}
${constant('CLOCK_HAND_COLORS')}
// Colors are not this test's subject: the panel roles and tones stubbed.
const panelRoleHex = (name, fallback) => fallback;
const panelRole = () => [255, 255, 255];
const panelLight = () => false;
const panelVar = (name, fallback) => fallback;
const cssColorChannels = () => [26, 26, 26];
const toneNoColor = () => true;
const toneBlend = (under) => under;
const toneHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const toneFill = () => ({disc: [44, 44, 44]});
${inlineScriptSafe(functions)}
try {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const near = (a, b, message) => check(Math.abs(a - b) < 0.6, message + ': ' + a + ' vs ' + b);
  const box = (el, tile) => {
    const r = el.getBoundingClientRect(), t = tile.getBoundingClientRect();
    return {x: r.left - t.left, y: r.top - t.top, w: r.width, h: r.height};
  };
  // A wide wall clock: the face 16 px from the card, 150 - 32 high; the
  // lines from 118 + 32, the time at 40 (56 does not fit 406 - 166 px).
  const t0 = document.getElementById('t0');
  check(getComputedStyle(t0).borderLeftWidth === '3px', 'the editor border');
  layoutClockFacePreview(t0);
  const face0 = box(t0.querySelector('.tile-clock-face'), t0);
  near(face0.x, 8, 'face x'); near(face0.y, 8, 'face y'); near(face0.w, 59, 'face size');
  const svg = t0.querySelector('.tile-clock-face').innerHTML;
  check(svg.includes('fill="#26364F"'), 'the navy dial');
  check(svg.includes('stroke="#C3C7CC"'), 'silver hands');
  const text0 = box(t0.querySelector('.tile-clock-face-text'), t0);
  near(text0.x, 75, 'lines x'); near(text0.w, 120, 'lines width');
  check(t0.querySelector('.tile-clock-time').dataset.clockFont === '40', 'time at 40: ' + t0.querySelector('.tile-clock-time').dataset.clockFont);
  check(!t0.querySelector('.tile-clock-date').hidden, 'the date beside');
  // A 1x1 tile with a header: the face alone below the header.
  const t1 = document.getElementById('t1');
  layoutClockFacePreview(t1);
  check(t1.querySelector('.tile-clock-face-text').hidden, 'no lines in a small tile with a header');
  const face1 = box(t1.querySelector('.tile-clock-face'), t1);
  near(face1.y, (67 + 16) / 2, 'below the header'); near(face1.w, (150 - 67 - 32) / 2, 'the face fills the rest');
  check(t1.querySelector('.tile-clock-face').innerHTML.includes('fill="#2C2C2C"'), 'the analog dial: the theme circle');
  // A narrow half tile: the time alone beside a small face.
  const t2 = document.getElementById('t2');
  layoutClockFacePreview(t2);
  check(!t2.querySelector('.tile-clock-time').hidden && t2.querySelector('.tile-clock-date').hidden, 'the time alone');
  near(box(t2.querySelector('.tile-clock-face'), t2).w, (64 - 12) / 2, 'the half tile face');
  document.body.dataset.result = 'pass';
} catch (error) { document.body.dataset.result = 'fail'; document.getElementById('result').textContent = error.message; }
</script></body></html>`;
try { runDomHarness({label: 'Clock face preview', html, tmpPrefix: 'hometiles-clock-face-'}); }
catch (error) { throw Error(error.message.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1] || error.message.slice(0, 300)); }
console.log('Clock face preview: face and lines where the panel puts them');
