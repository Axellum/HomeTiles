// The clock tile's big date (user 2026-10-12, mockup build/design-mockups/
// clock 3 "Datum groß" and 8 "Datum + Zeit"): the day of the month large
// with the weekday, the month and the time when shown. The panel
// (clock/renderer.cpp clock_big_date_sizes / _fit / _choose) and the preview
// (clock/admin.js clockBigDateSizes / Fit / Choose) pick the same sizes and
// the same row or stack for every tile size, with the same measures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {compileAndRun} from '../../lib/cpp-host.mjs';
import {extractDeliveredFunction} from '../../lib/admin-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const renderer = read('src/types/clock/renderer.cpp');
const admin = read('src/types/clock/admin.js');

// The style and its wiring.
assert.match(read('src/types/clock/clock_format.h'), /STYLE_BIG_DATE = 3,/);
assert.match(renderer, /\} else if \(date_options\.style == clock_tile::STYLE_BIG_DATE\) \{\s*render_clock_big_date\(/);
assert.ok(read('src/types/clock/web_html.cpp').includes('html += tr.clock_style_big_date;'));
assert.match(renderer, /d->month = clock_big_date_label\(card, d->sizes\.month, ui_theme::text_secondary\(\)\);/,
  'the month in the secondary text color, like the mockup');
assert.match(renderer, /lv_timer_delete\(data->timer\);\s*delete data;/, 'the timer goes with the tile');
const sizesList = /static constexpr uint8_t kClockFontSizes\[\] = \{([^}]*)\};/.exec(renderer)[1];
assert.equal(/const CLOCK_PREVIEW_FONT_SIZES = \[([^\]]*)\];/.exec(admin)[1], sizesList, 'the same size steps');

const start = renderer.indexOf('struct BigDateSizes {');
const end = renderer.indexOf('static lv_coord_t clock_big_date_line(');
assert.ok(start > 0 && end > start);
const code = renderer.slice(start, end);
const lvglShim = `#pragma once
#include <stdint.h>
typedef int32_t lv_coord_t;
#define LV_MIN(a, b) ((a) < (b) ? (a) : (b))
#define LV_MAX(a, b) ((a) > (b) ? (a) : (b))
`;
// A made-up measure both sides compute alike: ASCII texts, widths by length.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];
const cases = [];
for (const [cellW, cellH, gap, pad] of [[193, 149, 20, 40], [140, 140, 12, 26]]) {
  for (const spanW of [1, 1.5, 2, 2.5, 3, 4]) {
    for (const spanH of [0.5, 1, 1.5, 2, 3]) {
      for (const time of [0, 1]) {
        for (const header of [0, 1]) {
          const compact = spanH === 0.5 ? 1 : 0;
          if (compact && header) continue;
          const w = Math.round(spanW * cellW + (spanW - 1) * gap), h = Math.round(spanH * cellH + (spanH - 1) * gap);
          const top = header ? Math.round(cellH * 0.45) : 0;
          cases.push({spanW, spanH, compact, time, availW: w - pad, availH: h - top - 12, gap: Math.round(gap * 0.6)});
        }
      }
    }
  }
}
const harness = String.raw`
#include <cstdio>
#include <cstring>
#include <cmath>
#include "lvgl.h"
static constexpr uint8_t kClockFontSizes[] = {${sizesList}};
${code}
static lv_coord_t fake_width(uint8_t size, const char* text) {
  return static_cast<lv_coord_t>(std::lround(std::strlen(text) * size * 0.55));
}
static lv_coord_t fake_line(uint8_t size) { return static_cast<lv_coord_t>(std::lround(size * 1.21)); }
static const char* const kWeekdays[] = {${WEEKDAYS.map(v => JSON.stringify(v)).join(', ')}};
static const char* const kMonths[] = {${MONTHS.map(v => JSON.stringify(v)).join(', ')}};
struct Case { float span_w, span_h; int compact, time, avail_w, avail_h, gap; };
static const Case kCases[] = {${cases.map(c => `{${c.spanW.toFixed(1)}f, ${c.spanH.toFixed(1)}f, ${c.compact}, ${c.time}, ${c.availW}, ${c.availH}, ${c.gap}}`).join(', ')}};
int main() {
  for (const Case& c : kCases) {
    BigDateMeasure m;
    m.width = fake_width;
    m.line = fake_line;
    m.weekdays = kWeekdays;
    m.months = kMonths;
    m.time_sample = "88:88";
    m.gap = c.gap;
    const BigDateSizes s = clock_big_date_choose(clock_big_date_sizes(c.span_w, c.span_h, c.compact != 0, c.time != 0),
                                                 c.compact != 0, c.avail_w, c.avail_h, m);
    std::printf("%d %d %d %d %d %d %d %d\n", s.number, s.weekday, s.month, s.time, s.column ? 1 : 0, s.year ? 1 : 0,
                s.time_right ? 1 : 0, s.month_line ? 1 : 0);
  }
  return 0;
}
`;
const output = compileAndRun({label: 'Clock big date', harness, files: {'lvgl.h': lvglShim}});
if (output !== null) {
  const panel = output.trim().split('\n').map(line => line.trim().split(' ').map(Number));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`var CLOCK_PREVIEW_FONT_SIZES = [${sizesList}];\n` + ['clockBigDateSizes', 'clockBigDateExtent',
    'clockBigDateStep', 'clockBigDateFit', 'clockBigDateChoose'].map(extractDeliveredFunction).join('\n'), ctx);
  ctx.measure = {
    width: (size, text) => Math.round(text.length * size * 0.55),
    line: size => Math.round(size * 1.21),
    weekdays: WEEKDAYS, months: MONTHS, timeSample: '88:88', gap: 0,
  };
  cases.forEach((c, i) => {
    ctx.measure.gap = c.gap;
    const s = vm.runInContext(`clockBigDateChoose(clockBigDateSizes(${c.spanW}, ${c.spanH}, ${!!c.compact}, ${!!c.time}), ${!!c.compact}, ${c.availW}, ${c.availH}, measure)`, ctx);
    const preview = [s.number, s.weekday, s.month, s.time, s.column ? 1 : 0, s.year ? 1 : 0, s.timeRight ? 1 : 0, s.monthLine ? 1 : 0];
    assert.deepEqual(preview, panel[i], `${c.spanW}x${c.spanH} time ${c.time} area ${c.availW}x${c.availH}`);
  });
  // As designed (1280x800 cells): a 2x1 tile with the time is a row with
  // the number at 72; a 1x1 tile stacks rather than shrinking the number in
  // a row ("Wednesday"); a 2x2 tile without the time stacks with the year;
  // a narrow half tile with the time drops the month.
  const at = (spanW, spanH, time, header = 0) => panel[cases.findIndex((c, i) => i < cases.length / 2 && c.spanW === spanW &&
    c.spanH === spanH && c.time === time && c.availH === Math.round(spanH * 149 + (spanH - 1) * 20) - (header ? 67 : 0) - 12)];
  assert.deepEqual(at(2, 1, 1).slice(0, 5), [72, 24, 20, 28, 0], '2x1 with the time');
  const square = at(1, 1, 0);
  assert.equal(square[4], 1, '1x1: stacked');
  assert.ok(square[0] >= 56, '1x1: a large number: ' + square[0]);
  assert.deepEqual(at(2, 2, 0).slice(4, 6), [1, 1], '2x2 without the time: stacked, with the year');
  assert.deepEqual(at(2, 2, 1).slice(3, 5), [56, 0], '2x2 with the time: a row, the time at 56');
  const half = at(1, 0.5, 1);
  assert.deepEqual([half[3] > 0 ? 1 : 0, half[7]], [1, 0], 'a narrow half tile: the time instead of the month');
  assert.deepEqual(at(2, 0.5, 1).slice(6, 7), [1], 'a wide half tile: the time beside');
}
console.log('Clock big date: the same sizes, rows and stacks on the panel and in the preview');
