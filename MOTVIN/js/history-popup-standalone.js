(() => {
  const PALETTE_COLLECTION_KEY = "motvin.palette-collection.v1";
  const PALETTE_DELETED_KEY = "motvin.palette-deleted.v1";
  const PALETTE_STATE_KEY = "motvin.styles.palette-state.v1";
  const PALETTE_EDITING_ID_KEY = "motvin.palette.editing-id.v1";
  const TYPEFACE_COLLECTION_KEY = "motvin.typeface.collection.v1";
  const TYPEFACE_DELETED_KEY = "motvin.typeface-deleted.v1";
  const TYPEFACE_PENDING_SNAPSHOT_KEY = "motvin.typeface.pending-open.v1";
  const TYPEFACE_EDITING_ID_KEY = "motvin.typeface.editing-id.v1";
  const TYPEFACE_FORCE_NEW_KEY = "motvin.typeface.force-new.v1";
  const MAX_SAVED_HISTORY_ENTRIES = 10;
  const HISTORY_STORAGE_EVENT = "motvin:history-storage-change";
  const POPUP_STATE_KEY = "motvin.history-popup-state.v1";
  const HISTORY_STORAGE_KEYS = new Set([
    PALETTE_COLLECTION_KEY,
    PALETTE_DELETED_KEY,
    TYPEFACE_COLLECTION_KEY,
    TYPEFACE_DELETED_KEY,
  ]);

  function emitHistoryStorageChange(key, oldValue, newValue) {
    if (!HISTORY_STORAGE_KEYS.has(key)) return;
    window.dispatchEvent(new CustomEvent(HISTORY_STORAGE_EVENT, {
      detail: { key, oldValue, newValue },
    }));
  }

  function ensureSameWindowStorageEvents() {
    if (window.__motvinHistoryStorageEventsPatched) return;
    window.__motvinHistoryStorageEventsPatched = true;
    const storageProto = window.Storage && window.Storage.prototype;
    if (!storageProto) return;

    const originalSetItem = storageProto.setItem;
    const originalRemoveItem = storageProto.removeItem;

    storageProto.setItem = function patchedSetItem(key, value) {
      const oldValue = this.getItem(key);
      const result = originalSetItem.apply(this, arguments);
      emitHistoryStorageChange(String(key), oldValue, String(value));
      return result;
    };

    storageProto.removeItem = function patchedRemoveItem(key) {
      const oldValue = this.getItem(key);
      const result = originalRemoveItem.apply(this, arguments);
      emitHistoryStorageChange(String(key), oldValue, null);
      return result;
    };
  }

  function safeLoad(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function safeSave(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
      localStorage.setItem(`${key}_last_modified`, Date.now().toString());
    } catch { }
  }

  function timeAgo(ts) {
    const value = Number(ts);
    if (!Number.isFinite(value) || value <= 0) return "Just now";
    const diff = Date.now() - value;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function getHistorySectionLabel(section) {
    return section === "typeface" ? "Typeface" : "Colour Palettes";
  }

  function normalizePaletteEntry(entry) {
    return Array.isArray(entry?.swatches) ? entry.swatches : (Array.isArray(entry?.state) ? entry.state : []);
  }

  function paletteName(swatches) {
    const list = normalizePaletteEntry({ swatches }).slice(0, 2).map((item) => String(item?.name || "").trim()).filter(Boolean);
    return list.length ? list.join(" + ") : "Untitled Palette";
  }

  function palettePreviewStripes(swatches) {
    const items = normalizePaletteEntry({ swatches }).slice(0, 5);
    if (!items.length) {
      return '<span class="history-card-item-swatch" style="background:#e5e7eb"></span>';
    }
    return items.map((swatch) => {
      const hex = String(swatch?.hex || "e5e7eb").replace(/[^0-9A-Fa-f]/g, "").slice(0, 6) || "e5e7eb";
      return `<span class="history-card-item-swatch" style="background:#${hex}"></span>`;
    }).join("");
  }

  function buildUniqueDuplicateName(collection, currentName, fallbackName) {
    const sourceName = String(currentName || "").trim() || fallbackName;
    const normalizedNames = new Set((Array.isArray(collection) ? collection : []).map((entry) => String(entry?.name || "").trim().toLowerCase()).filter(Boolean));
    const baseName = sourceName.replace(/\s+copy(?:\s+\d+)?$/i, "").trim() || fallbackName;
    const firstCandidate = `${baseName} copy`;
    if (!normalizedNames.has(firstCandidate.toLowerCase())) return firstCandidate;
    let copyIndex = 2;
    while (normalizedNames.has(`${baseName} copy ${copyIndex}`.toLowerCase())) copyIndex += 1;
    return `${baseName} copy ${copyIndex}`;
  }

  function canAddSavedHistoryEntry(collection) {
    return (Array.isArray(collection) ? collection.length : 0) < MAX_SAVED_HISTORY_ENTRIES;
  }

  function getHistoryLimitMessage(section) {
    return section === "typeface" ? "Typeface reached Limits." : "Colour Palettes reached Limits.";
  }

  function getHistoryLimitToast(section) {
    return {
      title: "Limit reached",
      message: getHistoryLimitMessage(section),
      tone: "warning",
    };
  }

  function notify(title, message, tone = "success") {
    if (typeof window.showToast === "function") {
      return window.showToast(title, message, tone) === true;
    }
    return false;
  }

  function showToastElement(title, message, tone = "success") {
    const toastNotification = document.getElementById("toastNotification");
    if (!toastNotification || typeof toastNotification.show !== "function") return false;
    document.body.appendChild(toastNotification);
    toastNotification.style.zIndex = "2147483647";
    toastNotification.show(title, message, tone);
    return true;
  }

  function showHistoryLimitToast(section, notifyFn = null) {
    const toast = getHistoryLimitToast(section);
    if (!notifyFn && typeof window.showToast === "function") {
      if (window.showToast(toast.title, toast.message, toast.tone) === true) {
        return toast;
      }
    }
    if (showToastElement(toast.title, toast.message, toast.tone)) {
      return toast;
    }
    if (typeof window.showHistoryLimitToast === "function" && window.showHistoryLimitToast !== showHistoryLimitToast) {
      if (window.showHistoryLimitToast(section) === true) {
        return toast;
      }
    }
    const handler = typeof notifyFn === "function" ? notifyFn : notify;
    if (typeof handler === "function") {
      if (handler(toast.title, toast.message, toast.tone) === true) {
        return toast;
      }
    }
    showToastElement(toast.title, toast.message, toast.tone);
    return toast;
  }

  function forceHistoryLimitToast(section, notifyFn = null) {
    const toast = getHistoryLimitToast(section);
    let shown = false;

    if (typeof window.showToast === "function") {
      shown = window.showToast(toast.title, toast.message, toast.tone) === true || shown;
    }

    shown = showToastElement(toast.title, toast.message, toast.tone) || shown;

    if (typeof window.showHistoryLimitToast === "function" && window.showHistoryLimitToast !== showHistoryLimitToast) {
      shown = window.showHistoryLimitToast(section) === true || shown;
    }

    if (!shown && typeof notifyFn === "function") {
      shown = notifyFn(toast.title, toast.message, toast.tone) === true || shown;
    }

    return shown;
  }

  function queueHistoryLimitToast(section, notifyFn = null, options = {}) {
    const delay = Number.isFinite(options?.delay) ? options.delay : 0;
    const preferDirect = options?.preferDirect === true;
    window.setTimeout(() => {
      if (preferDirect && forceHistoryLimitToast(section, notifyFn)) {
        return;
      }
      showHistoryLimitToast(section, notifyFn);
    }, delay);
  }

  function loadEntries(section, mode) {
    if (section === "typeface") {
      return mode === "deleted" ? safeLoad(TYPEFACE_DELETED_KEY) : safeLoad(TYPEFACE_COLLECTION_KEY);
    }
    return mode === "deleted" ? safeLoad(PALETTE_DELETED_KEY) : safeLoad(PALETTE_COLLECTION_KEY);
  }

  /* Map section+mode to Firestore collection type */
  const FIRESTORE_TYPE_MAP = {
    "palette:history": "palettes",
    "palette:deleted": "deletedPalettes",
    "typeface:history": "typefaces",
    "typeface:deleted": "deletedTypefaces",
  };
  let __hpSvcCache = null;
  function syncToFirestore(section, mode, entries) {
    const firestoreType = FIRESTORE_TYPE_MAP[`${section}:${mode}`];
    if (!firestoreType) return;
    (async () => {
      try {
        if (!__hpSvcCache) {
          if (typeof window.__motvinGetFirebaseService === "function") {
            __hpSvcCache = await window.__motvinGetFirebaseService();
          } else {
            const mod = await import("/src/firebase-url-beta.js");
            __hpSvcCache = await mod.createFirebaseUrlBetaCreditService({ dailyLimit: 50 });
          }
        }
        const svc = __hpSvcCache;
        if (!svc?.enabled || typeof svc.saveUserCollection !== "function") return;
        let user = svc.getCurrentUser?.();
        if (!user?.uid && typeof svc.ensureSignedIn === "function") {
          await svc.ensureSignedIn({ interactive: false });
          user = svc.getCurrentUser?.();
        }
        if (!user?.uid) return;
        await svc.saveUserCollection(firestoreType, entries || []);
      } catch { }
    })();
  }

  function saveEntries(section, mode, entries) {
    if (section === "typeface") {
      safeSave(mode === "deleted" ? TYPEFACE_DELETED_KEY : TYPEFACE_COLLECTION_KEY, entries);
    } else {
      safeSave(mode === "deleted" ? PALETTE_DELETED_KEY : PALETTE_COLLECTION_KEY, entries);
    }
    syncToFirestore(section, mode, entries);
  }

  function renderEmptyState(section, mode) {
    const isTypeface = section === "typeface";
    const title = isTypeface
      ? (mode === "deleted" ? "No deleted typeface presets yet." : "No saved typeface presets yet.")
      : (mode === "deleted" ? "No deleted palettes yet." : "No saved palettes yet.");
    const subtitle = isTypeface
      ? (mode === "deleted" ? "Archived typeface presets will appear here" : "Save a typeface preset to see it here")
      : (mode === "deleted" ? "Archived palettes will appear here" : "Save a colour palette to see it here");
    const emptyIcon = isTypeface
      ? `
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.6667 8H22.6667" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M16.6667 8V24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M13.3333 24H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        `
      : `
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g opacity="0.5">
              <path d="M31.5 18C31.5 10.5442 25.4558 4.5 18 4.5C10.5442 4.5 4.5 10.5442 4.5 18C4.5 25.4558 10.5442 31.5 18 31.5C19.1363 31.5 20.7 31.657 20.7 30.15C20.7 29.3279 20.2723 28.6936 19.8476 28.0634C19.2261 27.1415 18.6106 26.2287 19.35 24.75C20.25 22.95 21.75 22.95 24.05 22.95C25.2001 22.95 26.5501 22.95 28.125 22.725C30.9614 22.3199 31.5 20.5763 31.5 18Z" stroke="black" stroke-width="1.8"/>
              <path d="M14.625 15.3C15.7434 15.3 16.65 14.3934 16.65 13.275C16.65 12.1566 15.7434 11.25 14.625 11.25C13.5066 11.25 12.6 12.1566 12.6 13.275C12.6 14.3934 13.5066 15.3 14.625 15.3Z" stroke="black" stroke-width="1.8"/>
              <path d="M24.075 16.65C25.1934 16.65 26.1 15.7434 26.1 14.625C26.1 13.5066 25.1934 12.6 24.075 12.6C22.9566 12.6 22.05 13.5066 22.05 14.625C22.05 15.7434 22.9566 16.65 24.075 16.65Z" stroke="black" stroke-width="1.8"/>
            </g>
          </svg>
        `;
    return `
      <div class="history-card-empty-state" aria-live="polite">
        <div class="history-card-empty-icon" aria-hidden="true">
          ${emptyIcon}
        </div>
        <p class="history-card-empty-copy">${title}<br>${subtitle}</p>
      </div>
    `;
  }

  function renderItem(entry, index, section, mode) {
    if (section === "typeface") {
      const title = String(entry?.name || "Untitled Typeface");
      return `
        <div class="history-card-item typeface-history-item${mode === "deleted" ? " history-card-item-muted" : ""}" role="listitem" tabindex="0" data-history-idx="${index}" data-history-mode="${mode}" data-history-section="typeface" data-history-ts="${Number(entry?.updatedAt || entry?.savedAt) || ""}">
          <div class="history-card-item-surface">
            <div class="history-card-item-icon typeface-history-item-icon">
              <span class="typeface-history-item-monogram">Aa</span>
            </div>
            <div class="history-card-item-copy">
              <p class="history-card-item-title">${title}</p>
              <p class="history-card-item-meta">Saved ${timeAgo(entry?.updatedAt || entry?.savedAt || Date.now())}</p>
            </div>
            <div class="history-card-item-menu-wrap">
              <button class="history-card-item-menu-trigger" type="button" aria-label="More actions" aria-expanded="false">
                <span></span><span></span><span></span>
              </button>
            </div>
          </div>
        </div>
      `;
    }
    const swatches = normalizePaletteEntry(entry);
    const title = String(entry?.name || paletteName(swatches));
    return `
      <div class="history-card-item palette-history-item${mode === "deleted" ? " history-card-item-muted" : ""}" role="listitem" tabindex="0" data-history-idx="${index}" data-history-mode="${mode}" data-history-section="palette" data-history-ts="${Number(entry?.updatedAt || entry?.savedAt) || ""}">
        <div class="history-card-item-surface">
          <div class="history-card-item-icon palette-history-item-icon">${palettePreviewStripes(swatches)}</div>
          <div class="history-card-item-copy">
            <p class="history-card-item-title">${title}</p>
            <p class="history-card-item-meta">Saved ${timeAgo(entry?.updatedAt || entry?.savedAt || Date.now())}</p>
          </div>
          <div class="history-card-item-menu-wrap">
            <button class="history-card-item-menu-trigger" type="button" aria-label="More actions" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  window.__motvinHistoryShared = {
    canAddSavedHistoryEntry,
    getHistoryLimitMessage,
    getHistoryLimitToast,
    getHistorySectionLabel,
    normalizePaletteEntry,
    paletteName,
    palettePreviewStripes,
    buildUniqueDuplicateName,
    showHistoryLimitToast,
    timeAgo,
    loadEntries,
    saveEntries,
    renderEmptyState,
    renderItem,
    keys: {
      PALETTE_COLLECTION_KEY,
      PALETTE_DELETED_KEY,
      PALETTE_STATE_KEY,
      PALETTE_EDITING_ID_KEY,
      TYPEFACE_COLLECTION_KEY,
      TYPEFACE_DELETED_KEY,
      TYPEFACE_PENDING_SNAPSHOT_KEY,
      TYPEFACE_EDITING_ID_KEY,
      TYPEFACE_FORCE_NEW_KEY,
      HISTORY_STORAGE_EVENT,
    },
  };

  function init(config = {}) {
    ensureSameWindowStorageEvents();
    const defaultSection = config.defaultSection === "typeface" ? "typeface" : "palette";
    const getCurrentSection = typeof config.getCurrentSection === "function" ? config.getCurrentSection : null;
    const getCurrentMode = typeof config.getCurrentMode === "function" ? config.getCurrentMode : null;
    const onSectionChange = typeof config.onSectionChange === "function" ? config.onSectionChange : null;
    const onModeChange = typeof config.onModeChange === "function" ? config.onModeChange : null;
    const externalLoadEntries = typeof config.loadEntries === "function" ? config.loadEntries : null;
    const externalSaveEntries = typeof config.saveEntries === "function" ? config.saveEntries : null;
    const externalOpenEntry = typeof config.openEntry === "function" ? config.openEntry : null;
    const externalActions = config.actions && typeof config.actions === "object" ? config.actions : null;
    const notifyUser = typeof config.notify === "function" ? config.notify : notify;
    const popup = document.getElementById("historyPopup");
    const backdrop = document.getElementById("historyPopupBackdrop");
    const list = document.getElementById("historyPopupList");
    const searchInput = document.getElementById("historyPopupSearchInput");
    const filterBtn = document.getElementById("historyPopupFilterBtn");
    const filterMenu = document.getElementById("historyPopupFilterMenu");
    const closeBtn = popup ? popup.querySelector(".history-popup-close") : null;
    const titleBtn = popup ? popup.querySelector(".history-popup-title-btn") : null;
    const titleText = popup ? popup.querySelector(".history-popup-title") : null;
    const header = document.getElementById("historyPopupHeader");
    const sectionMenu = document.getElementById("historyPopupSectionMenu");
    const sectionItems = sectionMenu ? Array.from(sectionMenu.querySelectorAll(".history-popup-section-item")) : [];
    const tabButtons = popup ? Array.from(popup.querySelectorAll(".history-popup-tab")) : [];
    const clip = popup ? popup.querySelector(".history-popup-inner-clip") : null;
    if (!popup || !list) return;
    if (popup.dataset.localHistoryPopupReady === "true") return;
    popup.dataset.localHistoryPopupReady = "true";

    let currentSection = getCurrentSection ? (getCurrentSection() === "typeface" ? "typeface" : "palette") : defaultSection;
    let currentMode = getCurrentMode ? (getCurrentMode() === "deleted" ? "deleted" : "history") : "history";
    let currentFilter = "recent";
    let menuHost = null;
    let menuContext = null;
    let activeRenameIndex = null;
    let activeRenameSection = "palette";
    let activeRenameRestoreFocusEl = null;

    const renameDialog = document.createElement("div");
    renameDialog.className = "styles-toolbar-preview-popover styles-toolbar-save-popover history-rename-dialog";
    renameDialog.style.zIndex = "10090";
    renameDialog.setAttribute("aria-hidden", "true");
    renameDialog.setAttribute("role", "dialog");
    renameDialog.setAttribute("aria-modal", "true");
    renameDialog.innerHTML = `
      <div class="styles-toolbar-preview-card styles-toolbar-save-card">
        <div class="styles-toolbar-preview-header styles-toolbar-save-header">
          <div class="styles-toolbar-preview-title styles-toolbar-save-title">Rename Palette</div>
          <button class="styles-toolbar-preview-close styles-toolbar-save-close" type="button" aria-label="Close rename dialog">
            <span class="styles-toolbar-preview-close-icon" aria-hidden="true"></span>
          </button>
        </div>
        <div class="styles-toolbar-save-body">
          <p class="styles-toolbar-save-description">Update the palette name shown in Colour Palettes on the Project page.</p>
          <label class="styles-toolbar-save-field">
            <span class="styles-toolbar-save-label">Palette name</span>
            <input class="styles-toolbar-save-input" type="text" maxlength="60" placeholder="Enter palette name" />
          </label>
          <div class="styles-toolbar-save-actions">
            <button class="styles-toolbar-save-action styles-toolbar-save-action-secondary" type="button" data-history-rename-action="cancel">Cancel</button>
            <button class="styles-toolbar-save-action styles-toolbar-save-action-primary" type="button" data-history-rename-action="save">Rename palette</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(renameDialog);

    const renameDialogInput = renameDialog.querySelector(".styles-toolbar-save-input");
    const renameDialogCloseButton = renameDialog.querySelector(".styles-toolbar-save-close");
    const renameDialogCancelButton = renameDialog.querySelector('[data-history-rename-action="cancel"]');
    const renameDialogSaveButton = renameDialog.querySelector('[data-history-rename-action="save"]');
    const renameDialogTitle = renameDialog.querySelector(".styles-toolbar-save-title");
    const renameDialogDescription = renameDialog.querySelector(".styles-toolbar-save-description");
    const renameDialogLabel = renameDialog.querySelector(".styles-toolbar-save-label");

    function applyRenameDialogCopy(section) {
      const isTypeface = section === "typeface";
      if (renameDialogTitle) renameDialogTitle.textContent = isTypeface ? "Rename Typeface" : "Rename Palette";
      if (renameDialogDescription) {
        renameDialogDescription.textContent = isTypeface
          ? "Update the typeface preset name shown in the Project sidebar."
          : "Update the palette name shown in Colour Palettes on the Project page.";
      }
      if (renameDialogLabel) renameDialogLabel.textContent = isTypeface ? "Typeface name" : "Palette name";
      if (renameDialogInput) renameDialogInput.placeholder = isTypeface ? "Enter typeface name" : "Enter palette name";
      if (renameDialogSaveButton) renameDialogSaveButton.textContent = isTypeface ? "Rename typeface" : "Rename palette";
    }

    function closeRenameDialog({ restoreFocus = false } = {}) {
      if (renameDialog.contains(document.activeElement) && document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      renameDialog.classList.remove("is-open");
      renameDialog.setAttribute("aria-hidden", "true");
      activeRenameIndex = null;
      activeRenameSection = "palette";
      if (renameDialogInput) renameDialogInput.value = "";
      if (restoreFocus && activeRenameRestoreFocusEl && typeof activeRenameRestoreFocusEl.focus === "function") {
        activeRenameRestoreFocusEl.focus({ preventScroll: true });
      }
      activeRenameRestoreFocusEl = null;
    }

    function submitRenameDialog() {
      if (!Number.isInteger(activeRenameIndex) || !renameDialogInput) return false;
      const nextName = renameDialogInput.value.trim();
      if (!nextName) {
        renameDialogInput.focus();
        return false;
      }
      const entries = loadEntries(activeRenameSection, "history");
      const entry = entries[activeRenameIndex];
      if (!entry) return false;
      entry.name = nextName;
      entry.updatedAt = Date.now();
      if (externalSaveEntries) externalSaveEntries(activeRenameSection, "history", entries);
      else saveEntries(activeRenameSection, "history", entries);
      renderList();
      closeRenameDialog();
      return true;
    }

    function openRenameDialog(index, currentName, restoreFocusEl = null, section = "palette") {
      if (!Number.isInteger(index) || index < 0 || !renameDialogInput) return;
      activeRenameIndex = index;
      activeRenameSection = section === "typeface" ? "typeface" : "palette";
      activeRenameRestoreFocusEl = restoreFocusEl;
      applyRenameDialogCopy(activeRenameSection);
      renameDialogInput.value = currentName || "";
      renameDialog.classList.add("is-open");
      renameDialog.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        renameDialogInput.focus({ preventScroll: true });
        renameDialogInput.select();
      });
    }

    if (renameDialogCloseButton) {
      renameDialogCloseButton.addEventListener("click", () => closeRenameDialog({ restoreFocus: true }));
    }
    if (renameDialogCancelButton) {
      renameDialogCancelButton.addEventListener("click", () => closeRenameDialog({ restoreFocus: true }));
    }
    if (renameDialogSaveButton) {
      renameDialogSaveButton.addEventListener("click", () => submitRenameDialog());
    }
    renameDialog.addEventListener("click", (event) => {
      if (event.target === renameDialog) closeRenameDialog({ restoreFocus: true });
    });
    if (renameDialogInput) {
      renameDialogInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitRenameDialog();
        }
      });
    }
    applyRenameDialogCopy("palette");

    function ensureMenu() {
      if (menuHost) return menuHost;
      menuHost = document.createElement("div");
      menuHost.className = "history-card-floating-menu hidden";
      document.body.appendChild(menuHost);
      return menuHost;
    }

    function closeMenu() {
      document.querySelectorAll(".history-card-item[data-menu-open='true']").forEach((item) => {
        item.dataset.menuOpen = "false";
      });
      if (!menuHost) return;
      menuHost.classList.add("hidden");
      menuHost.innerHTML = "";
      menuContext = null;
      document.querySelectorAll(".history-card-item-menu-trigger[aria-expanded='true']").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });
    }

    function setFilterMenuOpen(isOpen) {
      if (!filterMenu) return;
      filterMenu.classList.toggle("hidden", !isOpen);
      if (filterBtn) filterBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function setSectionMenuOpen(isOpen) {
      if (!sectionMenu) return;
      sectionMenu.classList.toggle("hidden", !isOpen);
      if (titleBtn) titleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function setPopupVisibility(isOpen) {
      popup.classList.toggle("hidden", !isOpen);
      if (backdrop) backdrop.classList.toggle("hidden", !isOpen);
    }

    function savePopupState() {
      try {
        const rect = popup.getBoundingClientRect();
        sessionStorage.setItem(POPUP_STATE_KEY, JSON.stringify({
          open: true,
          section: currentSection,
          mode: currentMode,
          filter: currentFilter,
          top: popup.style.top || "",
          left: popup.style.left || "",
          width: popup.style.width || "",
          height: popup.style.height || "",
          transform: popup.style.transform || "",
        }));
      } catch { }
    }

    function clearPopupState() {
      try { sessionStorage.removeItem(POPUP_STATE_KEY); } catch { }
    }

    function syncSectionUi() {
      const isTypeface = currentSection === "typeface";
      popup.setAttribute("aria-label", isTypeface ? "Expanded typeface history" : "Expanded colour palette history");
      popup.dataset.historySection = currentSection;
      if (titleText) titleText.textContent = getHistorySectionLabel(currentSection);
      if (titleBtn) {
        titleBtn.dataset.historySection = currentSection;
        titleBtn.classList.toggle("history-popup-title-btn--palette", !isTypeface);
        titleBtn.classList.toggle("history-popup-title-btn--typeface", isTypeface);
      }
      if (clip) {
        clip.dataset.historySection = currentSection;
        clip.classList.toggle("history-popup-inner-clip--palette", !isTypeface);
        clip.classList.toggle("history-popup-inner-clip--typeface", isTypeface);
      }
      list.dataset.historySection = currentSection;
      list.classList.toggle("history-popup-list--palette", !isTypeface);
      list.classList.toggle("history-popup-list--typeface", isTypeface);
      if (searchInput) {
        searchInput.placeholder = isTypeface ? "Search typeface presets…" : "Search palettes…";
      }
      sectionItems.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.popupSection === currentSection);
      });
    }

    function syncTabs() {
      tabButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.popupTab === currentMode);
      });
    }

    function renderList() {
      const entries = externalLoadEntries ? (externalLoadEntries(currentSection, currentMode) || []) : loadEntries(currentSection, currentMode);
      list.innerHTML = entries.length
        ? entries.map((entry, index) => renderItem(entry, index, currentSection, currentMode)).join("")
        : renderEmptyState(currentSection, currentMode);
      applyFilters();
    }

    function getItemDate(row) {
      const ts = row.dataset.historyTs || row.dataset.historyId;
      if (!ts) return null;
      const value = Number(ts);
      return Number.isFinite(value) && value > 1e12 ? new Date(value) : null;
    }

    function applyFilters() {
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const rows = Array.from(list.querySelectorAll(".history-card-item"));
      const counts = { recent: rows.length, today: 0, yesterday: 0, last7: 0 };
      const isToday = (date) => {
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      };
      const isYesterday = (date) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate();
      };
      const isLast7Days = (date) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        cutoff.setHours(0, 0, 0, 0);
        return date >= cutoff;
      };

      rows.forEach((row) => {
        const date = getItemDate(row);
        if (date) {
          if (isToday(date)) counts.today += 1;
          if (isYesterday(date)) counts.yesterday += 1;
          if (isLast7Days(date)) counts.last7 += 1;
        }
      });

      if (filterMenu) {
        filterMenu.querySelectorAll("[data-filter-count]").forEach((pill) => {
          const key = pill.dataset.filterCount;
          pill.textContent = counts[key] !== undefined ? counts[key] : 0;
        });
      }

      rows.forEach((row) => {
        const title = String(row.querySelector(".history-card-item-title")?.textContent || "").toLowerCase();
        const matchesQuery = !query || title.includes(query);
        if (currentFilter === "recent") {
          row.style.display = matchesQuery ? "" : "none";
          return;
        }
        const date = getItemDate(row);
        let show = false;
        if (date) {
          if (currentFilter === "today") show = isToday(date);
          else if (currentFilter === "yesterday") show = isYesterday(date);
          else if (currentFilter === "last7") show = isLast7Days(date);
        }
        row.style.display = show && matchesQuery ? "" : "none";
      });
      if (filterBtn) filterBtn.classList.toggle("is-active", currentFilter !== "recent");
      if (filterMenu) {
        Array.from(filterMenu.querySelectorAll(".history-popup-filter-item")).forEach((item) => {
          item.classList.toggle("active", item.dataset.filter === currentFilter);
        });
      }
    }

    function open(section = defaultSection) {
      currentSection = getCurrentSection
        ? (getCurrentSection() === "typeface" ? "typeface" : "palette")
        : (section === "typeface" ? "typeface" : "palette");
      currentMode = getCurrentMode ? (getCurrentMode() === "deleted" ? "deleted" : "history") : "history";
      currentFilter = "recent";
      if (searchInput) searchInput.value = "";
      popup.style.top = "50%";
      popup.style.left = "50%";
      popup.style.width = "";
      popup.style.height = "";
      popup.style.transform = "";
      popup.classList.remove("is-dragging", "is-resizing");
      closeMenu();
      setFilterMenuOpen(false);
      setSectionMenuOpen(false);
      closeRenameDialog();
      syncSectionUi();
      syncTabs();
      renderList();
      setPopupVisibility(true);
      requestAnimationFrame(() => requestAnimationFrame(() => popup.classList.add("visible")));
      savePopupState();
    }

    function close() {
      clearPopupState();
      closeMenu();
      setFilterMenuOpen(false);
      setSectionMenuOpen(false);
      closeRenameDialog();
      popup.classList.remove("visible");
      const handle = () => {
        setPopupVisibility(false);
        popup.removeEventListener("transitionend", handle);
      };
      popup.addEventListener("transitionend", handle, { once: true });
    }

    function openEntry(index) {
      if (externalOpenEntry) {
        return externalOpenEntry({ index, section: currentSection, mode: currentMode, close });
      }
      const entries = loadEntries(currentSection, currentMode);
      const entry = entries[index];
      if (!entry || currentMode === "deleted") return;
      const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
      const isOnTypefacePage = currentPage === "typeface.html" || currentPage === "typeface";
      const isOnStylesPage = currentPage === "styles.html" || currentPage === "styles";
      if (currentSection === "typeface") {
        try { sessionStorage.setItem(TYPEFACE_PENDING_SNAPSHOT_KEY, JSON.stringify(entry.snapshot || {})); } catch { }
        try { localStorage.setItem(TYPEFACE_PENDING_SNAPSHOT_KEY, JSON.stringify(entry.snapshot || {})); } catch { }
        try { sessionStorage.removeItem(TYPEFACE_FORCE_NEW_KEY); } catch { }
        try { localStorage.removeItem(TYPEFACE_FORCE_NEW_KEY); } catch { }
        try { sessionStorage.setItem(TYPEFACE_EDITING_ID_KEY, String(entry.savedAt || "")); } catch { }
        try { localStorage.setItem(TYPEFACE_EDITING_ID_KEY, String(entry.savedAt || "")); } catch { }
        if (isOnTypefacePage) {
          window.dispatchEvent(new CustomEvent("motvin:history-apply-entry", { detail: { section: "typeface", entry } }));
          return;
        }
        window.location.href = "typeface.html";
        return;
      }
      try { localStorage.setItem(PALETTE_STATE_KEY, JSON.stringify(entry.swatches || entry.state || [])); } catch { }
      try { localStorage.setItem(PALETTE_EDITING_ID_KEY, String(entry.savedAt || "")); } catch { }
      if (isOnStylesPage) {
        window.dispatchEvent(new CustomEvent("motvin:history-apply-entry", { detail: { section: "palette", entry } }));
        return;
      }
      window.location.href = "styles.html";
    }

    function mutateEntries(action) {
      if (externalActions && typeof externalActions[action] === "function") {
        const result = externalActions[action]({
          index: menuContext.index,
          section: menuContext.section,
          mode: menuContext.mode,
          entry: loadEntries(menuContext.section, menuContext.mode)[menuContext.index],
          restoreFocusEl: document.querySelector(`.history-card-item[data-history-mode='${menuContext.mode}'][data-history-idx='${menuContext.index}'] .history-card-item-menu-trigger`),
          openRenameDialog,
          close,
          render: renderList,
        });
        if (action !== "rename") {
          closeMenu();
          if (result !== false) renderList();
        }
        return;
      }
      const entries = loadEntries(menuContext.section, menuContext.mode);
      const deletedEntries = loadEntries(menuContext.section, menuContext.mode === "deleted" ? "history" : "deleted");
      const entry = entries[menuContext.index];
      if (!entry) return;
      if (action === "archive" && menuContext.mode === "history") {
        entries.splice(menuContext.index, 1);
        deletedEntries.unshift(entry);
        if (externalSaveEntries) {
          externalSaveEntries(menuContext.section, "history", entries);
          externalSaveEntries(menuContext.section, "deleted", deletedEntries);
        } else {
          saveEntries(menuContext.section, "history", entries);
          saveEntries(menuContext.section, "deleted", deletedEntries);
        }
      } else if (action === "restore" && menuContext.mode === "deleted") {
        if (!canAddSavedHistoryEntry(deletedEntries)) {
          const limitSection = menuContext.section;
          closeMenu();
          queueHistoryLimitToast(limitSection, notifyUser, {
            delay: externalSaveEntries || externalActions ? 0 : 40,
            preferDirect: !externalSaveEntries && !externalActions,
          });
          return;
        }
        entries.splice(menuContext.index, 1);
        entry.updatedAt = Date.now();
        deletedEntries.unshift(entry);
        if (externalSaveEntries) {
          externalSaveEntries(menuContext.section, "deleted", entries);
          externalSaveEntries(menuContext.section, "history", deletedEntries);
        } else {
          saveEntries(menuContext.section, "deleted", entries);
          saveEntries(menuContext.section, "history", deletedEntries);
        }
      } else if (action === "delete-permanently" && menuContext.mode === "deleted") {
        entries.splice(menuContext.index, 1);
        if (externalSaveEntries) externalSaveEntries(menuContext.section, "deleted", entries);
        else saveEntries(menuContext.section, "deleted", entries);
      } else if (action === "duplicate" && menuContext.mode === "history") {
        if (!canAddSavedHistoryEntry(entries)) {
          const limitSection = menuContext.section;
          closeMenu();
          queueHistoryLimitToast(limitSection, notifyUser, {
            delay: externalSaveEntries || externalActions ? 0 : 40,
            preferDirect: !externalSaveEntries && !externalActions,
          });
          return;
        }
        const clone = JSON.parse(JSON.stringify(entry));
        clone.savedAt = Date.now();
        clone.name = buildUniqueDuplicateName(entries, clone.name, menuContext.section === "typeface" ? "Untitled Typeface" : "Untitled Palette");
        entries.splice(menuContext.index + 1, 0, clone);
        if (externalSaveEntries) externalSaveEntries(menuContext.section, "history", entries);
        else saveEntries(menuContext.section, "history", entries);
      } else if (action === "rename" && menuContext.mode === "history") {
        const renameIndex = menuContext.index;
        const renameMode = menuContext.mode;
        const renameSection = menuContext.section;
        const renameName = String(entry.name || "");
        const restoreFocusEl = document.querySelector(`.history-card-item[data-history-mode='${renameMode}'][data-history-idx='${renameIndex}'] .history-card-item-menu-trigger`);
        closeMenu();
        openRenameDialog(renameIndex, renameName, restoreFocusEl || document.activeElement, renameSection);
        return;
      }
      closeMenu();
      renderList();
    }

    function positionMenu(trigger, menu) {
      if (!trigger || !menu) return;
      const gap = 6;
      const viewportPad = 12;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let left = triggerRect.right - menuRect.width;
      left = Math.max(viewportPad, Math.min(left, window.innerWidth - menuRect.width - viewportPad));
      let top = triggerRect.bottom + gap;
      if (top + menuRect.height > window.innerHeight - viewportPad) {
        top = triggerRect.top - menuRect.height - gap;
      }
      top = Math.max(viewportPad, top);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function openMenu(trigger, row, index, mode, section) {
      const menu = ensureMenu();
      const isDeleted = mode === "deleted";
      menu.innerHTML = isDeleted
        ? '<button class="history-card-item-menu-item" type="button" data-menu-action="restore">Restore</button><button class="history-card-item-menu-item is-danger" type="button" data-menu-action="delete-permanently">Permanent Delete</button>'
        : '<button class="history-card-item-menu-item" type="button" data-menu-action="rename">Rename</button><button class="history-card-item-menu-item" type="button" data-menu-action="duplicate">Duplicate</button><button class="history-card-item-menu-item" type="button" data-menu-action="archive">Archive</button>';
      menuContext = { index, mode, section };
      if (row) row.dataset.menuOpen = "true";
      menu.classList.remove("hidden");
      trigger.setAttribute("aria-expanded", "true");
      positionMenu(trigger, menu);
    }

    if (closeBtn) closeBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && renameDialog.classList.contains("is-open")) {
        closeRenameDialog({ restoreFocus: true });
        return;
      }
      if (event.key === "Escape" && !popup.classList.contains("hidden")) close();
    });

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (filterBtn && filterMenu) {
      filterBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        setFilterMenuOpen(filterMenu.classList.contains("hidden"));
      });
      filterMenu.addEventListener("click", (event) => {
        const item = event.target.closest(".history-popup-filter-item");
        if (!item) return;
        currentFilter = item.dataset.filter || "recent";
        setFilterMenuOpen(false);
        applyFilters();
      });
    }

    if (titleBtn && sectionMenu) {
      titleBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        setSectionMenuOpen(sectionMenu.classList.contains("hidden"));
      });
      sectionMenu.addEventListener("click", (event) => {
        const item = event.target.closest(".history-popup-section-item");
        if (!item) return;
        currentSection = item.dataset.popupSection === "typeface" ? "typeface" : "palette";
        if (onSectionChange) onSectionChange(currentSection);
        setSectionMenuOpen(false);
        syncSectionUi();
        renderList();
      });
    }

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        currentMode = button.dataset.popupTab === "deleted" ? "deleted" : "history";
        if (onModeChange) onModeChange(currentMode);
        syncTabs();
        renderList();
      });
    });

    (function initPopupDrag() {
      if (!header) return;
      let drag = null;

      header.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button") || event.target.closest("input")) return;
        event.preventDefault();
        header.setPointerCapture(event.pointerId);

        const rect = popup.getBoundingClientRect();
        popup.style.top = `${rect.top}px`;
        popup.style.left = `${rect.left}px`;
        popup.style.transform = "none";
        popup.classList.add("is-dragging");

        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startTop: rect.top,
          startLeft: rect.left,
        };
      });

      document.addEventListener("pointermove", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        popup.style.top = `${drag.startTop + (event.clientY - drag.startY)}px`;
        popup.style.left = `${drag.startLeft + (event.clientX - drag.startX)}px`;
      });

      document.addEventListener("pointerup", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        popup.classList.remove("is-dragging");
        drag = null;
        savePopupState();
      });
    })();

    (function initPopupResize() {
      const handles = Array.from(popup.querySelectorAll(".history-popup-resize"));
      if (!handles.length) return;

      const minWidth = 320;
      const minHeight = 280;
      let resizeState = null;
      const resizeCursorClasses = ["popup-resize-ns", "popup-resize-ew", "popup-resize-nesw", "popup-resize-nwse"];
      const cursorClassMap = {
        n: "popup-resize-ns",
        s: "popup-resize-ns",
        e: "popup-resize-ew",
        w: "popup-resize-ew",
        ne: "popup-resize-nesw",
        sw: "popup-resize-nesw",
        nw: "popup-resize-nwse",
        se: "popup-resize-nwse",
      };
      const cursorValueMap = {
        n: "ns-resize",
        s: "ns-resize",
        e: "ew-resize",
        w: "ew-resize",
        ne: "nesw-resize",
        sw: "nesw-resize",
        nw: "nwse-resize",
        se: "nwse-resize",
      };

      function clearResizeCursorClasses() {
        document.documentElement.classList.remove(...resizeCursorClasses);
        popup.style.cursor = "";
      }

      handles.forEach((handle) => {
        const direction = handle.dataset.resize || "se";
        handle.style.cursor = cursorValueMap[direction] || "nwse-resize";

        handle.addEventListener("pointerenter", () => {
          if (resizeState) return;
          clearResizeCursorClasses();
          document.documentElement.classList.add(cursorClassMap[direction] || "popup-resize-nwse");
          popup.style.cursor = cursorValueMap[direction] || "nwse-resize";
        });

        handle.addEventListener("pointerleave", () => {
          if (resizeState) return;
          clearResizeCursorClasses();
        });

        handle.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          handle.setPointerCapture(event.pointerId);

          const rect = popup.getBoundingClientRect();
          resizeState = {
            dir: handle.dataset.resize,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startW: rect.width,
            startH: rect.height,
            startTop: rect.top,
            startLeft: rect.left,
            cursorClass: cursorClassMap[handle.dataset.resize] || "popup-resize-nwse",
          };

          clearResizeCursorClasses();
          document.documentElement.classList.add(resizeState.cursorClass);
          popup.style.cursor = cursorValueMap[resizeState.dir] || "nwse-resize";

          popup.style.top = `${rect.top}px`;
          popup.style.left = `${rect.left}px`;
          popup.style.transform = "none";
          popup.classList.add("is-resizing");
        });
      });

      document.addEventListener("pointermove", (event) => {
        if (!resizeState || resizeState.pointerId !== event.pointerId) return;
        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        const dir = resizeState.dir;
        let width = resizeState.startW;
        let height = resizeState.startH;
        let top = resizeState.startTop;
        let left = resizeState.startLeft;

        if (dir.includes("e")) width = Math.max(minWidth, resizeState.startW + dx);
        if (dir.includes("w")) {
          width = Math.max(minWidth, resizeState.startW - dx);
          left = resizeState.startLeft + (resizeState.startW - width);
        }
        if (dir.includes("s")) height = Math.max(minHeight, resizeState.startH + dy);
        if (dir.includes("n")) {
          height = Math.max(minHeight, resizeState.startH - dy);
          top = resizeState.startTop + (resizeState.startH - height);
        }

        popup.style.width = `${width}px`;
        popup.style.height = `${height}px`;
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
      });

      document.addEventListener("pointerup", (event) => {
        if (!resizeState || resizeState.pointerId !== event.pointerId) return;
        popup.classList.remove("is-resizing");
        clearResizeCursorClasses();
        resizeState = null;
        savePopupState();
      });
    })();

    list.addEventListener("click", (event) => {
      const menuTrigger = event.target.closest(".history-card-item-menu-trigger");
      if (menuTrigger) {
        event.preventDefault();
        event.stopPropagation();
        const row = menuTrigger.closest(".history-card-item");
        if (!row) return;
        if (menuContext && menuContext.index === Number(row.dataset.historyIdx) && !ensureMenu().classList.contains("hidden")) {
          closeMenu();
          return;
        }
        closeMenu();
        openMenu(menuTrigger, row, Number(row.dataset.historyIdx), row.dataset.historyMode || "history", row.dataset.historySection || currentSection);
        return;
      }
      const row = event.target.closest(".history-card-item");
      if (!row || event.target.closest(".history-card-item-menu-wrap")) return;
      openEntry(Number(row.dataset.historyIdx));
    });

    ensureMenu().addEventListener("click", (event) => {
      const menuAction = event.target.closest(".history-card-item-menu-item");
      if (!menuAction || !menuContext) return;
      event.preventDefault();
      event.stopPropagation();

      const action = menuAction.dataset.menuAction;
      if (action === "duplicate" && menuContext.mode === "history") {
        const currentEntries = externalLoadEntries
          ? (externalLoadEntries(menuContext.section, "history") || [])
          : loadEntries(menuContext.section, "history");
        if (!canAddSavedHistoryEntry(currentEntries)) {
          const limitSection = menuContext.section;
          closeMenu();
          queueHistoryLimitToast(limitSection, notifyUser, {
            delay: externalSaveEntries || externalActions ? 0 : 40,
            preferDirect: !externalSaveEntries && !externalActions,
          });
          return;
        }
      }

      if (action === "restore" && menuContext.mode === "deleted") {
        const currentHistoryEntries = externalLoadEntries
          ? (externalLoadEntries(menuContext.section, "history") || [])
          : loadEntries(menuContext.section, "history");
        if (!canAddSavedHistoryEntry(currentHistoryEntries)) {
          const limitSection = menuContext.section;
          closeMenu();
          queueHistoryLimitToast(limitSection, notifyUser, {
            delay: externalSaveEntries || externalActions ? 0 : 40,
            preferDirect: !externalSaveEntries && !externalActions,
          });
          return;
        }
      }

      mutateEntries(action);
    });

    list.addEventListener("keydown", (event) => {
      const row = event.target.closest(".history-card-item");
      if (!row) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest(".history-card-item-menu-wrap")) return;
      event.preventDefault();
      openEntry(Number(row.dataset.historyIdx));
    });

    document.addEventListener("click", (event) => {
      if (filterMenu && !filterMenu.classList.contains("hidden") && !filterMenu.contains(event.target) && event.target !== filterBtn && !filterBtn?.contains(event.target)) {
        setFilterMenuOpen(false);
      }
      if (sectionMenu && !sectionMenu.classList.contains("hidden") && !sectionMenu.contains(event.target) && event.target !== titleBtn && !titleBtn?.contains(event.target)) {
        setSectionMenuOpen(false);
      }
      if (menuHost && !menuHost.classList.contains("hidden") && !menuHost.contains(event.target) && !event.target.closest(".history-card-item-menu-trigger")) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => closeMenu());
    document.addEventListener("scroll", () => closeMenu(), true);
    window.addEventListener("storage", (event) => {
      if ([PALETTE_COLLECTION_KEY, PALETTE_DELETED_KEY, TYPEFACE_COLLECTION_KEY, TYPEFACE_DELETED_KEY].includes(event.key)) {
        renderList();
      }
    });
    window.addEventListener(HISTORY_STORAGE_EVENT, (event) => {
      if (HISTORY_STORAGE_KEYS.has(event.detail?.key)) {
        renderList();
      }
    });

    function render() {
      if (getCurrentSection) {
        currentSection = getCurrentSection() === "typeface" ? "typeface" : "palette";
      }
      if (getCurrentMode) {
        currentMode = getCurrentMode() === "deleted" ? "deleted" : "history";
      }
      syncSectionUi();
      syncTabs();
      renderList();
    }

    window.__motvinOpenStandaloneHistoryPopup = open;
    window.__motvinCloseStandaloneHistoryPopup = close;
    window.__motvinStandaloneHistoryPopup = { open, close, render };

    /* ── Restore popup if it was open before refresh ── */
    try {
      const savedRaw = sessionStorage.getItem(POPUP_STATE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved && saved.open) {
          currentSection = saved.section === "typeface" ? "typeface" : "palette";
          currentMode = saved.mode === "deleted" ? "deleted" : "history";
          currentFilter = saved.filter || "recent";
          if (searchInput) searchInput.value = "";
          closeMenu();
          setFilterMenuOpen(false);
          setSectionMenuOpen(false);
          closeRenameDialog();
          syncSectionUi();
          syncTabs();
          renderList();
          /* Restore position & size */
          if (saved.top) popup.style.top = saved.top;
          else popup.style.top = "50%";
          if (saved.left) popup.style.left = saved.left;
          else popup.style.left = "50%";
          popup.style.width = saved.width || "";
          popup.style.height = saved.height || "";
          popup.style.transform = saved.transform || "";
          popup.classList.remove("is-dragging", "is-resizing");
          setPopupVisibility(true);
          requestAnimationFrame(() => requestAnimationFrame(() => popup.classList.add("visible")));
        }
      }
    } catch { }

    return window.__motvinStandaloneHistoryPopup;
  }

  window.__motvinCreateHistoryPopupController = init;
  window.__motvinInitStandaloneHistoryPopup = init;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const pageName = window.location.pathname.split("/").pop() || "";
      if (document.getElementById("historyPopup") && !/index\.html$/i.test(pageName)) {
        init({ defaultSection: /typeface\.html$/i.test(pageName) ? "typeface" : "palette" });
      }
    }, { once: true });
  } else if (document.getElementById("historyPopup")) {
    const pageName = window.location.pathname.split("/").pop() || "";
    if (!/index\.html$/i.test(pageName)) {
      init({ defaultSection: /typeface\.html$/i.test(pageName) ? "typeface" : "palette" });
    }
  }
})();
