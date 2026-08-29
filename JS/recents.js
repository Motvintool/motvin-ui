// recents.js: Scripts only for recents.html.
(function registerRecentsPageModule() {
  const PAGE_NAME = 'files.html';

  const PALETTE_COLLECTION_KEY = 'motvin.palette-collection.v1';
  const PALETTE_DELETED_KEY = 'motvin.palette-deleted.v1';
  const TYPEFACE_COLLECTION_KEY = 'motvin.typeface.collection.v1';
  const TYPEFACE_DELETED_KEY = 'motvin.typeface-deleted.v1';

  function safeLoad(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return null;
    }
  }

  function safeSave(key, entries) {
    try {
      const list = Array.isArray(entries) ? entries : [];
      localStorage.setItem(key, JSON.stringify(list));
      localStorage.setItem(`${key}_last_modified`, Date.now().toString());
    } catch {}
  }

  function timeAgo(ts) {
    const value = Number(ts);
    if (!Number.isFinite(value) || value <= 0) return 'Just now';
    const diff = Date.now() - value;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function normalizePaletteColors(entry) {
    const list = Array.isArray(entry?.swatches)
      ? entry.swatches
      : (Array.isArray(entry?.state) ? entry.state : (Array.isArray(entry?.colors) ? entry.colors : []));
    if (!list.length) return ['#6369d1', '#a9efef', '#dcb487', '#b88e8d', '#34435e'];
    return list.slice(0, 5).map(item => {
      if (typeof item === 'string') return item.startsWith('#') ? item : `#${item}`;
      const hex = String(item?.hex || 'e5e7eb').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6) || 'e5e7eb';
      return `#${hex}`;
    });
  }

  function normalizeTypefaceTexts(entry) {
    if (Array.isArray(entry?.texts) && entry.texts.length) {
      return entry.texts;
    }
    if (entry?.snapshot && Array.isArray(entry.snapshot.steps) && entry.snapshot.steps.length) {
      return entry.snapshot.steps.map(s => ({
        text: s.text || s.sampleText || 'Brown jars prevented the freez quickly',
        size: s.size || s.fontSize || 12,
        lh: s.lh || s.lineHeight || null
      }));
    }
    return [
      { text: 'Brown jars prevented the freez quickly', size: 16.507, lh: 20.038 },
      { text: 'Brown jars prevented the freez quickly', size: 13.753, lh: null },
      { text: 'Brown jars prevented the freez quickly', size: 11.463, lh: null },
      { text: 'Brown jars prevented the freezing too quickly', size: 9.553, lh: null },
      { text: 'Brown jars prevented the freezing too quickly', size: 7.96, lh: null },
      { text: 'Brown jars prevented the freezing too quickly', size: 6.633, lh: null },
      { text: 'Brown jars prevented the freezing too quickly', size: 5.528, lh: null },
      { text: 'Brown jars prevented the freezing too quickly', size: 4.606, lh: null },
      { text: 'Brown jars prevented the freezing too quickly', size: 3.838, lh: null }
    ];
  }

  function buildUniqueDuplicateName(collection, currentName, fallbackName) {
    const sourceName = String(currentName || '').trim() || fallbackName;
    const names = new Set((collection || []).map(e => String(e?.name || '').trim().toLowerCase()));
    const baseName = sourceName.replace(/\s+copy(?:\s+\d+)?$/i, '').trim() || fallbackName;
    const candidate = `${baseName} copy`;
    if (!names.has(candidate.toLowerCase())) return candidate;
    let idx = 2;
    while (names.has(`${baseName} copy ${idx}`.toLowerCase())) idx++;
    return `${baseName} copy ${idx}`;
  }

  let _firebaseSvcPromise = null;
  function getFirebaseService() {
    if (typeof window.__motvinGetFirebaseService === 'function' && window.__motvinGetFirebaseService !== getFirebaseService) {
      return window.__motvinGetFirebaseService();
    }
    if (typeof window.createFirebaseUrlBetaCreditService === 'function') {
      if (!_firebaseSvcPromise) {
        _firebaseSvcPromise = window.createFirebaseUrlBetaCreditService({ dailyLimit: 50 });
      }
      return _firebaseSvcPromise;
    }
    return Promise.resolve(null);
  }

  if (typeof window.__motvinGetFirebaseService !== 'function') {
    window.__motvinGetFirebaseService = getFirebaseService;
  }

  async function syncCloud(cloudType, entries) {
    try {
      const svc = await getFirebaseService();
      if (svc && svc.enabled && typeof svc.saveUserCollection === 'function') {
        if (typeof svc.ensureSignedIn === 'function') {
          await svc.ensureSignedIn({ interactive: false });
        }
        await svc.saveUserCollection(cloudType, entries);
      }
    } catch (err) {
      console.warn('[recents] Firebase cloud sync failed:', err);
    }
  }

  function clearLocalRecentsCache() {
    const keys = [
      PALETTE_COLLECTION_KEY,
      TYPEFACE_COLLECTION_KEY,
      PALETTE_DELETED_KEY,
      TYPEFACE_DELETED_KEY
    ];
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
        localStorage.removeItem(`${k}_last_modified`);
      } catch {}
    });
  }

  async function pullFromCloud(onUpdated) {
    console.log('[recents] pullFromCloud starting...');
    try {
      if (window.FirebaseAuthService && typeof window.FirebaseAuthService.ensureReady === 'function') {
        console.log('[recents] Awaiting FirebaseAuthService.ensureReady()...');
        await window.FirebaseAuthService.ensureReady();
      }

      const svc = await getFirebaseService();
      console.log('[recents] getFirebaseService resolved:', svc ? { enabled: svc.enabled, mode: svc.mode } : null);
      if (!svc || !svc.enabled || typeof svc.loadUserCollection !== 'function') {
        console.warn('[recents] Firebase service disabled or missing loadUserCollection:', svc);
        return false;
      }

      let user = typeof svc.getCurrentUser === 'function' ? svc.getCurrentUser() : null;
      if ((!user || !user.uid) && window.FirebaseAuthService && typeof window.FirebaseAuthService.getCurrentUser === 'function') {
        user = window.FirebaseAuthService.getCurrentUser();
      }
      console.log('[recents] User for pull:', user ? { uid: user.uid, isAnon: user.isAnonymous, email: user.email } : null);
      if (!user || !user.uid || user.isAnonymous) {
        console.warn('[recents] Skipping pull: User not logged in or is anonymous.');
        clearLocalRecentsCache();
        if (typeof onUpdated === 'function') onUpdated();
        return false;
      }

      if (typeof svc.ensureSignedIn === 'function' && window.firebase && window.firebase.auth && !window.firebase.auth().currentUser) {
        try {
          console.log('[recents] Compat auth currentUser is null, attempting ensureSignedIn...');
          await svc.ensureSignedIn({ interactive: false });
          console.log('[recents] ensureSignedIn finished. Compat user:', window.firebase.auth().currentUser ? window.firebase.auth().currentUser.uid : null);
        } catch (ensureErr) {
          console.error('[recents] ensureSignedIn error:', ensureErr);
        }
      }

      const collectionsMap = [
        { localKey: PALETTE_COLLECTION_KEY, cloudType: 'palettes' },
        { localKey: TYPEFACE_COLLECTION_KEY, cloudType: 'typefaces' },
        { localKey: PALETTE_DELETED_KEY, cloudType: 'deletedPalettes' },
        { localKey: TYPEFACE_DELETED_KEY, cloudType: 'deletedTypefaces' }
      ];

      let updated = false;
      for (const item of collectionsMap) {
        console.log(`[recents] Requesting Firestore collection '${item.cloudType}'...`);
        try {
          const localModifiedRaw = localStorage.getItem(`${item.localKey}_last_modified`);
          const localModified = localModifiedRaw ? parseInt(localModifiedRaw, 10) : 0;
          if (Date.now() - localModified < 15000) {
            console.log(`[recents] Skipping pull for '${item.cloudType}' due to recent local modification.`);
            continue;
          }

          const remote = await svc.loadUserCollection(item.cloudType);
          console.log(`[recents] Collection '${item.cloudType}' fetched count:`, Array.isArray(remote) ? remote.length : remote);
          if (Array.isArray(remote) && remote.length > 0) {
            localStorage.setItem(item.localKey, JSON.stringify(remote));
            updated = true;
          } else {
            // If cloud has 0 items, check if local cache has items created prior to sign-in and auto-upload them
            const localEntries = safeLoad(item.localKey) || [];
            if (localEntries.length > 0 && typeof svc.saveUserCollection === 'function') {
              console.log(`[recents] Syncing ${localEntries.length} local items of '${item.cloudType}' to Firestore cloud...`);
              await svc.saveUserCollection(item.cloudType, localEntries);
              updated = true;
            }
          }
        } catch (colErr) {
          console.error(`[recents] Failed to fetch collection '${item.cloudType}':`, colErr);
        }
      }
      if (typeof onUpdated === 'function') {
        console.log('[recents] Triggering onUpdated / renderGrid...');
        onUpdated();
      }
      return updated;
    } catch (err) {
      console.error('[recents] pullFromCloud fatal error:', err);
    }
    return false;
  }

  const INITIAL_GRID_SKELETON_MS = 260;

  function buildProductCardSkeletonMarkup(count) {
    const total = Number(count) > 0 ? Number(count) : 4;
    return Array.from({ length: total }).map(() => `
      <article class="main-shell-product-card-skeleton" aria-hidden="true">
        <span class="main-shell-product-card-skeleton-media"></span>
        <span class="main-shell-product-card-skeleton-body">
          <span class="main-shell-product-card-skeleton-line main-shell-product-card-skeleton-line--title"></span>
          <span class="main-shell-product-card-skeleton-line main-shell-product-card-skeleton-line--meta"></span>
        </span>
      </article>`).join('');
  }

  function showInitialGridSkeleton(gridContainer) {
    if (gridContainer) {
      gridContainer.innerHTML = buildProductCardSkeletonMarkup(4);
    }
  }

  function initRecentsPage() {
    const grid = document.getElementById('recents-grid');
    if (!grid) return;

    let currentTab = 'all'; // 'all' or 'archived'
    let activeContextItem = null;

    const contextMenu = document.getElementById('recents-context-menu');
    const contextMenuOptions = document.getElementById('recents-context-menu-options');

    function renderPalette(item) {
      let colorsHtml = '';
      item.colors.forEach((c) => {
        colorsHtml += `<div class="palette-color" style="background-color: ${c}"></div>`;
      });
      return `
        <div class="recent-card-preview">
          <div class="recent-card-palette">
            ${colorsHtml}
          </div>
        </div>
      `;
    }

    function renderTypescale(item) {
      let textsHtml = '';
      item.texts.forEach((t) => {
        textsHtml += `<div class="recent-typescale-card-text" style="font-size: ${t.size}px; line-height: ${t.lh ? t.lh + 'px' : 'normal'}">${t.text}</div>`;
      });
      return `
        <div class="recent-card-preview">
          <div class="recent-card-typescale">
            ${textsHtml}
          </div>
        </div>
      `;
    }

    function renderGrid() {
      const isArchivedTab = currentTab === 'archived';
      if (grid) {
        grid.classList.toggle('is-archived-view', isArchivedTab);
      }

      const paletteKey = isArchivedTab ? PALETTE_DELETED_KEY : PALETTE_COLLECTION_KEY;
      const typefaceKey = isArchivedTab ? TYPEFACE_DELETED_KEY : TYPEFACE_COLLECTION_KEY;

      const rawPalettes = safeLoad(paletteKey) || [];
      const rawTypefaces = safeLoad(typefaceKey) || [];

      const list = [];

      rawPalettes.forEach((p, idx) => {
        list.push({
          type: 'palette',
          section: 'palette',
          rawIndex: idx,
          title: p.name || 'Untitled Palette',
          subtitle: `Saved ${timeAgo(p.updatedAt || p.savedAt || Date.now())}`,
          colors: normalizePaletteColors(p),
          actionBg: '#2589ff',
          savedAt: Number(p.updatedAt || p.savedAt) || Date.now(),
          rawEntry: p
        });
      });

      rawTypefaces.forEach((t, idx) => {
        list.push({
          type: 'typescale',
          section: 'typeface',
          rawIndex: idx,
          title: t.name || 'Untitled Typeface',
          subtitle: `Saved ${timeAgo(t.updatedAt || t.savedAt || Date.now())}`,
          texts: normalizeTypefaceTexts(t),
          actionBg: '#915eff',
          savedAt: Number(t.updatedAt || t.savedAt) || Date.now(),
          rawEntry: t
        });
      });

      // Sort by savedAt descending
      list.sort((a, b) => b.savedAt - a.savedAt);

      if (!list.length) {
        grid.innerHTML = isArchivedTab
          ? `
            <div class="recents-empty-state">
              <div class="recents-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
              </div>
              <p class="recents-empty-title">No archived items yet</p>
              <p class="recents-empty-subtitle">Archived color palettes and typefaces will appear here.</p>
            </div>
          `
          : `
            <div class="recents-empty-state">
              <div class="recents-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              </div>
              <p class="recents-empty-title">No recent items yet</p>
              <p class="recents-empty-subtitle">Save a color palette or typeface preset to see it here.</p>
            </div>
          `;
        return;
      }

      let html = '';
      list.forEach((item) => {
        const isPalette = item.type === 'palette';
        const cardClass = isPalette ? 'recent-color-card' : 'recent-typescale-card';
        const actionClass = isPalette ? 'recent-color-card-action' : 'recent-typescale-card-action';
        const iconSrc = isPalette ? 'ASSET/Icons/recent-color-card-icon.svg' : 'ASSET/Icons/recent-typescale-card-icon.svg';

        html += `
          <div class="${cardClass}" 
               data-section="${item.section}" 
               data-raw-index="${item.rawIndex}" 
               data-title="${encodeURIComponent(item.title)}"
               data-type="${item.type}">
            ${isPalette ? renderPalette(item) : renderTypescale(item)}
            <div class="recent-card-footer">
              <div class="recent-card-meta">
                <span class="recent-card-title">${item.title}</span>
                <span class="recent-card-subtitle">${item.subtitle}</span>
              </div>
              <button class="${actionClass}" style="background-color: ${item.actionBg}" type="button">
                <img src="${iconSrc}" alt="" />
              </button>
            </div>
          </div>
        `;
      });

      grid.innerHTML = html;
    }

    // Show initial skeleton loader for smooth page load / refresh
    showInitialGridSkeleton(grid);

    const minSkeletonPromise = new Promise((resolve) => window.setTimeout(resolve, INITIAL_GRID_SKELETON_MS));
    const cloudSyncPromise = pullFromCloud();

    Promise.all([minSkeletonPromise, cloudSyncPromise]).finally(() => {
      renderGrid();

      // Hide main shell skeleton overlay if present
      const main = document.querySelector('.layout .main');
      if (main && window.MainShellRouter && typeof window.MainShellRouter.hideMainSkeleton === 'function') {
        window.MainShellRouter.hideMainSkeleton(main);
      } else if (main) {
        const overlay = main.querySelector(':scope > .main-shell-skeleton');
        if (overlay) overlay.remove();
        main.classList.remove('main-shell-loading');
        main.removeAttribute('aria-busy');
      }
    });

    // Tab Logic for All files vs Archived
    const allFilesTab = document.querySelector('.all-files-tab');
    const archivedTab = document.querySelector('.archived-tab');

    if (allFilesTab && archivedTab) {
      allFilesTab.addEventListener('click', () => {
        if (currentTab === 'all') return;
        currentTab = 'all';
        allFilesTab.classList.add('is-active');
        archivedTab.classList.remove('is-active');
        closeContextMenu();
        renderGrid();
      });

      archivedTab.addEventListener('click', () => {
        if (currentTab === 'archived') return;
        currentTab = 'archived';
        archivedTab.classList.add('is-active');
        allFilesTab.classList.remove('is-active');
        closeContextMenu();
        renderGrid();
      });
    }

    // Generator Banner buttons quick actions
    const typefaceBtn = document.querySelector('.Typescale-btn');
    const colorBtn = document.querySelector('.color-btn');

    function openWorkspaceInMain(url) {
      if (!url) return;
      const targetUrl = typeof url === 'string' ? url : String(url);
      const main = document.querySelector('.layout .main');
      const topPane = document.querySelector('.top-pane');
      const isTopPaneVisible = topPane && !topPane.classList.contains('top-pane--hidden');

      if (main && isTopPaneVisible) {
        // Remove active state from Home tab
        const homeTab = document.querySelector('.top-pane-home-tab');
        if (homeTab) {
          homeTab.classList.remove('is-active');
        }

        // Render directly below toppane inside .main
        const iframe = document.createElement('iframe');
        iframe.src = targetUrl;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.style.background = 'transparent';
        iframe.style.flex = '1';

        iframe.onload = () => {
          try {
            const style = iframe.contentDocument.createElement('style');
            style.textContent = `
              .sidebar.sidebar-left,
              .sidebar-panel.sidebar-two-col {
                width: 100% !important;
                max-width: none !important;
                flex: 1 !important;
              }
            `;
            iframe.contentDocument.head.appendChild(style);
          } catch(e) {}
        };

        main.innerHTML = '';
        main.appendChild(iframe);
        
        const shellSidebar = document.querySelector('.layout > .sidebar');
        if (shellSidebar) {
          shellSidebar.style.display = 'none';
          main.style.marginLeft = '0';
          
          // Push state so browser back button and Home tab work
          if (window.location.search.indexOf('workspace=') === -1) {
            window.history.pushState({ shell: true }, '', '?workspace=' + encodeURIComponent(targetUrl));
          }
          
          window.addEventListener('main-shell:navigated', () => {
            shellSidebar.style.display = '';
            main.style.marginLeft = '';
          }, { once: true });
        }
      } else {
        window.location.href = targetUrl;
      }
    }

    window.openWorkspaceInMain = openWorkspaceInMain;

    // Auto-restore workspace if present in query params
    const initialWorkspace = new URLSearchParams(window.location.search).get('workspace');
    if (initialWorkspace) {
      openWorkspaceInMain(initialWorkspace);
    }

    if (typefaceBtn) {
      typefaceBtn.addEventListener('click', () => {
        const now = Date.now();
        const newTypeface = {
          name: 'Untitled Typeface',
          savedAt: now,
          updatedAt: now,
          texts: normalizeTypefaceTexts(null)
        };
        try {
          const typefaces = safeLoad(TYPEFACE_COLLECTION_KEY) || [];
          typefaces.unshift(newTypeface);
          safeSave(TYPEFACE_COLLECTION_KEY, typefaces);
          void syncCloud('typefaces', typefaces);
          renderGrid();
        } catch (e) {}

        try { sessionStorage.removeItem('motvin.typeface.pending-open.v1'); } catch {}
        try { localStorage.removeItem('motvin.typeface.pending-open.v1'); } catch {}
        try { sessionStorage.removeItem('motvin.typeface.force-new.v1'); } catch {}
        try { localStorage.removeItem('motvin.typeface.force-new.v1'); } catch {}
        try { sessionStorage.setItem('motvin.typeface.editing-id.v1', String(now)); } catch {}
        try { localStorage.setItem('motvin.typeface.editing-id.v1', String(now)); } catch {}
        openWorkspaceInMain('MOTVIN/typeface.html');
      });
    }

    if (colorBtn) {
      colorBtn.addEventListener('click', () => {
        const now = Date.now();
        const newPalette = {
          name: 'Untitled Palette',
          savedAt: now,
          updatedAt: now,
          colors: ['#6369d1', '#a9efef', '#dcb487', '#b88e8d', '#34435e']
        };
        try {
          const palettes = safeLoad(PALETTE_COLLECTION_KEY) || [];
          palettes.unshift(newPalette);
          safeSave(PALETTE_COLLECTION_KEY, palettes);
          void syncCloud('palettes', palettes);
          renderGrid();
        } catch (e) {}

        try { localStorage.removeItem('motvin.styles.palette-state.v1'); } catch {}
        try { localStorage.setItem('motvin.palette.editing-id.v1', String(now)); } catch {}
        openWorkspaceInMain('MOTVIN/styles.html');
      });
    }

    // Context Menu Logic
    function closeContextMenu() {
      if (!contextMenu) return;
      contextMenu.setAttribute('hidden', '');
      document.querySelectorAll('.recent-color-card, .recent-typescale-card').forEach(card => {
        card.classList.remove('is-context-active');
      });
      activeContextItem = null;
    }

    function openContextMenu(cardEl, event) {
      if (!contextMenu || !contextMenuOptions) return;

      closeContextMenu();

      cardEl.classList.add('is-context-active');

      const section = cardEl.dataset.section;
      const rawIndex = parseInt(cardEl.dataset.rawIndex, 10);
      const title = decodeURIComponent(cardEl.dataset.title || '');
      const type = cardEl.dataset.type;

      activeContextItem = { cardEl, section, rawIndex, title, type };

      // Generate context menu options styled with recents-context-menu-option
      if (currentTab === 'all') {
        contextMenuOptions.innerHTML = `
          <button class="recents-context-menu-option" type="button" data-action="rename">
            <span class="recents-context-menu-option-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span>Rename</span>
            </span>
          </button>
          <button class="recents-context-menu-option" type="button" data-action="duplicate">
            <span class="recents-context-menu-option-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Duplicate</span>
            </span>
          </button>
          <button class="recents-context-menu-option" type="button" data-action="archive">
            <span class="recents-context-menu-option-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
              <span>Archive</span>
            </span>
          </button>
        `;
      } else {
        contextMenuOptions.innerHTML = `
          <button class="recents-context-menu-option" type="button" data-action="restore">
            <span class="recents-context-menu-option-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              <span>Restore</span>
            </span>
          </button>
          <button class="recents-context-menu-option is-danger" type="button" data-action="delete">
            <span class="recents-context-menu-option-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Permanent Delete</span>
            </span>
          </button>
        `;
      }

      // Display recents-context-menu-panel right where user clicked on the card
      contextMenu.removeAttribute('hidden');

      const menuWidth = contextMenu.offsetWidth || 170;
      const menuHeight = contextMenu.offsetHeight || 130;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let clickX = event ? event.clientX : 100;
      let clickY = event ? event.clientY : 100;

      if (clickX + menuWidth > viewportWidth - 12) {
        clickX = Math.max(12, viewportWidth - menuWidth - 12);
      }

      if (clickY + menuHeight > viewportHeight - 12) {
        clickY = Math.max(12, viewportHeight - menuHeight - 12);
      }

      contextMenu.style.top = `${Math.round(clickY)}px`;
      contextMenu.style.left = `${Math.round(clickX)}px`;
    }

    // Right-click contextmenu event listener on grid cards
    grid.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.recent-color-card, .recent-typescale-card');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(card, e);
    });

    // Left-click to navigate to MOTVIN pages OR click 3-dots action button for menu
    grid.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.recent-color-card-action, .recent-typescale-card-action');
      if (actionBtn) {
        e.preventDefault();
        e.stopPropagation();
        const card = actionBtn.closest('.recent-color-card, .recent-typescale-card');
        if (card) {
          openContextMenu(card, e);
        }
        return;
      }
      
      const card = e.target.closest('.recent-color-card, .recent-typescale-card');
      if (!card) return;

      if (currentTab === 'archived') {
        return;
      }

      const type = card.dataset.type;
      const rawIndex = parseInt(card.dataset.rawIndex, 10);
      
      if (type === 'palette') {
        const savedList = JSON.parse(localStorage.getItem('motvin.palette-collection.v1') || '[]');
        const entry = savedList[rawIndex];
        if (entry) {
          try { localStorage.setItem('motvin.styles.palette-state.v1', JSON.stringify(entry.swatches || entry.state || [])); } catch {}
          try { localStorage.setItem('motvin.palette.editing-id.v1', String(entry.savedAt || "")); } catch {}
        }
        openWorkspaceInMain('MOTVIN/styles.html');
      } else if (type === 'typescale') {
        const savedList = JSON.parse(localStorage.getItem('motvin.typeface.collection.v1') || '[]');
        const entry = savedList[rawIndex];
        if (entry) {
          try { sessionStorage.setItem('motvin.typeface.pending-open.v1', JSON.stringify(entry.snapshot || {})); } catch {}
          try { localStorage.setItem('motvin.typeface.pending-open.v1', JSON.stringify(entry.snapshot || {})); } catch {}
          try { sessionStorage.removeItem('motvin.typeface.force-new.v1'); } catch {}
          try { localStorage.removeItem('motvin.typeface.force-new.v1'); } catch {}
          try { sessionStorage.setItem('motvin.typeface.editing-id.v1', String(entry.savedAt || "")); } catch {}
          try { localStorage.setItem('motvin.typeface.editing-id.v1', String(entry.savedAt || "")); } catch {}
        }
        openWorkspaceInMain('MOTVIN/typeface.html');
      }
    });

  function showOfflineToast(message = "Internet connection required for this action. Please check your network.") {
    let toastContainer = document.getElementById('recents-toast-modal-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'recents-toast-modal-container';
      toastContainer.className = 'recents-toast-modal-container';
      document.body.appendChild(toastContainer);
    }

    toastContainer.innerHTML = `
      <div class="recents-modal-panel recents-toast-panel">
        <div class="recents-modal-header">
          <div class="recents-toast-header-title">
            <div class="recents-toast-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
            </div>
            <h3 class="recents-modal-title">You are offline</h3>
          </div>
          <button class="recents-modal-close" id="recents-toast-close" type="button" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>
        <div class="recents-modal-body" style="padding: 14px 20px 18px 20px;">
          <p class="recents-toast-message">${message}</p>
        </div>
      </div>
    `;

    const closeBtn = toastContainer.querySelector('#recents-toast-close');
    const dismiss = () => {
      toastContainer.classList.remove('is-visible');
    };

    if (closeBtn) {
      closeBtn.onclick = dismiss;
    }

    requestAnimationFrame(() => {
      toastContainer.classList.add('is-visible');
    });

    clearTimeout(toastContainer._timer);
    toastContainer._timer = setTimeout(() => {
      dismiss();
    }, 4000);
  }

    function openRenameModal(itemInfo) {
      if (!itemInfo) return;
      const isPalette = itemInfo.section === 'palette';
      const heading = `Rename ${isPalette ? 'Color Palette' : 'Typeface Preset'}`;

      const handleSave = (newName) => {
        if (!newName || !newName.trim()) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          showOfflineToast("Internet connection required to rename presets.");
          return;
        }
        const { section, rawIndex } = itemInfo;
        const activeKey = isPalette ? PALETTE_COLLECTION_KEY : TYPEFACE_COLLECTION_KEY;
        const deletedKey = isPalette ? PALETTE_DELETED_KEY : TYPEFACE_DELETED_KEY;
        const activeCloudType = isPalette ? 'palettes' : 'typefaces';
        const deletedCloudType = isPalette ? 'deletedPalettes' : 'deletedTypefaces';

        const listKey = currentTab === 'all' ? activeKey : deletedKey;
        const cloudType = currentTab === 'all' ? activeCloudType : deletedCloudType;
        const entries = safeLoad(listKey) || [];

        if (entries[rawIndex]) {
          entries[rawIndex].name = newName.trim();
          entries[rawIndex].updatedAt = Date.now();
          safeSave(listKey, entries);
          void syncCloud(cloudType, entries);
          window.dispatchEvent(new CustomEvent('motvin:history-storage-change', { detail: { key: listKey } }));
          renderGrid();
        }
      };

      if (window.ModalComponent && typeof window.ModalComponent.open === 'function') {
        window.ModalComponent.open({
          heading,
          value: itemInfo.title,
          onSave: handleSave,
        });
      } else {
        const newName = prompt(heading, itemInfo.title);
        if (newName !== null) {
          handleSave(newName);
        }
      }
    }

    // Handle Context Menu Actions
    if (contextMenuOptions) {
      contextMenuOptions.addEventListener('click', (e) => {
        const optBtn = e.target.closest('[data-action]');
        if (!optBtn || !activeContextItem) return;

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          closeContextMenu();
          showOfflineToast("Internet connection required to modify presets. Please check your network.");
          return;
        }

        const action = optBtn.dataset.action;
        const { section, rawIndex, title } = activeContextItem;
        const isPalette = section === 'palette';

        const activeKey = isPalette ? PALETTE_COLLECTION_KEY : TYPEFACE_COLLECTION_KEY;
        const deletedKey = isPalette ? PALETTE_DELETED_KEY : TYPEFACE_DELETED_KEY;

        const activeCloudType = isPalette ? 'palettes' : 'typefaces';
        const deletedCloudType = isPalette ? 'deletedPalettes' : 'deletedTypefaces';

        if (action === 'rename') {
          openRenameModal(activeContextItem);
          closeContextMenu();
        } else if (action === 'duplicate' && currentTab === 'all') {
          const entries = safeLoad(activeKey) || [];
          const source = entries[rawIndex];
          if (source) {
            const clone = JSON.parse(JSON.stringify(source));
            clone.savedAt = Date.now();
            clone.name = buildUniqueDuplicateName(entries, clone.name, isPalette ? 'Untitled Palette' : 'Untitled Typeface');
            entries.splice(rawIndex + 1, 0, clone);
            safeSave(activeKey, entries);
            void syncCloud(activeCloudType, entries);
            window.dispatchEvent(new CustomEvent('motvin:history-storage-change', { detail: { key: activeKey } }));
          }
        } else if (action === 'archive' && currentTab === 'all') {
          const activeEntries = safeLoad(activeKey) || [];
          const deletedEntries = safeLoad(deletedKey) || [];
          if (activeEntries[rawIndex]) {
            const [moved] = activeEntries.splice(rawIndex, 1);
            deletedEntries.unshift(moved);
            safeSave(activeKey, activeEntries);
            safeSave(deletedKey, deletedEntries);
            void syncCloud(activeCloudType, activeEntries);
            void syncCloud(deletedCloudType, deletedEntries);
            window.dispatchEvent(new CustomEvent('motvin:history-storage-change', { detail: { key: activeKey } }));
          }
        } else if (action === 'restore' && currentTab === 'archived') {
          const activeEntries = safeLoad(activeKey) || [];
          const deletedEntries = safeLoad(deletedKey) || [];
          if (deletedEntries[rawIndex]) {
            const [moved] = deletedEntries.splice(rawIndex, 1);
            moved.updatedAt = Date.now();
            activeEntries.unshift(moved);
            safeSave(activeKey, activeEntries);
            safeSave(deletedKey, deletedEntries);
            void syncCloud(activeCloudType, activeEntries);
            void syncCloud(deletedCloudType, deletedEntries);
            window.dispatchEvent(new CustomEvent('motvin:history-storage-change', { detail: { key: activeKey } }));
          }
        } else if (action === 'delete' && currentTab === 'archived') {
          const deletedEntries = safeLoad(deletedKey) || [];
          if (deletedEntries[rawIndex]) {
            deletedEntries.splice(rawIndex, 1);
            safeSave(deletedKey, deletedEntries);
            void syncCloud(deletedCloudType, deletedEntries);
            window.dispatchEvent(new CustomEvent('motvin:history-storage-change', { detail: { key: deletedKey } }));
          }
        }

        closeContextMenu();
        renderGrid();
      });
    }

    // Dismiss context menu when clicking outside or pressing Escape
    document.addEventListener('click', (e) => {
      if (contextMenu && !contextMenu.contains(e.target)) {
        closeContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    });

    // Auto-update when storage changes in another tab/window or Firebase auth/sync fires
    window.addEventListener('motvin:history-storage-change', () => renderGrid());
    window.addEventListener('storage', () => renderGrid());
    window.addEventListener('url-beta-auth-changed', () => void pullFromCloud(renderGrid));
    window.addEventListener('motvin:auth-changed', () => void pullFromCloud(renderGrid));
    window.addEventListener('auth-state-changed', () => void pullFromCloud(renderGrid));

    if (window.FirebaseAuthService && typeof window.FirebaseAuthService.onChange === 'function') {
      window.FirebaseAuthService.onChange((user) => {
        const isSignedIn = user && user.uid && !user.isAnonymous;
        if (isSignedIn) {
          void pullFromCloud(renderGrid);
        } else {
          clearLocalRecentsCache();
          renderGrid();
        }
      });
    }

    // Fire layout ready event after skeleton display window
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('app:layoutReady'));
    }, INITIAL_GRID_SKELETON_MS);

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.init({
        containerId: 'shell-top-pane-product-tabs',
        forceHomeActive: true,
        enableDefaultProductActive: false,
      });
    }

    // Hide main skeleton
    const main = document.querySelector('.layout .main');
    if (main && window.MainShellRouter && typeof window.MainShellRouter.hideMainSkeleton === 'function') {
      window.MainShellRouter.hideMainSkeleton(main);
    } else if (main) {
       const overlay = main.querySelector(':scope > .main-shell-skeleton');
       if (overlay) overlay.remove();
       main.classList.remove('main-shell-loading');
       main.removeAttribute('aria-busy');
    }
  }

  window.PageModules = window.PageModules || {};
  window.PageModules[PAGE_NAME] = initRecentsPage;
  window.PageModules['files.html'] = initRecentsPage;
  window.PageModules['recents.html'] = initRecentsPage;

  function shouldRunInit() {
    const p = window.location.pathname.toLowerCase();
    return p.endsWith('files.html') || p.endsWith('/files') || p.endsWith('/') || p.indexOf('recents') !== -1;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (shouldRunInit()) {
        initRecentsPage();
      }
    }, { once: true });
  } else {
    if (shouldRunInit()) {
      initRecentsPage();
    }
  }
})();
