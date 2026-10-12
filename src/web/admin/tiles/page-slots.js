  // The page slots above Home's preview (head bar layouts, user 2026-10-12,
  // tile_layouts::pages): six slots like the Settings parking slot. A Home
  // folder dropped on one becomes a page beside Home (its tile leaves Home),
  // a page dragged onto the grid becomes a folder tile again, and the slot
  // order is the order of the panel's dots.
  // Five pages beside Home (tile_layouts::kMaxPages).
  const PAGE_SLOT_COUNT = 5;

  function pageSlotsElement() {
    return document.getElementById('pageSlots');
  }

  // The pages in slot order; a folder deleted meanwhile has left.
  function pageFolders() {
    const slots = pageSlotsElement();
    if (!slots) return [];
    return String(slots.dataset.pages || '').split(',').map(Number).filter(id => id > 0 && homeFolderTile(id));
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
    const pages = pageFolders();
    slots.querySelectorAll('.page-slot').forEach((slot, i) => {
      const folder = pages[i] || 0;
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
        slot.innerHTML = '<i class="mdi mdi-tray-arrow-down"></i>';
        return;
      }
      // Picked in the editor: the teal selection like in the grid.
      tile.classList.toggle('active', selected);
      slot.replaceChildren(tile);
    });
  }

  // Home and the pages show the dots in their head and the gear; a page
  // left the slots shows its X again (home_bar.cpp).
  function syncPageHeads() {
    const pages = pageFolders();
    document.querySelectorAll('.tile-tab[data-folder-id]').forEach(tab => {
      const head = tab.querySelector('.head-bar-preview');
      if (!head) return;
      const folder = Number(tab.dataset.folderId);
      const page = !pages.length ? -1 : folder === 0 ? 0 : pages.indexOf(folder) + (pages.includes(folder) ? 1 : -1);
      head.querySelector('.head-dots')?.remove();
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
      if (folder === 0) return;
      const button = head.querySelector('.head-button');
      const icon = button?.querySelector('i');
      if (!button || !icon) return;
      const homeGear = document.querySelector('#tab-tiles-folder0 .head-bar-preview .head-gear');
      button.classList.toggle('head-gear', page > 0);
      button.classList.toggle('is-off', page > 0 && !!homeGear?.classList.contains('is-off'));
      icon.className = 'mdi ' + (page > 0 ? 'mdi-cog' : 'mdi-window-close');
    });
  }

  // Shows a change of the pages at once, like the Settings parking slot:
  // the slots, Home's folder tiles and the heads. `previous` are the pages
  // before; a folder leaving them comes back on the grid (`out`: at its
  // dropped spot).
  function showPagesLocally(pages, previous, out = null) {
    pageSlotsElement().dataset.pages = pages.join(',');
    const loaded = tileDataLoadedTabs.has('folder0');
    const tiles = getTilesData('folder0') || [];
    const folders = new Set([...pages, ...previous]);
    folders.forEach(folder => {
      const el = homeFolderTile(folder);
      if (!el) return;
      const page = pages.includes(folder);
      const tile = loaded ? tiles[Number(el.dataset.index)] : null;
      if (tile) {
        tile.layout_hidden = page;
        if (!page && out && out.folder === folder) {
          Object.assign(tile, {col: out.col, row: out.row, span_w: out.span_w, span_h: out.span_h});
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

  function savePages(pages, extra = {}, unlock = false) {
    const previous = pageFolders();
    const out = extra.out ? {folder: Number(extra.out), col: Number(extra.col), row: Number(extra.row),
      span_w: Number(extra.span_w || 1), span_h: Number(extra.span_h || 1)} : null;
    showPagesLocally(pages, previous, out);
    pageSlotsQueue = pageSlotsQueue.then(() => sendPages(pages, previous, extra, unlock));
    return pageSlotsQueue;
  }

  async function sendPages(pages, previous, extra, unlock) {
    const undo = message => {
      showPagesLocally(previous, pages);
      showNotification(message, false);
      return false;
    };
    try {
      const body = new URLSearchParams({pages: pages.join(',')});
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
        pages.forEach(folder => {
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
    // The device keeps the tile's size when it fits there (/api/pages).
    const tile = getTilesData('folder0')?.[dragSource.index];
    const size = tile && tile.span_w >= 1 && tile.span_h >= 1 &&
      canPlacePageTile({col: candidate.col, row: candidate.row, span_w: tile.span_w, span_h: tile.span_h})
      ? {span_w: tile.span_w, span_h: tile.span_h} : {span_w: 1, span_h: 1};
    savePages(pageFolders().filter(id => id !== folder), {out: folder, col: candidate.col, row: candidate.row, ...size});
  }

  // The slots follow their folder tiles: an edited title, icon or color, the
  // editor's selection. The head's dots (syncPageHeads) are no reason.
  function watchPageFolderTiles() {
    const grid = getTileGrid('folder0');
    if (!grid || typeof MutationObserver !== 'function') return;
    let frame = 0;
    new MutationObserver(records => {
      if (frame || records.every(record => record.target.closest?.('.head-bar-preview') ||
          record.target.parentElement?.closest('.head-bar-preview'))) return;
      // A timer, not a frame: a hidden tab gets no frames.
      frame = setTimeout(() => {
        frame = 0;
        renderPageSlots();
      }, 30);
    }).observe(grid, {subtree: true, childList: true, attributes: true, characterData: true});
  }

  function enablePageSlots() {
    const slots = pageSlotsElement();
    if (!slots || slots.dataset.bound === '1') return;
    slots.dataset.bound = '1';
    renderPageSlots();
    syncPageHeads();
    watchPageFolderTiles();
    slots.querySelectorAll('.page-slot').forEach((slot, i) => {
      // A page is edited like its folder tile: a tap picks it.
      slot.addEventListener('click', () => {
        const index = homeFolderTileIndex(Number(slot.dataset.folder || 0));
        if (index >= 0) selectTile(index, 'folder0');
      });
      const accepts = () => draggedHomeFolder() > 0 ||
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
        const pages = pageFolders();
        const folder = dragSource.kind === 'page-slot' ? dragSource.folder : draggedHomeFolder();
        const from = pages.indexOf(folder);
        if (from < 0 && pages.length >= PAGE_SLOT_COUNT) {
          showNotification(t('pagesFull'), false);
          return;
        }
        // Pages have no PIN: a locked folder asks before it becomes one.
        const unlock = from < 0 && homeFolderTile(folder)?.dataset.folderPinEnabled === '1';
        if (unlock && !window.confirm(t('pageUnlockConfirm'))) return;
        if (from >= 0) pages.splice(from, 1);
        pages.splice(Math.min(i, pages.length), 0, folder);
        dragSource.dropCommitted = true;
        savePages(pages, {}, unlock);
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
          // One cell, like the slot; the device keeps a larger tile's size
          // when it fits (/api/pages).
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
