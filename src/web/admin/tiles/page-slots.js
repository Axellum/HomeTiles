  // The page slots under Home's preview (head bar layouts, user 2026-10-12,
  // tile_layouts::pages): five places beside the Settings slot. A Home
  // folder dropped on a free one becomes a page beside Home (its tile leaves
  // Home), a page dragged onto the grid becomes a folder tile again. Every
  // page stays where it was put, free places too; the panel's dots take the
  // pages in this order and skip the free places.
  const PAGE_SLOT_COUNT = 5;

  function pageSlotsElement() {
    return document.getElementById('pageSlots');
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

  // A filled slot shows the page's folder tile as the grid draws it (its
  // tile stays in Home's grid, hidden: tile-unplaced). Only what changed is
  // touched: rebuilding every slot on each change made them blink (user
  // 2026-10-12).
  function renderPageSlots() {
    const slots = pageSlotsElement();
    if (!slots) return;
    const places = pageSlotList();
    slots.querySelectorAll('.page-slot').forEach((slot, i) => {
      const folder = places[i] || 0;
      const source = folder ? homeFolderTile(folder) : null;
      const selected = !!source && currentTileTab === 'folder0' && currentTileIndex === Number(source.dataset.index);
      // The folder tile's look without its place in the grid and without
      // the editor's marks and handles; no id or index, so the editor never
      // takes it for a grid tile.
      let tile = null;
      if (source) {
        tile = document.createElement('div');
        tile.className = source.className;
        tile.classList.remove('tile-unplaced', 'fractional-tile', 'active', 'dragging', 'drop-target',
          'sensor-compact', 'sensor-half', 'compact-title-only');
        for (const property of Array.from(source.style)) {
          if (/^(grid|display|--tile-(col|row|w|h)$)/.test(property)) continue;
          tile.style.setProperty(property, source.style.getPropertyValue(property));
        }
        tile.innerHTML = source.innerHTML;
        tile.querySelectorAll('.tile-resize-handle').forEach(handle => handle.remove());
      }
      const look = tile ? tile.className + '|' + tile.style.cssText + '|' + tile.innerHTML : '';
      if (slot.dataset.look === look && slot.dataset.folder === (folder ? String(folder) : '')) {
        slot.querySelector(':scope > .tile')?.classList.toggle('active', selected);
        return;
      }
      slot.dataset.look = look;
      slot.dataset.folder = folder ? String(folder) : '';
      slot.draggable = !!tile;
      slot.className = 'page-slot ' + (tile ? 'has-tile' : 'empty');
      if (!tile) {
        slot.replaceChildren();
        return;
      }
      // Picked in the editor: the teal selection like in the grid.
      tile.classList.toggle('active', selected);
      slot.replaceChildren(tile);
    });
  }

  // Home and the pages show the dots in their head and the gear; a page
  // left the slots shows its X again (home_bar.cpp). Only what differs is
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

  // Shows a change of the pages at once, like the Settings parking slot:
  // the slots, Home's folder tiles and the heads. `slots` and `previous` are
  // the places after and before; a folder leaving them comes back on the
  // grid (`out`: at its dropped spot).
  function showPagesLocally(slots, previous, out = null) {
    pageSlotsElement().dataset.pages = encodePageSlots(slots);
    const loaded = tileDataLoadedTabs.has('folder0');
    const tiles = getTilesData('folder0') || [];
    const pages = slots.filter(id => id > 0);
    const folders = new Set([...pages, ...previous.filter(id => id > 0)]);
    folders.forEach(folder => {
      const el = homeFolderTile(folder);
      if (!el) return;
      const page = pages.includes(folder);
      const tile = loaded ? tiles[Number(el.dataset.index)] : null;
      if (tile) {
        tile.layout_hidden = page;
        if (!page && out && out.folder === folder) {
          Object.assign(tile, {col: out.col, row: out.row, span_w: out.span_w, span_h: out.span_h});
          // Drawn again in its size (a half-high tile has its own look).
          renderTileFromData('folder0', Number(el.dataset.index), tile, sensorMetaCache);
        }
      }
      el.classList.toggle('tile-unplaced', page);
    });
    if (loaded) layoutTiles('folder0', tiles);
    renderPageSlots();
    syncPageHeads();
    // A page has no PIN: its folder's PIN option goes.
    if (currentTileTab === 'folder0' && typeof syncFolderPinControls === 'function') syncFolderPinControls('folder0');
  }

  // The saves go out one after the other; each shows before it is sent.
  let pageSlotsQueue = Promise.resolve();

  function savePages(slots, extra = {}, unlock = false) {
    const previous = pageSlotList();
    const out = extra.out ? {folder: Number(extra.out), col: Number(extra.col), row: Number(extra.row),
      span_w: Number(extra.span_w || 1), span_h: Number(extra.span_h || 1)} : null;
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
      // A page has no PIN: its lock went with the save.
      if (unlock) {
        slots.filter(id => id > 0).forEach(folder => {
          const el = homeFolderTile(folder);
          if (!el) return;
          el.dataset.folderPinEnabled = '0';
          el.querySelector('.tile-icon-lock')?.remove();
          const tile = getTilesData('folder0')?.[Number(el.dataset.index)];
          if (tile) tile.folder_pin_enabled = false;
        });
        renderPageSlots();
      }
      // A folder back on the grid: the place the device gave it.
      if (extra.out !== undefined) {
        const el = homeFolderTile(Number(extra.out));
        const tile = el ? getTilesData('folder0')?.[Number(el.dataset.index)] : null;
        const place = tile ? data.places?.[ACTIVE_LAYOUT]?.['0']?.[String(tile.view_id)] : null;
        if (place) {
          Object.assign(tile, {col: place[0], row: place[1], span_w: place[2], span_h: place[3]});
          renderTileFromData('folder0', Number(el.dataset.index), tile, sensorMetaCache);
          layoutTiles('folder0', getTilesData('folder0'));
        } else {
          const tiles = await fetchTileGridData('folder0', true);
          tiles.forEach((data, index) => renderTileFromData('folder0', index, data, sensorMetaCache));
          layoutTiles('folder0', tiles);
          renderPageSlots();
        }
      }
      showNotification(t('pagesSaved'));
      return true;
    } catch (error) {
      return undo(t('networkErrorSave'));
    }
  }

  function draggedHomeFolder() {
    if (!dragSource || dragSource.kind !== 'grid-tile' || dragSource.tab !== 'folder0') return 0;
    const tile = document.getElementById('folder0-tile-' + dragSource.index);
    return tile?.dataset.type === '4' ? Number(tile.dataset.navigateTarget || 0) : 0;
  }

  // A page leaving the slots onto Home's grid (drag-resize.js handleGridDrop).
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
    // Its place stays free.
    savePages(pageSlotList().map(id => id === folder ? 0 : id), {out: folder, ...place});
  }

  // The editor picked a tile: the teal selection on its page's slot only,
  // nothing is built again.
  function markSelectedPageSlot() {
    pageSlotsElement()?.querySelectorAll('.page-slot').forEach(slot => {
      const source = slot.dataset.folder ? homeFolderTile(Number(slot.dataset.folder)) : null;
      const selected = !!source && currentTileTab === 'folder0' && currentTileIndex === Number(source.dataset.index);
      const tile = slot.querySelector(':scope > .tile');
      if (tile && tile.classList.contains('active') !== selected) tile.classList.toggle('active', selected);
    });
  }

  // A folder tile was drawn again (renderTileFromData): its slot follows
  // when it is a page's (an edited title, icon or color).
  function pageTileRendered(tab, index) {
    if (tab !== 'folder0' || !pageSlotsElement()) return;
    const el = document.getElementById('folder0-tile-' + index);
    if (el?.dataset.type === '4' && pageFolders().includes(Number(el.dataset.navigateTarget))) renderPageSlots();
  }

  // Beside a square or upright preview the boxes shrink alike to the editor
  // column (user 2026-10-12: on the S3 they slid under the settings panel;
  // on 600 and 480 px wide upright panels they would too).
  function fitPageStack() {
    const stack = document.querySelector('.compact-grid .settings-hidden-parking.page-stack');
    const main = stack?.closest('.tile-editor-main');
    if (!stack || !main) return;
    stack.style.zoom = '';
    stack.style.removeProperty('--stack-zoom');
    const room = main.getBoundingClientRect().right - stack.getBoundingClientRect().left;
    const need = stack.scrollWidth;
    if (room > 0 && need > room) {
      stack.style.zoom = String(room / need);
      stack.style.setProperty('--stack-zoom', String(room / need));
    }
  }

  function enablePageSlots() {
    const slots = pageSlotsElement();
    if (!slots || slots.dataset.bound === '1') return;
    slots.dataset.bound = '1';
    renderPageSlots();
    syncPageHeads();
    const main = slots.closest('.tile-editor-main');
    if (main && typeof ResizeObserver === 'function') new ResizeObserver(fitPageStack).observe(main);
    fitPageStack();
    slots.querySelectorAll('.page-slot').forEach((slot, i) => {
      // A page is edited like its folder tile: a tap picks it.
      slot.addEventListener('click', () => {
        const index = homeFolderTileIndex(Number(slot.dataset.folder || 0));
        if (index >= 0) selectTile(index, 'folder0');
      });
      // A folder from the grid onto a free place; a page onto any place
      // (onto another page they swap).
      const accepts = () => (draggedHomeFolder() > 0 && !pageSlotList()[i]) ||
        (dragSource?.kind === 'page-slot' && dragSource.tab === 'folder0');
      slot.addEventListener('dragover', event => {
        if (!accepts()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (slot.classList.contains('drop-target')) return;
        restoreDragPreview('folder0');
        clearDragPlaceholder();
        slots.querySelectorAll('.page-slot').forEach(other => other.classList.toggle('drop-target', other === slot));
      });
      slot.addEventListener('dragleave', event => {
        if (event.relatedTarget instanceof Node && slot.contains(event.relatedTarget)) return;
        slot.classList.remove('drop-target');
      });
      slot.addEventListener('drop', event => {
        if (!accepts()) return;
        event.preventDefault();
        event.stopPropagation();
        slot.classList.remove('drop-target');
        restoreDragPreview('folder0');
        clearDragPlaceholder();
        const places = pageSlotList();
        const folder = dragSource.kind === 'page-slot' ? dragSource.folder : draggedHomeFolder();
        const from = places.indexOf(folder);
        if (from === i) return;
        // Pages have no PIN: a locked folder asks before it becomes one.
        const unlock = from < 0 && homeFolderTile(folder)?.dataset.folderPinEnabled === '1';
        if (unlock && !window.confirm(t('pageUnlockConfirm'))) return;
        // Exactly where it is dropped; the page there takes its old place.
        if (from >= 0) places[from] = places[i];
        places[i] = folder;
        dragSource.dropCommitted = true;
        savePages(places, {}, unlock);
      });
      slot.addEventListener('dragstart', event => {
        const folder = Number(slot.dataset.folder || 0);
        const index = homeFolderTileIndex(folder);
        if (!folder || index < 0) {
          event.preventDefault();
          return;
        }
        const rect = slot.getBoundingClientRect();
        const grabOffset = getDragGrabOffset(rect, event.clientX, event.clientY);
        dragSource = {
          kind: 'page-slot',
          tab: 'folder0',
          index,
          folder,
          // A folder dragged in is a 1x1 tile and comes back as one (user
          // 2026-10-12: a half-high one changed its size in and out).
          layout: {col: 0, row: 0, span_w: 1, span_h: 1},
          grabCellCol: 0,
          grabCellRow: 0,
          dropOffset: grabOffset,
          dropCommitted: false,
          pageTarget: null
        };
        event.dataTransfer.effectAllowed = 'move';
        slot.classList.add('dragging');
        if (event.dataTransfer.setDragImage) {
          dragPreview = createDragPreview(slot);
          event.dataTransfer.setDragImage(dragPreview, grabOffset.x, grabOffset.y);
        }
      });
      slot.addEventListener('dragend', () => {
        slot.classList.remove('dragging');
        slots.querySelectorAll('.page-slot').forEach(other => other.classList.remove('drop-target'));
        clearDragPlaceholder();
        if (dragPreview && dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
        dragPreview = null;
        dragSource = null;
      });
    });
  }
