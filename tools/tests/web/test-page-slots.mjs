// The page slots above Home (head bar layouts, user 2026-10-12) with the
// delivered Web Admin code and a simulated device: a Home folder dropped on a
// slot becomes a page (its tile leaves Home's preview, the heads show the
// dots and the page's gear), a locked folder asks once before its PIN goes,
// slots reorder by dragging, a page dragged onto the grid becomes a tile again
// at the dropped spot, and a seventh page is refused without a request.
import {readAdminDeliverySource, readRepoFile, inlineScriptSafe} from '../../lib/admin-source.mjs';
import {runDomHarness} from '../../lib/headless-dom.mjs';

const TILES = 24;
const head = (folder, button) => `<div class="head-bar-preview" aria-hidden="true"><span class="head-disc"><i class="mdi mdi-home"></i></span>` +
  `<span class="head-title">${folder}</span><span class="head-time">12:00</span>` +
  `<span class="head-button ${button}"><i class="mdi mdi-${button ? 'cog' : 'window-close'}"></i></span></div>`;
const html = `<!doctype html><html><head><style>
${readRepoFile('src/web/assets/admin.css')}
:root { --grid-cols:6; --grid-rows:4; --preview-cell-w:100px; --preview-cell-h:100px; --preview-gap:10px; --preview-pad:0px; }
</style></head><body>
<div id="tab-tiles-folder0" class="tile-tab tab-content active" data-folder-id="0"><div class="tile-editor"><div class="tile-editor-main">
<div class="tile-grid-scroll"><div class="tile-grid head-bar-grid" id="folder0Grid">${head('Home', 'head-gear')}
${Array.from({length: TILES}, (_, i) => `<div class="tile empty" id="folder0-tile-${i}" data-index="${i}" data-type="0" draggable="true"></div>`).join('')}
</div></div>
<div class="settings-hidden-parking page-parking"><div id="pageSlots" class="page-slots" data-pages="">${
  Array.from({length: 5}, () => '<div class="page-slot empty" draggable="false"><i class="mdi mdi-tray-arrow-down"></i></div>').join('')}</div>
<div id="settingsHiddenSlot" class="tile-grid settings-hidden-slot"><div id="settingsHiddenTile" class="tile settings-hidden-tile empty" data-hidden="0"></div></div></div>
</div></div></div>
<div id="tab-tiles-folder1" class="tile-tab tab-content" data-folder-id="1"><div class="tile-grid head-bar-grid" id="folder1Grid">${head('Lights', '')}</div></div>
<div id="folder0Settings" class="tile-settings"><div class="tile-specific-settings">
<select id="folder0_tile_type"><option value="0">Empty</option><option value="4">Folder</option><option value="7">Settings</option></select>
<textarea id="folder0_tile_title"></textarea><input id="folder0_tile_icon"><input type="color" id="folder0_tile_color">
${['col','row','span_w','span_h'].map(name => `<input id="folder0_tile_${name}" type="number" value="1">`).join('')}
</div></div><pre id="result">running</pre><script>
const nativeListen = document.addEventListener.bind(document);
document.addEventListener = (name, ...args) => { if (name !== 'DOMContentLoaded') nativeListen(name, ...args); };
const APP_I18N = {}, CLIMATE_I18N = {}, BINARY_SENSOR_I18N = {};
const GRID_COLS = 6, GRID_ROWS = 4, TILES_PER_GRID = ${TILES}, ADMIN_WEB_SESSION_TOKEN = 'test';
const TILE_TYPE_REGISTRY = {
  4: {label:'Folder',css:'navigate',fields:'navigate',preview:'none',load:'loadNavigateFields',reset:'resetNavigateFields'},
  7: {label:'Settings',css:'navigate',fields:'settings_access',preview:'none',locked:true,reset:'resetNavigateFields'}
};
const TILE_TABS = [], TAB_BY_FOLDER = {}, FOLDER_BY_TAB = {}, SCREENSAVER_FOLDER_ID = 65535;
const SCREENSAVER_TILE_DEFAULT_OPACITY = 0, SCREENSAVER_TILE_DEFAULT_COLOR = '#000000';
const MEDIA_TILE_MIN_SPAN = 2, MEDIA_TILE_MAX_SPAN = 3, MEDIA_TILE_TYPE = 15;
// The simulated device: Home with three folders (3 locked), the pages.
const empty = () => ({type:0});
const device = Array.from({length: ${TILES}}, empty);
device[0] = {type:4,title:'Lights',icon_name:'lightbulb',navigate_target:1,col:0,row:0,span_w:1,span_h:1};
device[1] = {type:4,title:'Climate',icon_name:'thermostat',navigate_target:2,col:1,row:0,span_w:1,span_h:1};
device[2] = {type:4,title:'Alarm',icon_name:'shield',navigate_target:3,col:2,row:0,span_w:1,span_h:1,folder_pin_enabled:true};
// More Home folders for the five-pages limit.
[11, 12, 13, 14, 15].forEach((folder, i) => {
  device[3 + i] = {type:4,title:'F' + folder,icon_name:'folder',navigate_target:folder,col:(3 + i) % 6,row:Math.floor((3 + i) / 6),span_w:1,span_h:1};
});
const locked = new Set([3]);
let pages = [];
const log = [];
window.addEventListener('error', event => log.push('ERR ' + event.message));
let confirms = 0;
window.confirm = () => { ++confirms; return true; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
window.fetch = async (url, options) => {
  if (options?.method === 'POST') {
    const body = Object.fromEntries(new URLSearchParams(options.body));
    log.push(url + ' ' + JSON.stringify(body));
    await wait(20);
    if (url !== '/api/pages') return {ok:true, status:200, json:async()=>({success:true})};
    const wanted = body.pages ? body.pages.split(',').map(Number) : [];
    const fresh = wanted.filter(id => !pages.includes(id));
    const lockedNew = fresh.find(id => locked.has(id));
    if (lockedNew && body.unlock !== '1') {
      return {ok:false, status:409, json:async()=>({success:false,error:'locked',folder:lockedNew})};
    }
    fresh.forEach(id => locked.delete(id));
    device.forEach(tile => {
      if (tile.type !== 4) return;
      tile.layout_hidden = wanted.includes(tile.navigate_target);
      if (Number(body.out) === tile.navigate_target) { tile.col = Number(body.col); tile.row = Number(body.row); }
    });
    pages = wanted;
    return {ok:true, status:200, json:async()=>({success:true})};
  }
  if (String(url).startsWith('/api/tiles?folder=0')) {
    await wait(10);
    return {ok:true, status:200, json:async()=>JSON.parse(JSON.stringify(device))};
  }
  return {ok:true, status:200, json:async()=>({})};
};
${inlineScriptSafe(readAdminDeliverySource())}
(async () => { try {
  const check = (value, message) => { if (!value) throw Error(message + '\\n' + log.join('\\n')); };
  const slotsEl = document.getElementById('pageSlots');
  const slots = () => [...slotsEl.querySelectorAll('.page-slot')];
  const grid = getTileGrid('folder0');
  const box = el => el.getBoundingClientRect();
  const at = el => ({clientX: box(el).left + 20, clientY: box(el).top + 20});
  const cellPoint = (col, row) => {
    const m = getTileGridMetrics('folder0');
    return {clientX: m.rect.left + m.padLeft + col * (m.cellW + m.gapX) + 20,
            clientY: m.rect.top + m.padTop + row * (m.cellH + m.gapY) + 20};
  };
  const tileOf = folder => document.getElementById('folder0-tile-' + homeFolderTileIndex(folder));
  const dots = tab => [...document.querySelectorAll('#tab-tiles-' + tab + ' .head-dots > i')].map(dot => dot.classList.contains('on') ? 'O' : 'o').join('');
  const settle = () => wait(300);
  folderByTab.folder0 = 0;
  // A reloaded page (user 2026-10-12: the slots came up empty): the server's
  // tile markup is there, the tile data not yet; the slots find their
  // folders by the markup.
  {
    const served = document.getElementById('folder0-tile-0');
    served.className = 'tile navigate tile-unplaced';
    served.dataset.type = '4';
    served.dataset.navigateTarget = '1';
    served.innerHTML = '<div class="tile-title">Lights</div>';
    slotsEl.dataset.pages = '1';
    renderPageSlots();
    check(slots()[0].classList.contains('has-tile') && slots()[0].querySelector('.tile-title')?.textContent === 'Lights',
          'Before the tile data loads the slot shows its folder');
    slotsEl.dataset.pages = '';
  }
  tileDataLoadedTabs.add('folder0');
  tilesData.folder0 = JSON.parse(JSON.stringify(device));
  tilesData.folder0.forEach((tile, i) => renderTileFromData('folder0', i, tile, {}));
  layoutTiles('folder0', tilesData.folder0);
  enableTileDrag('folder0');
  enablePageSlots();
  check(slots().length === 5 && slots().every(slot => slot.classList.contains('empty')), 'Five empty slots');
  check(getTileGrid('folder0').id === 'folder0Grid', 'The editor still finds the Home grid first');
  check(!dots('folder0'), 'No dots without pages');

  const dropOnSlot = async (source, slotIndex) => {
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(source)}));
    const slot = slots()[slotIndex];
    slot.dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slot)}));
    check(slot.classList.contains('drop-target'), 'The slot shows its drop target: ' + JSON.stringify(dragSource && {kind: dragSource.kind, index: dragSource.index, type: dragSource.type}) + ' ' + draggedHomeFolder());
    slot.dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slot)}));
    source.dispatchEvent(new DragEvent('dragend', {bubbles:true,dataTransfer:transfer}));
    await settle();
  };

  // A folder becomes a page exactly where it is dropped (user 2026-10-12:
  // nothing moves up), gone from Home's preview, shown at once before the
  // device answers (dragging in took long); the dots skip the free places.
  {
    const transfer = new DataTransfer();
    const source = tileOf(1);
    source.dispatchEvent(new DragEvent('dragstart', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(source)}));
    slots()[3].dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slots()[3])}));
    slots()[3].dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slots()[3])}));
    check(slots()[3].classList.contains('has-tile') && slots()[0].classList.contains('empty') &&
          tileOf(1).classList.contains('tile-unplaced') && !pages.length,
          'The page shows where it was dropped, before the device has saved it');
    source.dispatchEvent(new DragEvent('dragend', {bubbles:true,dataTransfer:transfer}));
    await settle();
  }
  check(pages.join() === '0,0,0,1', 'Its place is kept, free places too: ' + pages.join());
  check(slots()[3].dataset.folder === '1' && slots()[3].querySelector('.tile-title')?.textContent.includes('Lights'),
        'The slot shows the folder tile');
  check(dots('folder0') === 'Oo' && dots('folder1') === 'oO', 'The dots skip the free places: ' + dots('folder0') + ' ' + dots('folder1'));
  check(document.querySelector('#tab-tiles-folder1 .head-button i').classList.contains('mdi-cog'), 'A page has the gear');

  // A locked folder asks once, then its PIN goes with the request.
  await dropOnSlot(tileOf(3), 0);
  check(confirms === 1 && pages.join() === '3,0,0,1' && log.filter(line => line.startsWith('/api/pages')).length === 2 &&
        log.some(line => line.includes('"unlock":"1"')), 'A locked folder asks before its PIN goes: ' + pages.join());
  check(dots('folder1') === 'ooO', 'The dots follow the places: ' + dots('folder1'));

  // A page onto a free place moves there; onto another page they swap.
  await dropOnSlot(slots()[3], 1);
  check(pages.join() === '3,1', 'A page moves to a free place: ' + pages.join());
  await dropOnSlot(slots()[0], 1);
  check(pages.join() === '1,3' && slots()[0].dataset.folder === '1' && dots('folder1') === 'oOo',
        'Onto another page they swap: ' + pages.join());

  // A folder from the grid takes free places only.
  {
    const transfer = new DataTransfer();
    const source = tileOf(11);
    source.dispatchEvent(new DragEvent('dragstart', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(source)}));
    slots()[0].dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slots()[0])}));
    check(!slots()[0].classList.contains('drop-target'), 'A page is no drop target for a folder from the grid');
    source.dispatchEvent(new DragEvent('dragend', {bubbles:true,dataTransfer:transfer}));
  }

  // A page dragged onto the grid is a tile again where it was dropped; its
  // place stays free.
  {
    const slot = slots()[0];
    const transfer = new DataTransfer();
    slot.dispatchEvent(new DragEvent('dragstart', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slot)}));
    grid.dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:transfer,...cellPoint(4, 2)}));
    check(grid.querySelector('.tile-drop-placeholder.show:not(.invalid)'), 'The grid shows a valid placeholder');
    grid.dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer,...cellPoint(4, 2)}));
    slot.dispatchEvent(new DragEvent('dragend', {bubbles:true,dataTransfer:transfer}));
    await settle();
  }
  check(pages.join() === '0,3' && log.at(-1).includes('"out":"1"') && log.at(-1).includes('"col":"4"') &&
        log.at(-1).includes('"row":"2"'), 'The page leaves at the dropped spot: ' + log.at(-1));
  check(!tileOf(1).classList.contains('tile-unplaced') && slots()[0].classList.contains('empty') &&
        slots()[1].dataset.folder === '3', 'Its tile is back, its place free, the other page stays');
  check(document.querySelector('#tab-tiles-folder1 .head-button i').classList.contains('mdi-window-close') &&
        !dots('folder1'), 'A folder again: its X, no dots');

  // Five pages: no free place, nothing is sent.
  slotsEl.dataset.pages = '3,11,12,13,14';
  pages = [3, 11, 12, 13, 14];
  renderPageSlots();
  const posts = log.length;
  {
    const transfer = new DataTransfer();
    const source = tileOf(1);
    source.dispatchEvent(new DragEvent('dragstart', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(source)}));
    slots()[2].dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slots()[2])}));
    slots()[2].dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer,...at(slots()[2])}));
    source.dispatchEvent(new DragEvent('dragend', {bubbles:true,dataTransfer:transfer}));
    await settle();
  }
  check(log.length === posts && !tileOf(1).classList.contains('tile-unplaced'), 'A sixth page sends nothing');
  // A tap on a page picks its folder tile in the editor, with the teal
  // selection in the slot.
  // Nothing is built again for it (user 2026-10-12: the slots and the head
  // blinked on every pick): the same slot tile and head dots stay.
  const shownTile = slots()[0].querySelector('.tile');
  const shownDots = document.querySelector('#tab-tiles-folder0 .head-dots');
  slots()[0].dispatchEvent(new MouseEvent('click', {bubbles:true}));
  await wait(100);
  check(slots()[0].querySelector('.tile') === shownTile && document.querySelector('#tab-tiles-folder0 .head-dots') === shownDots,
        'A pick rebuilds neither the slot nor the dots');
  check(currentTileTab === 'folder0' && currentTileIndex === homeFolderTileIndex(3) &&
        slots()[0].querySelector('.tile')?.classList.contains('active'), 'A tap on a page picks its folder: ' + [currentTileTab, currentTileIndex, homeFolderTileIndex(3), slots()[0].dataset.folder, slots()[0].querySelector('.tile')?.className].join(' '));
  document.body.dataset.result = 'pass';
} catch (error) {
  document.body.dataset.result = 'fail'; document.getElementById('result').textContent = error.stack;
}})();
</script></body></html>`;

try {
  runDomHarness({label: 'Page slots', html, tmpPrefix: 'hometiles-page-slots-', extraArgs: ['--virtual-time-budget=10000']});
} catch (error) {
  throw Error(error.message.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1] || error.message.slice(0, 1500));
}
console.log('Page slots: places kept, PIN question, move and swap, drop out, five at most');
