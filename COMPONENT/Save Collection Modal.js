window.CollectionManager = (function() {
  const modalHTML = `
  <!-- =====================================================
       COLLECTION MODAL
       ===================================================== -->
  <div class="mi-modal" id="collection-modal" aria-hidden="true" role="dialog" aria-modal="true">
    <div class="mi-modal-backdrop" data-close></div>
    <div class="mi-modal-card" style="max-width: 380px; width: 100%; border-radius: 16px; overflow: hidden;">
      <!-- Header -->
      <div style="padding: 20px 20px 16px; border-bottom: 1px solid var(--mi-border); display: flex; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; border-radius: 9px; background: var(--mi-ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 15px; font-weight: 600; color: var(--mi-ink); line-height: 1.2;">Save to Collection</div>
          <div style="font-size: 12px; color: var(--mi-muted); margin-top: 2px;">Item: <strong id="coll-modal-icon-name" style="color: var(--mi-ink-2);">—</strong></div>
        </div>
        <button class="mi-modal-close" data-close aria-label="Close" style="position: static; margin: 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <!-- Collections list -->
      <div id="coll-modal-list" class="mi-collections-list-modal" style="max-height: 240px; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px;">
        <!-- Dynamically populated -->
      </div>

      <!-- Footer: new collection -->
      <div style="padding: 12px 16px; border-top: 1px solid var(--mi-border); background: var(--mi-bg-3);">
        <button class="mi-btn-primary" id="coll-new-btn" style="width: 100%; justify-content: center; font-size: 13px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
          New Collection from Folder
        </button>
      </div>
    </div>
  </div>

  <!-- =====================================================
       LOCAL FOLDER MODAL
       ===================================================== -->
  <div class="mi-modal" id="local-folder-modal" aria-hidden="true" role="dialog" aria-modal="true">
    <div class="mi-modal-backdrop" data-close></div>
    <div class="mi-modal-card" style="max-width: 380px; width: 100%; border-radius: 16px; overflow: hidden;">
      <!-- Header -->
      <div style="padding: 20px 20px 16px; border-bottom: 1px solid var(--mi-border); display: flex; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; border-radius: 9px; background: var(--mi-ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 15px; font-weight: 600; color: var(--mi-ink); line-height: 1.2;">Connect Local Folder</div>
          <div style="font-size: 12px; color: var(--mi-muted); margin-top: 2px;">Folder name becomes the collection name</div>
        </div>
        <button class="mi-modal-close" data-close aria-label="Close" style="position: static; margin: 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <!-- Info body -->
      <div style="padding: 16px 20px;">
        <div style="display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: var(--mi-bg-3); border-radius: 10px; border: 1px solid var(--mi-border);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--mi-ink-2)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style="margin: 0; font-size: 13px; color: var(--mi-ink-2); line-height: 1.5;">Items are saved as <code style="background: var(--mi-border); padding: 1px 5px; border-radius: 4px;">.json</code> files. Existing files in the folder are automatically imported.</p>
        </div>
      </div>
      <!-- Footer actions -->
      <div style="padding: 12px 16px; border-top: 1px solid var(--mi-border); background: var(--mi-bg-3); display: flex; gap: 8px; justify-content: flex-end;">
        <button class="mi-btn-secondary" data-close>Cancel</button>
        <button id="btnSelectFolder" class="mi-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
          Choose Folder
        </button>
      </div>
    </div>
  </div>`;

  let currentItemId = null;
  let currentItem = null;   // ← Cache the FULL item object at openModal time
  let getItemsCallback = null;
  let onUpdateCallback = null;
  let saveLSCallback = null;
  let appType = null;
  // Track icon IDs whose file writes are still in-flight, keyed by folderId
  const _pendingWrites = new Map(); // folderId → Set of iconIds
  const FOLDER_HANDLE_DB = 'motvin-folder-handles';
  const FOLDER_HANDLE_STORE = 'handles';

  // Known logo collection IDs for backward compatibility
  const LOGO_COLLECTIONS = ['vectorlogozone', 'svgl', 'gilbarbara', 'simpleicons', 'devicon', 'logos'];

  function init(options) {
    // Inject HTML if it doesn't exist
    if (!document.getElementById('collection-modal')) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    getItemsCallback = options.getItems;
    onUpdateCallback = options.onUpdate;
    saveLSCallback = options.saveLS || null;
    appType = options.appType;

    initEvents();
    restoreDirectoryHandles();
  }

  function openFolderHandleDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }
      const request = window.indexedDB.open(FOLDER_HANDLE_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(FOLDER_HANDLE_STORE)) {
          request.result.createObjectStore(FOLDER_HANDLE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function folderHandleKey(folderId) {
    return `${appType}:${folderId}`;
  }

  async function persistDirectoryHandle(folder) {
    if (!folder?.dirHandle) return;
    try {
      const db = await openFolderHandleDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(FOLDER_HANDLE_STORE, 'readwrite');
        transaction.objectStore(FOLDER_HANDLE_STORE).put(folder.dirHandle, folderHandleKey(folder.id));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
    } catch (error) {
      console.warn('[CollectionManager] Could not persist local folder access:', error);
    }
  }

  async function forgetDirectoryHandle(folderId) {
    try {
      const db = await openFolderHandleDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(FOLDER_HANDLE_STORE, 'readwrite');
        transaction.objectStore(FOLDER_HANDLE_STORE).delete(folderHandleKey(folderId));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
    } catch (error) {
      console.warn('[CollectionManager] Could not remove local folder access:', error);
    }
  }

  async function restoreDirectoryHandles() {
    if (!window.state?.folders?.length) return;
    try {
      const db = await openFolderHandleDb();
      const transaction = db.transaction(FOLDER_HANDLE_STORE, 'readonly');
      const store = transaction.objectStore(FOLDER_HANDLE_STORE);
      await Promise.all(window.state.folders.map(folder => new Promise(resolve => {
        const request = store.get(folderHandleKey(folder.id));
        request.onsuccess = () => {
          if (request.result) folder.dirHandle = request.result;
          resolve();
        };
        request.onerror = resolve;
      })));
      db.close();
      syncFolders();
    } catch (error) {
      console.warn('[CollectionManager] Could not restore local folder access:', error);
    }
  }

  /**
   * Robust item lookup: first try getItemsCallback(), fallback to window.state
   * This handles cases where ICONS may have been repopulated by API after the modal was opened.
   */
  function findItem(itemId) {
    if (!itemId) return null;
    // Primary: search in the live ICONS array
    const items = getItemsCallback ? getItemsCallback() : [];
    let item = items.find(i => i.id === itemId);
    if (item) return item;
    // Fallback: search across all folder caches (items saved previously still have their data)
    if (window.state && window.state.folders) {
      for (const folder of window.state.folders) {
        if (folder._itemCache && folder._itemCache[itemId]) {
          return folder._itemCache[itemId];
        }
      }
    }
    return null;
  }

  /**
   * Cache a full item object inside the folder so it can be written even if ICONS changes.
   */
  function cacheItemInFolder(folder, item) {
    if (!folder || !item) return;
    if (!folder._itemCache) folder._itemCache = {};
    folder._itemCache[item.id] = item;
  }

  function openModal(itemId, itemObj) {
    currentItemId = itemId;
    // Accept full item directly to avoid re-searching ICONS (which may be stale).
    currentItem = itemObj || findItem(itemId);
    if (!currentItem) {
      console.warn('[CollectionManager] openModal: item not found for id', itemId);
      return;
    }

    const titleEl = document.getElementById('coll-modal-icon-name');
    if (titleEl) titleEl.textContent = currentItem.name;

    renderList();

    const modal = document.getElementById('collection-modal');
    if (modal) modal.classList.add('is-open');
  }

  function renderList() {
    const list = document.getElementById('coll-modal-list');
    if (!list) return;

    if (!window.state || !window.state.folders || window.state.folders.length === 0) {
      list.innerHTML = `<div class="mi-empty" style="padding: 20px 0;"><p>No collections yet.</p></div>`;
      return;
    }

    list.innerHTML = window.state.folders.map(f => {
      const isSaved = f.iconIds.includes(currentItemId);
      return `
        <div class="mi-coll-modal-item ${isSaved ? 'is-saved' : ''}" data-folder-id="${f.id}">
          <span class="mi-coll-modal-name">${f.name}</span>
          <span class="mi-coll-modal-count">${f.iconIds.length} items</span>
        </div>
      `;
    }).join('');
  }

  function initEvents() {
    const list = document.getElementById('coll-modal-list');
    if (list) {
      list.addEventListener('click', async e => {
        const itemNode = e.target.closest('.mi-coll-modal-item');
        if (!itemNode || !currentItemId) return;

        const folderId = itemNode.dataset.folderId;
        const folder = window.state.folders.find(f => f.id === folderId);
        if (!folder) return;

        const idx = folder.iconIds.indexOf(currentItemId);
        if (idx > -1) {
          // ── REMOVE ──
          folder.iconIds.splice(idx, 1);
          // Also remove from local item cache
          if (folder._itemCache) delete folder._itemCache[currentItemId];
          if (typeof window.toast === 'function') window.toast(`Removed from "${folder.name}"`);
          if (folder.dirHandle) {
            await removeIconFromLocal(folder.dirHandle, currentItemId);
          }
        } else {
          // ── SAVE ──
          // Use the item cached at openModal time — guaranteed to be non-null and complete.
          const item = currentItem || findItem(currentItemId);
          if (!item) {
            if (typeof window.toast === 'function') window.toast('Could not find item data to save.');
            return;
          }
          // Cache item data in folder so it can be re-written in future syncs
          cacheItemInFolder(folder, item);
          // Always persist to memory + localStorage immediately
          folder.iconIds.push(currentItemId);
          _saveLS();
          if (typeof window.toast === 'function') window.toast(`Saved to "${folder.name}"`);
          // Write to the local folder (best-effort) — track as pending so syncFolders won't undo it
          if (folder.dirHandle) {
            if (!_pendingWrites.has(folderId)) _pendingWrites.set(folderId, new Set());
            _pendingWrites.get(folderId).add(currentItemId);
            writeIconToLocal(folder.dirHandle, item).then(written => {
              if (!written) {
                console.warn('[CollectionManager] File write failed for', currentItemId, '— saved to memory only.');
              }
              // Clear pending regardless of success/failure — memory state is source of truth
              const pending = _pendingWrites.get(folderId);
              if (pending) pending.delete(currentItemId);
            });
          }
        }

        // Persist to localStorage and update UI
        _saveLS();
        if (onUpdateCallback) onUpdateCallback();
        renderList();
      });
    }


    const newBtn = document.getElementById('coll-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        const collModal = document.getElementById('collection-modal');
        if (collModal) collModal.classList.remove('is-open');
        const folderModal = document.getElementById('local-folder-modal');
        if (folderModal) folderModal.classList.add('is-open');
      });
    }

    const selectFolderBtn = document.getElementById('btnSelectFolder');
    if (selectFolderBtn) {
      selectFolderBtn.addEventListener('click', async () => {
        try {
          const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          const name = dirHandle.name;
          let disconnectedFolder = null;

          // Check for duplicate folder already connected
          for (const folder of window.state.folders) {
            if (folder.dirHandle) {
              try {
                const same = await folder.dirHandle.isSameEntry(dirHandle);
                if (same) {
                  if (typeof window.toast === 'function') window.toast(`"${folder.name}" is already connected`);
                  return;
                }
              } catch (e) {}
            } else if (folder.name === name) {
              disconnectedFolder = folder;
            }
          }

          // Guard: prevent mixing with the other library's folder
          if (appType) {
            const libraries = [
              { type: 'icons', storageKey: 'mi.folders', name: 'Icons Library' },
              { type: 'logos', storageKey: 'ml.folders', name: 'Logos Library' },
              { type: 'illustrations', storageKey: 'mill.folders', name: 'Illustrations Library' }
            ];
            for (const library of libraries) {
              if (library.type === appType) continue;
              const folders = JSON.parse(localStorage.getItem(library.storageKey) || '[]');
              if (folders.some(folder => folder.name === name)) {
                if (typeof window.toast === 'function') window.toast(`This is the ${library.name} collection.`);
                return;
              }
            }
          }

          // Scan folder for existing JSON files
          let hasWrongFiles = false;
          const iconIds = [];
          const itemCache = {};
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
              try {
                const fh = await dirHandle.getFileHandle(entry.name);
                const file = await fh.getFile();
                const text = await file.text();
                if (!text) continue;
                const itemData = JSON.parse(text);
                if (itemData && itemData.id) {
                  const fileAppType = itemData._appType || (LOGO_COLLECTIONS.includes(itemData.collection?.toLowerCase()) ? 'logos' : 'icons');
                  if (fileAppType !== appType) { hasWrongFiles = true; break; }
                  iconIds.push(itemData.id);
                  // Cache item data for future use
                  itemCache[itemData.id] = itemData;
                }
              } catch (e) {}
            }
          }

          if (hasWrongFiles) {
            if (typeof window.toast === 'function') window.toast('This folder belongs to a different library.');
            return;
          }

          // If we have a pending item (from clicking "Save" then "New Folder"), write it too
          if (currentItemId && !iconIds.includes(currentItemId)) {
            const item = currentItem || findItem(currentItemId);
            if (item) {
              iconIds.push(currentItemId);
              itemCache[currentItemId] = item;
              await writeIconToLocal(dirHandle, item);
            }
          }

          const folder = disconnectedFolder || {
            id: 'f_' + Date.now().toString(36),
            name,
            iconIds,
            dirHandle,
            _itemCache: itemCache
          };
          if (disconnectedFolder) {
            folder.iconIds = iconIds;
            folder.dirHandle = dirHandle;
            folder._itemCache = itemCache;
          } else {
            window.state.folders.push(folder);
          }
          await persistDirectoryHandle(folder);
          if (typeof window.toast === 'function') window.toast(`${disconnectedFolder ? 'Reconnected' : 'Connected'} "${name}" to local folder`);

          const folderModal = document.getElementById('local-folder-modal');
          if (folderModal) folderModal.classList.remove('is-open');

          _saveLS();
          if (onUpdateCallback) onUpdateCallback();
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('[CollectionManager] Failed to select folder:', err);
            if (typeof window.toast === 'function') window.toast('Failed to select folder.');
          }
        }
      });
    }
  }

  /**
   * Write an item to the connected local folder.
   * Returns true on success, false on failure.
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {Object} item - Full item object to serialize
   */
  async function writeIconToLocal(dirHandle, item) {
    if (!dirHandle || !item || !item.id) return false;
    try {
      // Build a sanitized, serializable copy — only plain known fields
      const itemToSave = {
        id: item.id,
        name: item.name || item.id,
        collection: item.collection || item.source || '',
        collectionName: item.collectionName || item.sourceName || '',
        category: item.category || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        style: item.style || '',
        license: item.license || '',
        viewBox: item.viewBox || '0 0 24 24',
        svg: typeof item.svg === 'string' ? item.svg : '',
        _appType: appType
      };

      const json = JSON.stringify(itemToSave, null, 2);
      const fileHandle = await dirHandle.getFileHandle(getLocalFileName(item), { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch (err) {
      console.error('[CollectionManager] writeIconToLocal failed:', err.name, err.message, 'item:', item?.id);
      return false;
    }
  }

  function getLocalFileName(item) {
    const uniqueId = `${item.sourceIconId || item.source || item.collection || 'item'}-${item.id}`;
    const safeName = uniqueId.replace(/[^a-z0-9\-]/gi, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
    return `${safeName || `item_${Date.now()}`}.json`;
  }

  async function removeIconFromLocal(dirHandle, itemId) {
    if (!dirHandle) return;
    try {
      // Scan by stored ID so both source-aware and legacy name-only files work.
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          try {
            const fh = await dirHandle.getFileHandle(entry.name);
            const file = await fh.getFile();
            const data = JSON.parse(await file.text());
            if (data && data.id === itemId) {
              await dirHandle.removeEntry(entry.name);
              return;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      // File might not exist, that's ok
      if (err.name !== 'NotFoundError') {
        console.error('[CollectionManager] Failed to remove item from local folder:', err);
      }
    }
  }

  /**
   * Persist folder state (iconIds only, no dirHandle) to localStorage.
   * Falls back to calling the page-level saveLS if provided.
   */
  function _saveLS() {
    if (saveLSCallback) {
      saveLSCallback();
      return;
    }
    // Fallback: persist directly using known keys
    if (window.state && window.state.folders) {
      const storageKey = appType === 'logos' ? 'ml.folders' : 'mi.folders';
      const toSave = window.state.folders.map(f => ({
        id: f.id,
        name: f.name,
        iconIds: f.iconIds
        // _itemCache and dirHandle intentionally excluded (not serializable)
      }));
      try {
        localStorage.setItem(storageKey, JSON.stringify(toSave));
      } catch (e) {
        console.error('[CollectionManager] Failed to save folders to localStorage:', e);
      }
    }
  }

  /**
   * Re-scan all connected local folders and sync iconIds to match disk state.
   * Called on window focus to pick up external deletions/additions.
   */
  async function syncFolders() {
    if (!window.state || !window.state.folders) return;

    let hasChanges = false;

    for (const folder of window.state.folders) {
      if (!folder.dirHandle) continue;

      // Check permission without prompting
      let permOk = false;
      try {
        const perm = await folder.dirHandle.queryPermission({ mode: 'readwrite' });
        permOk = perm === 'granted';
      } catch (e) {
        continue;
      }
      if (!permOk) continue;

      const currentIds = new Set(folder.iconIds);
      const newIds = new Set();
      const newCache = { ...(folder._itemCache || {}) };

      try {
        for await (const entry of folder.dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.json')) {
            try {
              const fh = await folder.dirHandle.getFileHandle(entry.name);
              const file = await fh.getFile();
              const text = await file.text();
              if (!text) continue;
              const itemData = JSON.parse(text);
              if (itemData && itemData.id) {
                const fileAppType = itemData._appType || (LOGO_COLLECTIONS.includes(itemData.collection?.toLowerCase()) ? 'logos' : 'icons');
                if (fileAppType === appType) {
                  newIds.add(itemData.id);
                  newCache[itemData.id] = itemData;
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        // Folder may have been deleted/unmounted, skip
        continue;
      }

      // Detect any change
      let changed = currentIds.size !== newIds.size;
      if (!changed) {
        for (const id of newIds) {
          if (!currentIds.has(id)) { changed = true; break; }
        }
      }
      if (!changed) {
        for (const id of currentIds) {
          if (!newIds.has(id)) { changed = true; break; }
        }
      }

      if (changed) {
        // ── CRITICAL: don't overwrite IDs that are pending file write (fire-and-forget in-flight)
        // Without this guard, syncFolders would see the folder without the new file
        // and strip the newly saved ID from iconIds before the write completes.
        const pending = _pendingWrites.get(folder.id);
        if (pending && pending.size > 0) {
          for (const pid of pending) newIds.add(pid);
        }
        folder.iconIds = Array.from(newIds);
        folder._itemCache = newCache;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      // Persist updated state to localStorage
      _saveLS();
      if (onUpdateCallback) onUpdateCallback();
      const collModal = document.getElementById('collection-modal');
      if (collModal && collModal.classList.contains('is-open')) {
        renderList();
      }
    }
  }

  // Sync when user tabs back into the browser
  window.addEventListener('focus', () => {
    syncFolders();
  });

  // Also sync on page visibility restore (e.g. switching browser tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncFolders();
    }
  });

  return { init, openModal, syncFolders, forgetDirectoryHandle };
})();
