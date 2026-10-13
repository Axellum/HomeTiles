  // Home's page fields and Settings field (head bar layouts, user 2026-10-13,
  // build/design-mockups/pages/felder-*.png): cells of Home's own grid,
  // exactly the tiles' size, in two columns beside a square or upright screen
  // or in rows under a landscape one. A page is its folder's own tile shown
  // in its field (one cell), dragged like any tile: a Home folder onto a free
  // field becomes a page, a page onto the screen a folder tile again, a page
  // onto another field moves there (onto a page they swap). The parked
  // Settings tile stands in the Settings field (settings/access.js parks it).
  // The dots take the pages in field order and skip the free fields.
  const PAGE_SLOT_COUNT = 5;

  // The markup's holder: the page places (data-pages), and at first the
  // fields' elements, which layoutPageFields moves into the grid.
  function pageSlotsElement() {
    return document.getElementById('pageSlots');
  }

  // The places as stored, without looking for their tiles.
  function pageSlotIds() {
    const stored = String(pageSlotsElement()?.dataset.pages || '').split(',').map(Number);
    return Array.from({length: PAGE_SLOT_COUNT}, (_, i) => stored[i] > 0 ? stored[i] : 0);
  }

  // The places as put: a folder or 0 for a free one; a folder deleted
  // meanwhile has left its place free.
  function pageSlotList() {
    const stored = String(pageSlotsElement()?.dataset.pages || '').split(',').map(Number);
    return Array.from({length: PAGE_SLOT_COUNT}, (_, i) => stored[i] > 0 && homeFolderTile(stored[i]) ? stored[i] : 0);
  }

  // The pages in dot order.
  function pageFolders() {
    return pageSlotList().filter(id => id > 0);
  }

  // The stored form: up to the last page, free places as 0.
  function encodePageSlots(slots) {
    const last = slots.reduce((end, id, i) => id ? i + 1 : end, 0);
    return slots.slice(0, last).join(',');
  }

  // Home's folder tile of a folder, from the page itself: the server and
  // the browser both mark it (data-navigate-target), also before the tile
  // data has loaded.
  function homeFolderTile(folderId) {
    return getTileGrid('folder0')?.querySelector(
      ':scope > .tile[data-type="4"][data-navigate-target="' + Number(folderId) + '"]') || null;
  }

  function homeFolderTileIndex(folderId) {
    const tile = homeFolderTile(folderId);
    return tile ? Number(tile.dataset.index) : -1;
  }

  // The fields show in Home's grid of a head bar layout (not in the layout
  // window, which shows each layout without its head: HEAD_BAR is off).
  function pageFieldsShown() {
    return !!pageSlotsElement() && headBarLayout();
  }

  // Where the fields lie, in the grid's cell units from its first cell
  // (fractional: they start one grid gap off the screen's edge), and the
  // room they take beside or under the screen.
  function pageFieldPlaces(grid) {
    const style = getComputedStyle(grid);
    const px = name => parseFloat(style.getPropertyValue(name)) || 0;
    const cellW = px('--preview-cell-w'), cellH = px('--preview-cell-h'), gap = px('--preview-gap');
    const padRight = px('--preview-pad-right') || px('--preview-pad');
    const padBottom = px('--preview-pad-bottom') || px('--preview-pad');
    const cols = placeCols('folder0'), rows = placeRows('folder0');
    const stepX = cellW + gap, stepY = cellH + gap;
    const screenW = cols * stepX - gap, screenH = rows * stepY - gap;
    // The fields lie on a black box of their own like the screen (user
    // 2026-10-13), its margin one grid gap, one word over it.
    const fieldRows = cols > rows ? Math.floor(PAGE_SLOT_COUNT / cols) + 1 : Math.ceil((PAGE_SLOT_COUNT + 1) / 2);
    if (cols > rows) {
      // Under a landscape screen in its columns; the Settings field last,
      // in the sixth column or under the last one.
      const word = 20 + gap;
      const top = (screenH + padBottom + word) / stepY;
      const at = (col, row) => ({col, row: top + row});
      return {
        pages: Array.from({length: PAGE_SLOT_COUNT}, (_, i) => at(i % cols, Math.floor(i / cols))),
        settings: at(cols - 1, Math.floor(PAGE_SLOT_COUNT / cols)),
        right: 0,
        bottom: word + fieldRows * stepY,
        // The box from the screen's left edge to its right one (padding box
        // units, from the first cell's corner).
        box: {x: null, y: screenH + padBottom + word - gap, w: null, h: fieldRows * stepY + gap},
        word: {x: 0, y: screenH + padBottom + 3}
      };
    }
    // Beside a square or upright screen in two columns along its rows, the
    // word in its head's height; the Settings field bottom right.
    const apart = 14;
    const left = (screenW + padRight + apart + gap) / stepX;
    return {
      pages: Array.from({length: PAGE_SLOT_COUNT}, (_, i) => ({col: left + i % 2, row: Math.floor(i / 2)})),
      settings: {col: left + 1, row: Math.floor(PAGE_SLOT_COUNT / 2)},
      right: apart + 2 * stepX + gap,
      bottom: 0,
      box: {x: screenW + padRight + apart, y: -gap, w: 2 * stepX + gap, h: fieldRows * stepY + gap},
      word: {x: screenW + padRight + apart, y: -gap - 19}
    };
  }

  function setFieldPlace(el, place) {
    el.style.setProperty('--tile-col', String(place.col));
    el.style.setProperty('--tile-row', String(place.row));
  }

  // A page's folder tile stands in its field as one cell (layout.js
  // layoutTiles, grid-preview.js renderTileFromData).
  function pageFieldOfTile(tab, tile) {
    if (tab !== 'folder0' || !tile?.layout_hidden || Number(tile.type) !== 4 || !pageFieldsShown()) return null;
    const slot = pageSlotIds().indexOf(Number(tile.navigate_target));
    const grid = getTileGrid('folder0');
    return slot >= 0 && grid ? pageFieldPlaces(grid).pages[slot] : null;
  }

  // The tile picked in the editor is a page's: one cell in its field, the
  // editor neither moves nor sizes it (layout.js updateLayoutFromInputs,
  // live-preview.js, type-selection.js) and its stored size stays.
  function selectedPageTile(tab) {
    return currentTileIndex >= 0 &&
      !!document.getElementById(tab + '-tile-' + currentTileIndex)?.classList.contains('page-field-tile');
  }

  // Shown there only: its stored place (the tile's data-col/-row, which a
  // tile save sends) stays as it is.
  function placeOnPageField(el, place) {
    el.classList.remove('tile-unplaced');
    el.classList.add('fractional-tile', 'page-field-tile');
    el.style.gridColumn = 'auto';
    el.style.gridRow = 'auto';
    for (const [name, value] of Object.entries({col: place.col, row: place.row, w: 1, h: 1})) {
      el.style.setProperty('--tile-' + name, String(value));
    }
    el.style.display = '';
  }

  // The grid's room for the fields, the screen drawn behind its own part
  // only (admin.css .has-page-fields), the free fields' frames, the word
  // and the Settings field. Runs after every layout of Home's grid.
  function layoutPageFields(tab) {
    const holder = pageSlotsElement();
    const grid = getTileGrid('folder0');
    if (tab !== 'folder0' || !holder || !grid) return;
    if (holder.children.length) grid.append(...holder.children);
    const shown = pageFieldsShown();
    grid.classList.toggle('has-page-fields', shown);
    if (!shown) {
      grid.style.removeProperty('--fields-right');
      grid.style.removeProperty('--fields-bottom');
      return;
    }
    const places = pageFieldPlaces(grid);
    grid.style.setProperty('--fields-right', places.right + 'px');
    grid.style.setProperty('--fields-bottom', places.bottom + 'px');
    // The fields' box (admin.css .has-page-fields::after), from the grid's
    // padding box corner; under the screen as wide as it.
    const style = getComputedStyle(grid);
    const padLeft = parseFloat(style.paddingLeft) || 0, padTop = parseFloat(style.paddingTop) || 0;
    const box = places.box;
    const boxLeft = box.x === null ? -1 : padLeft + box.x;
    const boxTop = padTop + box.y;
    const boxWidth = box.w === null ? grid.clientWidth + 2 - (parseFloat(style.getPropertyValue('--fields-right')) || 0) : box.w + 1;
    grid.style.setProperty('--fields-box-l', boxLeft + 'px');
    grid.style.setProperty('--fields-box-t', boxTop + 'px');
    grid.style.setProperty('--fields-box-w', boxWidth + 'px');
    grid.style.setProperty('--fields-box-h', (box.x === null ? grid.clientHeight + 1 - boxTop : box.h) + 'px');
    const slots = pageSlotList();
    grid.querySelectorAll(':scope > .page-field').forEach(field => {
      const slot = Number(field.dataset.slot);
      setFieldPlace(field, places.pages[slot]);
      field.hidden = !!slots[slot];
    });
    const word = grid.querySelector(':scope > .page-fields-label');
    if (word) {
      word.style.setProperty('--word-x', places.word.x + 'px');
      word.style.setProperty('--word-y', places.word.y + 'px');
    }
    const settings = grid.querySelector(':scope > .settings-hidden-slot');
    if (settings) setFieldPlace(settings, places.settings);
  }

  // The field under the pointer: a page field or the Settings field.
  function pageFieldAt(clientX, clientY) {
    const grid = getTileGrid('folder0');
    if (!grid || !pageFieldsShown()) return null;
    const style = getComputedStyle(grid);
    const px = name => parseFloat(style.getPropertyValue(name)) || 0;
    const rect = grid.getBoundingClientRect();
    const cellW = px('--preview-cell-w'), cellH = px('--preview-cell-h'), gap = px('--preview-gap');
    const left = rect.left + grid.clientLeft + parseFloat(style.paddingLeft);
    const top = rect.top + grid.clientTop + parseFloat(style.paddingTop);
    const inside = place => place &&
      clientX >= left + place.col * (cellW + gap) && clientX < left + place.col * (cellW + gap) + cellW &&
      clientY >= top + place.row * (cellH + gap) && clientY < top + place.row * (cellH + gap) + cellH;
    const places = pageFieldPlaces(grid);
    const slot = places.pages.findIndex(inside);
    if (slot >= 0) return {kind: 'page', slot, place: places.pages[slot]};
    return inside(places.settings) ? {kind: 'settings', place: places.settings} : null;
  }

  // True beside or under the screen, where only the fields are: no free
  // slot follows the pointer there (layout.js enableFreeSlotHover).
  function pointerBesideScreen(grid, clientX, clientY) {
    if (!grid?.classList.contains('has-page-fields')) return false;
    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    return clientX > rect.right - (parseFloat(style.getPropertyValue('--fields-right')) || 0) ||
      clientY > rect.bottom - (parseFloat(style.getPropertyValue('--fields-bottom')) || 0);
  }

  function draggedHomeFolder() {
    if (!dragSource || dragSource.kind !== 'grid-tile' || dragSource.tab !== 'folder0') return 0;
    const tile = document.getElementById('folder0-tile-' + dragSource.index);
    return tile?.dataset.type === '4' ? Number(tile.dataset.navigateTarget || 0) : 0;
  }

  // A drag over a field (drag-resize.js asks first): the grid's placeholder
  // there, and the drop decides there. False when no field is under the
  // pointer, so the grid handles it.
  function pageFieldDrag(tab, event, drop) {
    if (tab !== 'folder0' || !dragSource) return false;
    const field = pageFieldAt(event.clientX, event.clientY);
    if (!field) return false;
    event.preventDefault();
    if (drop) event.stopPropagation();
    const places = pageSlotList();
    const folder = dragSource.kind === 'page-slot' ? dragSource.folder : draggedHomeFolder();
    const settings = dragSource.kind === 'hidden-settings' ||
      (dragSource.kind === 'grid-tile' && Number(dragSource.type) === 7);
    // A folder onto a free field, a page onto any; Settings onto its own.
    const fits = field.kind === 'page'
      ? folder > 0 && (dragSource.kind === 'page-slot' || !places[field.slot])
      : settings;
    restoreDragPreview(tab);
    dragSource.previewKey = '';
    if (!drop) {
      event.dataTransfer.dropEffect = fits ? 'move' : 'none';
      const placeholder = ensureDragPlaceholder(tab);
      if (placeholder) {
        placeholder.classList.add('show');
        placeholder.classList.toggle('invalid', !fits);
        setTileGridPosition(placeholder, field.place.col, field.place.row, 1, 1);
      }
      return true;
    }
    clearDragPlaceholder();
    if (!fits) return true;
    if (field.kind === 'settings') {
      dragSource.dropCommitted = true;
      if (dragSource.kind !== 'hidden-settings') hideSettingsTileFromGrid();
      return true;
    }
    const from = places.indexOf(folder);
    if (from === field.slot) return true;
    // Pages have no PIN: a locked folder asks before it becomes one.
    const unlock = from < 0 && homeFolderTile(folder)?.dataset.folderPinEnabled === '1';
    if (unlock && !window.confirm(t('pageUnlockConfirm'))) return true;
    dragSource.dropCommitted = true;
    // Exactly where it is dropped; the page there takes its old place.
    if (from >= 0) places[from] = places[field.slot];
    places[field.slot] = folder;
    savePages(places, {}, unlock);
    return true;
  }

  // Home and the pages show the dots in their head and the gear; a page
  // left the fields shows its X again (home_bar.cpp). Only what differs is
  // touched: rebuilding the dots for every folder tab the page loaded made
  // them blink (user 2026-10-12). The layout window passes its own pages.
  function syncPageHeads(pages = pageFolders()) {
    document.querySelectorAll('.tile-tab[data-folder-id]').forEach(tab => {
      const head = tab.querySelector('.head-bar-preview');
      if (!head) return;
      const folder = Number(tab.dataset.folderId);
      const page = !pages.length ? -1 : folder === 0 ? 0 : pages.indexOf(folder) + (pages.includes(folder) ? 1 : -1);
      const want = page < 0 ? '' : Array.from({length: pages.length + 1}, (_, i) => i === page ? 'O' : 'o').join('');
      const shown = head.querySelector('.head-dots');
      const have = shown ? Array.from(shown.children, dot => dot.classList.contains('on') ? 'O' : 'o').join('') : '';
      if (have !== want) {
        shown?.remove();
        head.classList.toggle('has-dots', page >= 0);
        if (page >= 0) {
          head.style.setProperty('--head-dots-n', String(pages.length + 1));
          const dots = document.createElement('span');
          dots.className = 'head-dots';
          for (let i = 0; i <= pages.length; ++i) {
            const dot = document.createElement('i');
            if (i === page) dot.className = 'on';
            dots.appendChild(dot);
          }
          head.insertBefore(dots, head.querySelector('.head-time'));
        }
      }
      if (folder === 0) return;
      const button = head.querySelector('.head-button');
      const icon = button?.querySelector('i');
      if (!button || !icon) return;
      const homeGear = document.querySelector('#tab-tiles-folder0 .head-bar-preview .head-gear');
      const iconClass = 'mdi ' + (page > 0 ? 'mdi-cog' : 'mdi-window-close');
      if (button.classList.contains('head-gear') !== page > 0) button.classList.toggle('head-gear', page > 0);
      const off = page > 0 && !!homeGear?.classList.contains('is-off');
      if (button.classList.contains('is-off') !== off) button.classList.toggle('is-off', off);
      if (icon.className !== iconClass) icon.className = iconClass;
    });
  }

  // Shows a change of the pages at once, like any move: Home's folder tiles
  // in their fields or on the screen, and the heads. `slots` and `previous`
  // are the places after and before; a folder leaving them comes back on the
  // screen as one cell (`out`: at its dropped spot).
  function showPagesLocally(slots, previous, out = null) {
    pageSlotsElement().dataset.pages = encodePageSlots(slots);
    const tiles = getTilesData('folder0') || [];
    const pages = slots.filter(id => id > 0);
    new Set([...pages, ...previous.filter(id => id > 0)]).forEach(folder => {
      const el = homeFolderTile(folder);
      const tile = el ? tiles[Number(el.dataset.index)] : null;
      if (!tile) return;
      const page = pages.includes(folder);
      // A folder in the fields is one cell, and comes back as one (user
      // 2026-10-12: a half-high one changed its size in and out).
      tile.layout_hidden = page;
      Object.assign(tile, {span_w: 1, span_h: 1});
      if (!page && out && out.folder === folder) Object.assign(tile, {col: out.col, row: out.row});
      renderTileFromData('folder0', Number(el.dataset.index), tile, sensorMetaCache);
    });
    layoutTiles('folder0', tiles);
    syncPageHeads();
    // A page has no PIN: its folder's PIN option goes.
    if (currentTileTab === 'folder0' && typeof syncFolderPinControls === 'function') syncFolderPinControls('folder0');
  }

  // The saves go out one after the other; each shows before it is sent.
  let pageSlotsQueue = Promise.resolve();

  function savePages(slots, extra = {}, unlock = false) {
    const previous = pageSlotList();
    const out = extra.out ? {folder: Number(extra.out), col: Number(extra.col), row: Number(extra.row)} : null;
    showPagesLocally(slots, previous, out);
    pageSlotsQueue = pageSlotsQueue.then(() => sendPages(slots, previous, extra, unlock));
    return pageSlotsQueue;
  }

  async function sendPages(slots, previous, extra, unlock) {
    const undo = message => {
      showPagesLocally(previous, slots);
      showNotification(message, false);
      return false;
    };
    try {
      const body = new URLSearchParams({pages: encodePageSlots(slots)});
      if (unlock) body.set('unlock', '1');
      ['out', 'col', 'row'].forEach(key => {
        if (extra[key] !== undefined) body.set(key, String(extra[key]));
      });
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString()
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data.success) {
        return undo(data.error === 'No free cell' ? t('tileDoesNotFit') : t('networkErrorSave'));
      }
      const tiles = getTilesData('folder0') || [];
      // A page has no PIN: its lock went with the save.
      if (unlock) {
        slots.filter(id => id > 0).forEach(folder => {
          const index = homeFolderTileIndex(folder);
          if (index < 0 || !tiles[index]) return;
          tiles[index].folder_pin_enabled = false;
          renderTileFromData('folder0', index, tiles[index], sensorMetaCache);
        });
        layoutTiles('folder0', tiles);
      }
      // A folder back on the screen: the place the device gave it.
      if (extra.out !== undefined) {
        const index = homeFolderTileIndex(Number(extra.out));
        const tile = index >= 0 ? tiles[index] : null;
        const place = tile ? data.places?.[ACTIVE_LAYOUT]?.['0']?.[String(tile.view_id)] : null;
        if (place) {
          Object.assign(tile, {col: place[0], row: place[1], span_w: place[2], span_h: place[3]});
          renderTileFromData('folder0', index, tile, sensorMetaCache);
          layoutTiles('folder0', tiles);
        } else {
          const fresh = await fetchTileGridData('folder0', true);
          fresh.forEach((data, i) => renderTileFromData('folder0', i, data, sensorMetaCache));
          layoutTiles('folder0', fresh);
        }
      }
      showNotification(t('pagesSaved'));
      return true;
    } catch (error) {
      return undo(t('networkErrorSave'));
    }
  }

  // A page leaving the fields onto Home's screen (drag-resize.js
  // handleGridDrop).
  function canPlacePageTile(candidate) {
    if (!dragSource || dragSource.kind !== 'page-slot') return false;
    return supportedTileLayout(4, candidate) && canPlaceTileLayout('folder0', dragSource.index, candidate);
  }

  function dropPageOnGrid(candidate) {
    const folder = dragSource.folder;
    dragSource.dropCommitted = true;
    // One cell, like the device (/api/pages).
    const place = {col: candidate.col, row: candidate.row, span_w: 1, span_h: 1};
    // In the layout window it stays there until "Speichern" (layout-window.js).
    if (typeof layoutWindowOpen === 'function' && layoutWindowOpen()) {
      layoutPageOut(folder, place);
      return;
    }
    // Its field stays free.
    savePages(pageSlotList().map(id => id === folder ? 0 : id), {out: folder, ...place});
  }

  function enablePageFields() {
    const grid = getTileGrid('folder0');
    if (!pageSlotsElement() || !grid || grid.dataset.pageFieldsBound === '1') return;
    grid.dataset.pageFieldsBound = '1';
    layoutPageFields('folder0');
    syncPageHeads();
    // A page's tile is taken like any tile; its drag is a page's: one cell,
    // onto the screen it becomes a folder tile again (after the tile's own
    // dragstart, drag-resize.js enableTileDrag).
    grid.addEventListener('dragstart', event => {
      const tile = event.target.closest?.('.tile.page-field-tile');
      if (!tile || dragSource?.kind !== 'grid-tile' || dragSource.index !== Number(tile.dataset.index)) return;
      // The grab point from where it is drawn: its stored place lies elsewhere.
      dragSource = {...dragSource, kind: 'page-slot', folder: Number(tile.dataset.navigateTarget || 0),
        layout: {col: 0, row: 0, span_w: 1, span_h: 1}, grabCellCol: 0, grabCellRow: 0,
        dropOffset: getDragGrabOffset(tile.getBoundingClientRect(), event.clientX, event.clientY),
        baseLayouts: null, pageTarget: null};
    });
  }
