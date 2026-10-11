// Clock tile options (user 2026-10-12, issue #13): the weekday (none, short,
// long), more date formats (21/08/2026, 21.08., 21. August, 21. August 2026,
// month names by language, Polish in the genitive) and rolling digits, kept
// with the date format in one value (Tile::sensor_gauge_max). The panel's
// clock_tile::format_date_line and the preview's getClockPreviewDate give the
// same text for every format, weekday and language.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {compileAndRun} from '../../lib/cpp-host.mjs';
import {extractDeliveredFunction} from '../../lib/admin-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

// The language tables as the panel has them (i18n.cpp), for a small i18n.h
// stand-in on the host (web_scripts.cpp CLOCK_I18N comes from the same).
const i18n = read('src/core/i18n/i18n.cpp');
const table = (lang) => {
  const name = {de: 'kLocaleDe', en: 'kLocaleEn', fr: 'kLocaleFr', pl: 'kLocalePl'}[lang];
  const start = i18n.indexOf(`static const LocaleProfile ${name} = {`);
  const body = i18n.slice(start, i18n.indexOf('static const ', start + 10) > 0 ? i18n.indexOf('static const ', start + 10) : undefined);
  const list = (re) => re.exec(body)[1].split(/",\s*"/).map(s => s.replace(/^"|"$/g, ''));
  const weekdays = list(/\{("(?:Sonntag|Sunday|Dimanche|Niedziela)"[^}]*)\}/);
  const short = list(/\{("(?:So|Sun|Dim|Nd)"[^}]*)\}/);
  const months = list(/\{("(?:Januar|January|janvier|stycznia)"[^}]*)\}/);
  const pattern = /\}\,\s*\n?\s*"(\{d\}[^"]*)"\s*,?\s*\n?\}/.exec(body)?.[1];
  return {months, weekdays, weekdaysShort: short, pattern};
};
const LANGS = ['de', 'en', 'fr', 'pl'];
const TABLES = Object.fromEntries(LANGS.map(lang => [lang, table(lang)]));
const cstr = v => JSON.stringify(v);
const shim = `#pragma once
#include <stdint.h>
#include <string.h>
namespace i18n {
struct LocaleProfile {
  const char* weekday_names[7];
  const char* weather_weekdays_short[7];
  const char* month_names_in_date[12];
  const char* long_date_pattern;
  uint8_t default_time_format;
  uint8_t default_date_format;
};
inline const LocaleProfile& locale(const char* code) {
${LANGS.map(lang => `  static const LocaleProfile k_${lang} = {{${TABLES[lang].weekdays.map(cstr).join(', ')}}, {${TABLES[lang].weekdaysShort.map(cstr).join(', ')}}, {${TABLES[lang].months.map(cstr).join(', ')}}, ${cstr(TABLES[lang].pattern)}, 1, 1};`).join('\n')}
${LANGS.map(lang => `  if (code && strcmp(code, ${cstr(lang)}) == 0) return k_${lang};`).join('\n')}
  return k_en;
}
}  // namespace i18n
`;

// Panel: every case for the 21st of August 2026 (a Friday) and the 10th of
// October 2026 (a Saturday), in all four languages.
const cases = [];
for (const lang of ['de', 'en', 'fr', 'pl']) {
  for (const [wday, day, month] of [[5, 21, 7], [6, 10, 9]]) {
    for (let format = 1; format <= 7; ++format) {
      for (const weekday of [0, 1, 2]) {
        for (const show of [1, 0]) cases.push({lang, wday, day, month, format, weekday, show});
      }
    }
  }
}
const harness = String.raw`
#include "src/types/clock/clock_format.h"
#include <cstdio>
#include <initializer_list>
struct Case { const char* lang; int wday, day, month, format, weekday, show; };
static const Case kCases[] = {${cases.map(c => `{"${c.lang}", ${c.wday}, ${c.day}, ${c.month}, ${c.format}, ${c.weekday}, ${c.show}}`).join(', ')}};
int main() {
  for (const Case& c : kCases) {
    char out[96];
    clock_tile::format_date_line(out, sizeof(out), c.wday, c.day, c.month, 2026, c.show != 0, c.format, c.weekday, c.lang);
    std::printf("%s|\n", out);
  }
  // Packing: old values 0-3 stay the format alone; unknown bits drop.
  for (int raw : {0, 1, 3, 7, 0x106, 0x207, 0x405, 0x301, 0x7FF, -5, 9, 0x806, 0x1003, 0x1801}) {
    const clock_tile::TileDateOptions o = clock_tile::unpack_date_options(raw);
    std::printf("pack %d %d %d %d %d %d\n", raw, o.date_format, o.weekday, o.roll ? 1 : 0, o.align,
                static_cast<int>(clock_tile::normalize_date_options(raw)));
  }
  return 0;
}
`;
const output = compileAndRun({label: 'Clock date options', harness, files: {'src/core/i18n/i18n.h': shim}});
if (output !== null) {
  const lines = output.split('\n').filter(Boolean);
  const texts = lines.slice(0, cases.length).map(l => l.replace(/\|\r?$/, ''));
  const at = (lang, day, format, weekday, show = 1) =>
    texts[cases.findIndex(c => c.lang === lang && c.day === day && c.format === format && c.weekday === weekday && c.show === show)];
  assert.equal(at('de', 21, 1, 0), '21.08.2026');
  assert.equal(at('de', 21, 4, 0), '21/08/2026', 'issue #13: DD/MM/YYYY');
  assert.equal(at('de', 21, 5, 0), '21.08.');
  assert.equal(at('de', 21, 6, 0), '21. August');
  assert.equal(at('en', 21, 7, 0), '21 August 2026', 'issue #13: DD MMMM YYYY');
  assert.equal(at('fr', 10, 7, 0), '10 octobre 2026');
  assert.equal(at('pl', 21, 6, 0), '21 sierpnia', 'Polish month in the genitive');
  assert.equal(at('de', 10, 6, 2), 'Samstag, 10. Oktober', 'design 1 "Mit Wochentag"');
  assert.equal(at('de', 10, 1, 1), 'Sa, 10.10.2026');
  assert.equal(at('de', 10, 1, 2, 0), 'Samstag', 'the weekday alone');
  assert.equal(at('de', 10, 1, 0, 0), '', 'nothing without both');
  const packs = Object.fromEntries(lines.slice(cases.length).map(l => l.trim().split(' ')).map(([, raw, ...v]) => [raw, v.map(Number)]));
  assert.deepEqual(packs['3'], [3, 0, 0, 0, 3], 'an old tile: the format alone, centered');
  assert.deepEqual(packs[String(0x106)], [6, 1, 0, 0, 0x106]);
  assert.deepEqual(packs[String(0x405)], [5, 0, 1, 0, 0x405], 'rolling digits');
  assert.deepEqual(packs[String(0x301)], [1, 0, 0, 0, 1], 'an unknown weekday drops');
  assert.deepEqual(packs['-5'], [0, 0, 0, 0, 0]);
  assert.deepEqual(packs['9'], [0, 0, 0, 0, 0], 'an unknown format falls back to Auto');
  assert.deepEqual(packs[String(0x806)], [6, 0, 0, 1, 0x806], 'left');
  assert.deepEqual(packs[String(0x1003)], [3, 0, 0, 2, 0x1003], 'right');
  assert.deepEqual(packs[String(0x1801)], [1, 0, 0, 0, 1], 'an unknown alignment drops');

  const helpers = ['normalizeClockDateFormat', 'resolveClockDateFormat', 'getClockPreviewLanguage', 'getClockPreviewDate',
    'clockDateOptions', 'packClockDateOptions'].map(extractDeliveredFunction).join('\n');
  for (const lang of LANGS) {
    const texts18 = TABLES[lang];
    assert.equal(texts18.months.length, 12, `${lang} months`);
    assert.equal(texts18.weekdays.length, 7, `${lang} weekdays`);
    assert.ok(texts18.pattern, `${lang} pattern`);
    for (const c of cases.filter(k => k.lang === lang)) {
      const ctx = {CLOCK_I18N: texts18, document: {getElementById: () => null, documentElement: {lang}},
        Date: class extends Date { constructor() { super(2026, c.month, c.day, 12, 0, 0); } }};
      vm.createContext(ctx);
      vm.runInContext(helpers, ctx);
      const preview = vm.runInContext(`getClockPreviewDate(${c.format}, ${c.weekday}, ${c.show === 1})`, ctx);
      assert.equal(preview, texts[cases.indexOf(c)], `${lang} ${c.day}.${c.month + 1} format ${c.format} weekday ${c.weekday} date ${c.show}`);
    }
    const ctx = {document: {getElementById: () => null, documentElement: {lang}}};
    vm.createContext(ctx);
    vm.runInContext(helpers, ctx);
    assert.equal(vm.runInContext('packClockDateOptions(6, 2, true)', ctx), 6 | (2 << 8) | 1024);
    assert.equal(vm.runInContext('packClockDateOptions(6, 2, true, 2)', ctx), 6 | (2 << 8) | 1024 | (2 << 11));
    assert.equal(vm.runInContext('JSON.stringify(clockDateOptions(0x106))', ctx), JSON.stringify({format: 6, weekday: 1, roll: false, align: 0}));
    assert.equal(vm.runInContext('JSON.stringify(clockDateOptions(0x806))', ctx), JSON.stringify({format: 6, weekday: 0, roll: false, align: 1}));
    assert.equal(vm.runInContext('JSON.stringify(clockDateOptions(3))', ctx), JSON.stringify({format: 3, weekday: 0, roll: false, align: 0}));
  }
}

// One value from the editor to the panel: the Web Admin sends it packed as
// clock_date_format (also what import, export and drafts carry), the server
// keeps it valid, the renderer unpacks it.
const admin = read('src/types/clock/admin.js');
assert.match(admin, /formData\.append\('clock_date_format', String\(packClockDateOptions\(/);
assert.match(admin, /const dateOptions = clockDateOptions\(/);
assert.match(read('src/types/clock/web_handler.cpp'), /clock_tile::normalize_date_options\(server\.arg\("clock_date_format"\)\.toInt\(\)\)/);
const renderer = read('src/types/clock/renderer.cpp');
assert.match(renderer, /clock_tile::unpack_date_options\(tile\.sensor_gauge_max\)/);
assert.match(renderer, /widget_config\.roll = date_options\.roll;/);
// Rolling: LVGL animations on the cell strips, only without text shadow,
// the first text without a roll.
assert.match(renderer, /if \(config\.roll && !config\.text_shadow\) \{\s*time_label = create_clock_roll_line\(/);
assert.match(renderer, /lv_anim_set_exec_cb\(&anim, clock_roll_y\);[\s\S]*?lv_anim_set_completed_cb\(&anim, clock_roll_done\);/);
assert.match(renderer, /update_clock_labels\(data\);\s*\/\/ The first text appears at once; later minutes roll\.\s*data->roll_started = true;/);
// Web fields: the roll checkbox, the new formats by example, the weekday.
const html = read('src/types/clock/web_html.cpp');
for (const id of ['_clock_roll', '_clock_weekday']) assert.ok(html.includes(id + '"'), id);
assert.match(html, /<option value="4">DD\/MM\/YYYY<\/option>/);
assert.match(html, /clock_tile::format_date\(sample, sizeof\(sample\), 21, 7, 2026, clock_tile::DATE_FORMAT_D_MONTH_YEAR, language\);/);
assert.match(read('src/types/clock/web_scripts.cpp'), /const CLOCK_I18N = Object\.freeze\(/);
// The editor refreshes on the new fields.
const editor = read('src/web/admin/tiles/editor.js');
assert.ok(editor.includes("target.id === (prefix + '_clock_weekday')") && editor.includes("target.id === (prefix + '_clock_roll')"));
// The preview's date digits are fixed-width like the panel's.
for (const file of ['src/web/admin/tiles/grid-preview.js', 'src/web/admin/tiles/live-preview.js']) {
  assert.match(read(file), /clockDigitsHtml\(getClockPreviewDate\(/, file);
}
assert.match(admin, /setClockDigits\(dateEl, getClockPreviewDate\(dateFormat, weekday, \(flags & 2\) !== 0\)\);/);
// Alignment (user 2026-10-12): left, centered, right on the panel and in
// the preview; without a title or icon the lines use the whole card height.
assert.match(renderer, /widget_config\.time_alignment = clock_tile::tile_alignment\(date_options\.align\);/);
assert.match(renderer, /if \(!compact && !has_header\) lv_obj_set_style_pad_ver\(card, 0, 0\);/);
assert.match(renderer, /date_options\.align == 1 +\? LV_ALIGN_LEFT_MID/);
assert.ok(html.includes('_clock_align"'), 'alignment select');
const css = read('src/web/assets/admin.css');
assert.ok(css.includes('.tile.clock:not(.clock-has-header):not(.clock-compact) { padding-top:0; padding-bottom:0; }'));
assert.ok(css.includes('.tile.clock:not(.clock-compact).clock-align-left { align-items:flex-start; }'));
assert.ok(css.includes('.tile.clock.clock-compact.clock-align-right { justify-content:flex-end; }'));
assert.ok(editor.includes("target.id === (prefix + '_clock_align')"));
console.log('Clock date options: weekday, formats, rolling digits and alignment, panel and preview alike');
