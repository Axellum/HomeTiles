  // The page slots above Home's preview (head bar layouts, user 2026-10-12,
  // tile_layouts::pages): six slots like the Settings parking slot. A Home
  // folder dropped on one becomes a page beside Home (its tile leaves Home),
  // a page dragged onto the grid becomes a folder tile again, and the slot
  // order is the order of the panel's dots.
  const PAGE_SLOT_COUNT = 6;
  let pageSlotsSaving = false;

  function pageSlotsElement() {
    return document.getElementById('pageSlots');
  }

  function pageFolders() {
    const slots = pageSlotsElement();
    if (!slots) return [];
    return String(slots.dataset.pages || '').split(',').map(Number).filter(id => id > 0);
  }

  function homeFolderTileIndex(folderId) {
    return (getTilesData('folder0') || []).findIndex(
      tile => Number(tile?.type || 0) === 4 && Number(tile.navigate_target) === folderId);
  }

  // A filled slot shows the page's folder tile as the grid draws it (its
  // tile stays in Home's grid, hidden: tile-unplaced).
  function renderPageSlots() {
    const slots = pageSlotsElement();
    if (!slots) return;
    const pages = pageFolders();
    slots.querySelectorAll('.page-slot').forEach((slot, i) => {
      const folder = pages[i] || 0;
      slot.dataset.folder = folder ? String(folder) : '';
      slot.draggable = !!folder;
      slot.classList.toggle('has-tile', !!folder);
      const source = folder ? document.getElementById('folder0-tile-' + homeFolderTileIndex(folder)) : null;
      slot.className = 'page-slot ' + (folder && source ? 'has-tile' : 'empty');
      if (!folder || !source) {
        slot.innerHTML = '<i class="mdi mdi-tray-arrow-down"></i>';
        return;
      }
      // The folder tile's look without its place in the grid; no id or
      // index, so the editor never takes it for a grid tile.
      const tile = document.createElement('div');
      tile.className = source.className;
      tile.classList.remove('tile-unplaced', 'fractional-tile', 'active', 'dragging', 'drop-target',
        'sensor-compact', 'sensor-half', 'compact-title-only');
      for (const property of Array.from(source.style)) {
        if (/^(grid|display|--tile-(col|row|w|h)$)/.test(property)) continue;
        tile.style.setProperty(property, source.style.getPropertyValue(property));
      }
      tile.innerHTML = source.innerHTML;
      slot.replaceChildren(tile);
    });
    syncPageHeads();
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

  async function savePages(pages, extra = {}, unlock = false) {
    if (pageSlotsSaving) return false;
    pageSlotsSaving = true;
    try {
      const body = new URLSearchParams({pages: pages.join(',')});
      if (unlock) body.set('unlock', '1');
      Object.entries(extra).forEach(([key, value]) => body.set(key, String(value)));
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString()
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (response.status === 409 && data.error === 'locked') {
        pageSlotsSaving = false;
        // Pages have no PIN: the lock goes once the user agrees.
        if (!window.confirm(t('pageUnlockConfirm'))) return false;
        return savePages(pages, extra, true);
      }
      if (!response.ok || !data.success) {
        showNotification(data.error === 'No free cell' ? t('tileDoesNotFit') : t('networkErrorSave'), false);
        return false;
      }
      pageSlotsElement().dataset.pages = pages.join(',');
      // Home's grid: a page's folder tile leaves it, a folder taken out of
      // the slots comes back at its new place.
      const tiles = await fetchTileGridData('folder0', true);
      tiles.forEach((tile, index) => renderTileFromData('folder0', index, tile, sensorMetaCache));
      layoutTiles('folder0', tiles);
      renderPageSlots();
      showNotification(t('pagesSaved'));
      return true;
    } catch (error) {
      showNotification(t('networkErrorSave'), false);
      return false;
    } finally {
      pageSlotsSaving = false;
    }
  }

  function draggedHomeFolder() {
    if (!dragSource || dragSource.kind !== 'grid-tile' || dragSource.tab !== 'folder0') return 0;
    const tile = getTilesData('folder0')?.[dragSource.index];
    return Number(dragSource.type || tile?.type || 0) === 4 ? Number(tile?.navigate_target || 0) : 0;
  }

  // A page leaving the slots onto Home's grid (drag-resize.js handleGridDrop).
  function canPlacePageTile(candidate) {
    if (!dragSource || dragSource.kind !== 'page-slot') return false;
    return supportedTileLayout(4, candidate) && canPlaceTileLayout('folder0', dragSource.index, candidate);
  }

  function dropPageOnGrid(candidate) {
    const folder = dragSource.folder;
    dragSource.dropCommitted = true;
    savePages(pageFolders().filter(id => id !== folder), {out: folder, col: candidate.col, row: candidate.row});
  }

  function enablePageSlots() {
    const slots = pageSlotsElement();
    if (!slots || slots.dataset.bound === '1') return;
    slots.dataset.bound = '1';
    renderPageSlots();
    slots.querySelectorAll('.page-slot').forEach((slot, i) => {
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
        if (from >= 0) pages.splice(from, 1);
        pages.splice(Math.min(i, pages.length), 0, folder);
        dragSource.dropCommitted = true;
        savePages(pages);
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
