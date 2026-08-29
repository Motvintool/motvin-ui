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
  let getItemsCallback = null;
  let onUpdateCallback = null;
  let appType = null;

  function init(options) {
    // Inject HTML if it doesn't exist
    if (!document.getElementById('collection-modal')) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    getItemsCallback = options.getItems;
    onUpdateCallback = options.onUpdate;
    appType = options.appType;
    
    initEvents();
  }

  function openModal(itemId) {
    currentItemId = itemId;
    const item = getItemsCallback().find(i => i.id === itemId);
    if (!item) return;
    
    const titleEl = document.getElementById('coll-modal-icon-name');
    if (titleEl) titleEl.textContent = item.name;
    
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
          folder.iconIds.splice(idx, 1);
          if (typeof window.toast === 'function') window.toast(`Removed from "${folder.name}"`);
          if (folder.dirHandle) await removeIconFromLocal(folder.dirHandle, currentItemId);
        } else {
          folder.iconIds.push(currentItemId);
          if (typeof window.toast === 'function') window.toast(`Saved to "${folder.name}"`);
          if (folder.dirHandle) await writeIconToLocal(folder.dirHandle, currentItemId);
        }
        
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

          for (const folder of window.state.folders) {
            if (folder.dirHandle) {
              try {
                const same = await folder.dirHandle.isSameEntry(dirHandle);
                if (same) { 
                  if(typeof window.toast === 'function') window.toast(`"${folder.name}" is already connected`); 
                  return; 
                }
              } catch (e) {}
            } else if (folder.name === name) {
              if(typeof window.toast === 'function') window.toast(`A collection named "${name}" already exists`); 
              return;
            }
          }

          if (appType) {
            const otherStorageKey = appType === 'icons' ? 'ml.folders' : 'mi.folders';
            const otherPageName = appType === 'icons' ? 'Logos Library' : 'Icons Library';
            const otherFolders = JSON.parse(localStorage.getItem(otherStorageKey) || '[]');
            
            if (otherFolders.some(f => f.name === name)) {
              if (typeof window.toast === 'function') window.toast(`This is the ${otherPageName} collection.`);
              return;
            }
          }

          let hasWrongFiles = false;
          const iconIds = [];
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
              try {
                const fh = await dirHandle.getFileHandle(entry.name);
                const file = await fh.getFile();
                const itemData = JSON.parse(await file.text());
                if (itemData && itemData.id) {
                   if (appType === 'icons' && itemData.id.startsWith('logos_')) hasWrongFiles = true;
                   if (appType === 'logos' && !itemData.id.startsWith('logos_')) hasWrongFiles = true;
                   iconIds.push(itemData.id);
                }
              } catch (e) {}
            }
          }

          if (hasWrongFiles) {
             if (typeof window.toast === 'function') {
                const otherPageName = appType === 'icons' ? 'Logos Library' : 'Icons Library';
                window.toast(`This is the ${otherPageName} collection.`);
             }
             return;
          }

          if (currentItemId && !iconIds.includes(currentItemId)) {
             iconIds.push(currentItemId);
             await writeIconToLocal(dirHandle, currentItemId);
          }

          const newFolder = {
            id: 'f_' + Date.now().toString(36),
            name,
            iconIds,
            dirHandle
          };

          window.state.folders.push(newFolder);
          if (typeof window.toast === 'function') window.toast(`Connected "${name}" to local folder`);

          const folderModal = document.getElementById('local-folder-modal');
          if (folderModal) folderModal.classList.remove('is-open');
          
          // Keep collection modal closed, just update UI
          if (onUpdateCallback) onUpdateCallback();
        } catch (err) {
          if (err.name !== 'AbortError') {
            if (typeof window.toast === 'function') window.toast('Failed to select folder.');
          }
        }
      });
    }
  }

  async function writeIconToLocal(dirHandle, itemId) {
    if (!dirHandle) return;
    try {
      const item = getItemsCallback().find(ic => ic.id === itemId);
      if (!item) return;
      const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
      const fileHandle = await dirHandle.getFileHandle(`${safeName}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(item, null, 2));
      await writable.close();
    } catch (err) {
      console.error('Failed to write item to local folder', err);
    }
  }

  async function removeIconFromLocal(dirHandle, itemId) {
    if (!dirHandle) return;
    try {
      const item = getItemsCallback().find(ic => ic.id === itemId);
      if (!item) return;
      const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
      await dirHandle.removeEntry(`${safeName}.json`);
    } catch (err) {
      console.error('Failed to remove item from local folder', err);
    }
  }

  return { init, openModal };
})();
