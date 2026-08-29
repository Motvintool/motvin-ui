const storageState = {
    folderHandle: null,
    isSkipped: false,
    status: 'disconnected' // connected, disconnected
};

document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("storageOnboardingOverlay");
    const connectorTrigger = document.getElementById("connectorTrigger");
    const projectFolderCard = document.getElementById("projectFolderConnector");
    
    // New Connector Elements
    const connectorFolderName = document.getElementById("connectorFolderName");
    const connectorStatusText = document.getElementById("connectorStatusText");
    const connectorStatusCheck = document.getElementById("connectorStatusCheck");
    const DEFAULT_CONNECTOR_LABEL = "Untitled Project";
    if (connectorFolderName) connectorFolderName.textContent = DEFAULT_CONNECTOR_LABEL;
    const recentFoldersList = document.getElementById("recentFoldersList");
    const recentFoldersCount = document.getElementById("recentFoldersCount");
    const recentFoldersEmpty = document.getElementById("recentFoldersEmpty");
    const recentFoldersCta = document.getElementById("recentFoldersCta");
    const RECENT_FOLDER_ICON = "assets/icon/icon-recent-folder.svg";
    const RECENT_DELETE_ICON = "assets/icon/icon-delete.svg";
    const MAX_RECENT_FOLDERS = 7;
    let recentFolders = [];
    
    // Additional Modal elements
    const storageModalTitle = document.getElementById("storageModalTitle");
    const storageModalDesc = document.getElementById("storageModalDesc");
    const storageModalFeatures = document.getElementById("storageModalFeatures");
    const btnSelectFolder = document.getElementById("btnSelectFolder");
    const btnRemoveFolder = document.getElementById("btnRemoveFolder");
    const btnCloseModal = document.getElementById("btnCloseModal");
    const btnSkip = document.getElementById("btnSkip");
    // New premium-state elements
    const storageIconPrimary = document.getElementById("storageIconPrimary");
    const storageIconDanger = document.getElementById("storageIconDanger");
    const storageWarningNotice = document.getElementById("storageWarningNotice");

    // Local status icons (Connected + Disconnected)
    const statusIconConnected = "assets/icon/icon-connected.svg";
    const statusIconDisconnected = "assets/icon/icon-disconnected.svg";

    initStorage();

    async function initStorage() {
        recentFolders = await getRecentFoldersList();
        if (recentFolders.length > MAX_RECENT_FOLDERS) {
            recentFolders = recentFolders.slice(0, MAX_RECENT_FOLDERS);
            await saveRecentFolders(recentFolders);
        }
        renderRecentFolders();
        const handle = await getSavedFolderHandle();
        if (handle) {
            const hasPermission = await verifyPermission(handle, { mode: 'readwrite' });
            if (hasPermission) {
                storageState.folderHandle = handle;
                updateStatus('connected', handle.name);
                await ensureWorkspaceFolders(handle);
                // Wait for app.js workspace restore to finish first so we
                // don't create duplicate artboards (both paths load imports).
                // app.js sets _workspaceRestoreReady when its restore completes.
                await waitForWorkspaceRestore();
                await loadProjectsFromFolder(handle);
                await syncRecentHandle(handle);
            } else {
                updateStatus('disconnected', 'Access lost');
            }
        } else {
            updateStatus('disconnected', 'Connect Folder');
        }
    }

    function waitForWorkspaceRestore() {
        return new Promise((resolve) => {
            // If app.js already finished its restore, resolve immediately
            if (window._workspaceRestoreReady) { resolve(); return; }
            // Otherwise poll briefly — app.js sets the flag when done
            let elapsed = 0;
            const interval = setInterval(() => {
                elapsed += 50;
                if (window._workspaceRestoreReady || elapsed >= 3000) {
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
        });
    }

    function showOnboarding() {
        if (!overlay) return;
        
        if (storageState.status === 'connected') {
            // — Storage Settings state —
            storageModalTitle.textContent = "Storage Settings";
            storageModalDesc.textContent = "Your local folder is currently connected.";
            storageModalFeatures.classList.add("hidden");
            btnSelectFolder.classList.add("hidden");
            btnSkip.classList.add("hidden");
            btnRemoveFolder.classList.remove("hidden");
            btnCloseModal.classList.remove("hidden");
            // Switch to danger/warning icon and show notice
            if (storageIconPrimary) storageIconPrimary.classList.add("hidden");
            if (storageIconDanger)  storageIconDanger.classList.remove("hidden");
            if (storageWarningNotice) storageWarningNotice.classList.remove("hidden");
        } else {
            // — Local Storage (onboarding) state —
            storageModalTitle.textContent = "Local Storage";
            storageModalDesc.textContent = "Select a folder to store your projects locally";
            storageModalFeatures.classList.remove("hidden");
            btnSelectFolder.classList.remove("hidden");
            btnSkip.classList.remove("hidden");
            btnRemoveFolder.classList.add("hidden");
            btnCloseModal.classList.add("hidden");
            // Restore primary icon, hide warning
            if (storageIconPrimary) storageIconPrimary.classList.remove("hidden");
            if (storageIconDanger)  storageIconDanger.classList.add("hidden");
            if (storageWarningNotice) storageWarningNotice.classList.add("hidden");
        }
        
        overlay.classList.remove("hidden");
    }

    function hideOnboarding() {
        if(overlay) overlay.classList.add("hidden");
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", hideOnboarding);
    }

    if (btnRemoveFolder) {
        btnRemoveFolder.addEventListener("click", async () => {
             await clearFolderHandle();
             storageState.folderHandle = null;
             storageState.isSkipped = false;
             updateStatus('disconnected', 'Connect Folder');
             hideOnboarding();
             showToast("Disconnected", "Folder disconnected");
        });
    }

    if (btnSelectFolder) {
        btnSelectFolder.addEventListener("click", connectNewFolder);
    }

    if (recentFoldersCta) {
        recentFoldersCta.addEventListener("click", connectNewFolder);
    }

    if (btnSkip) {
        btnSkip.addEventListener("click", () => {
            storageState.isSkipped = true;
            updateStatus('disconnected', 'Connect Folder');
            hideOnboarding();
            showToast("Disconnected", "Connect a folder anytime to auto-save", "warning");
        });
    }

    if (connectorTrigger) {
        connectorTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            showOnboarding();
        });
    }

    async function connectNewFolder() {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await handleFolderConnection(handle);
        } catch (err) {
            console.warn(err);
            if (err?.name !== 'AbortError') {
                showToast("Connection Failed", "Failed to connect folder");
            }
        }
    }

    async function handleFolderConnection(handle, options = {}) {
        if (!handle) return;
        storageState.folderHandle = handle;
        storageState.isSkipped = false;
        await saveFolderHandle(handle);
        await ensureWorkspaceFolders(handle);
        updateStatus('connected', handle.name);
        if (!options.skipHide) hideOnboarding();
        if (!options.skipToast) {
            showToast("Connection Successful", "Folder connected successfully ✓");
        }
        await loadProjectsFromFolder(handle);
        await upsertRecentFolder(handle, { entry: options.entry });
    }

    async function ensureWorkspaceFolders(handle) {
        if (!handle) return;
        const requiredFolders = ["File-convert", "URL-convert", "Styles"];
        for (const folder of requiredFolders) {
            try {
                await getFolderHandle(handle, folder);
            } catch (err) {
                console.warn("Unable to prepare folder", folder, err);
            }
        }
    }

    async function reconnectRecentFolder(entry) {
        if (!entry || !entry.handle) {
            showToast("Permission Needed", "Please grant access to this folder again.", "warning");
            return;
        }
        try {
            const hasPermission = await verifyPermission(entry.handle, { mode: 'readwrite' });
            if (!hasPermission) {
                throw new Error("permission");
            }
            await handleFolderConnection(entry.handle, { entry });
        } catch (err) {
            console.warn("Recent folder reconnect failed", err);
            showToast("Permission Needed", "Allow access to this folder again.", "warning");
        }
    }

    function renderRecentFolders() {
        if (!recentFoldersList || !recentFoldersCount || !recentFoldersEmpty) return;
        const items = Array.isArray(recentFolders) ? recentFolders.slice() : [];
        items.sort((a, b) => (b?.lastUsed || 0) - (a?.lastUsed || 0));
        const visibleItems = items.slice(0, MAX_RECENT_FOLDERS).filter(Boolean);
        recentFoldersList.innerHTML = "";
        const hasItems = visibleItems.length > 0;
        recentFoldersList.classList.toggle("hidden", !hasItems);
        recentFoldersEmpty.classList.toggle("hidden", hasItems);
        const plural = items.length === 1 ? "folder" : "folders";
        recentFoldersCount.textContent = hasItems ? `${items.length} ${plural} found` : `0 folders found`;
        if (!hasItems) return;
        visibleItems.forEach((entry) => {
            if (!entry) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "storage-recent-card";
            button.setAttribute("data-recent-id", entry.id || "");

            const iconWrap = document.createElement("span");
            iconWrap.className = "storage-recent-icon";
            const icon = document.createElement("img");
            icon.src = RECENT_FOLDER_ICON;
            icon.alt = "";
            iconWrap.appendChild(icon);

            const info = document.createElement("span");
            info.className = "storage-recent-info";
            const nameEl = document.createElement("span");
            nameEl.className = "storage-recent-name";
            nameEl.textContent = entry.name || DEFAULT_CONNECTOR_LABEL;
            const metaEl = document.createElement("span");
            metaEl.className = "storage-recent-meta";
            metaEl.textContent = formatRecentMeta(entry);
            info.append(nameEl, metaEl);

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "storage-recent-delete";
            deleteBtn.setAttribute("aria-label", "Remove recent folder");
            const deleteIcon = document.createElement("img");
            deleteIcon.src = RECENT_DELETE_ICON;
            deleteIcon.alt = "";
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.addEventListener("click", (evt) => {
                evt.stopPropagation();
                removeRecentFolder(entry.id);
            });

            button.append(iconWrap, info, deleteBtn);
            button.addEventListener("click", () => reconnectRecentFolder(entry));
            recentFoldersList.appendChild(button);
        });
    }

    function formatRecentMeta(entry) {
        if (!entry) return "On this device";
        if (entry.folderPath) return entry.folderPath;
        if (entry.hint && entry.hint.includes("/")) return entry.hint;
        if (entry.lastUsed) {
            return buildRecentHint(entry.lastUsed);
        }
        return "On this device";
    }

    async function upsertRecentFolder(handle, options = {}) {
        if (!handle) return;
        const now = Date.now();
        const fallbackEntry = options.entry || recentFolders.find((item) => item && item.name === handle.name);
        const folderPathLabel = options.entry?.folderPath || fallbackEntry?.folderPath || options.entry?.hint || fallbackEntry?.hint || buildFolderPathLabel(handle);
        const record = {
            id: fallbackEntry?.id || generateRecentId(),
            name: handle.name || DEFAULT_CONNECTOR_LABEL,
            handle,
            lastUsed: now,
            hint: options.hint || fallbackEntry?.hint || buildRecentHint(now),
            folderPath: folderPathLabel
        };
        recentFolders = recentFolders.filter((item) => item && item.id !== record.id);
        recentFolders.unshift(record);
        if (recentFolders.length > MAX_RECENT_FOLDERS) {
            recentFolders.length = MAX_RECENT_FOLDERS;
        }
        await saveRecentFolders(recentFolders);
        renderRecentFolders();
    }

    async function syncRecentHandle(handle) {
        if (!handle) return;
        const existing = recentFolders.find((entry) => entry && entry.name === handle.name);
        if (existing) {
            existing.handle = handle;
            await saveRecentFolders(recentFolders);
            renderRecentFolders();
        } else {
            await upsertRecentFolder(handle);
        }
    }

    async function removeRecentFolder(id) {
        if (!id) return;
        const beforeCount = recentFolders.length;
        recentFolders = recentFolders.filter((entry) => entry && entry.id !== id);
        if (recentFolders.length === beforeCount) return;
        await saveRecentFolders(recentFolders);
        renderRecentFolders();
        showToast("Removed", "Recent folder removed", "success");
    }

    function generateRecentId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `recent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function buildRecentHint(timestamp = Date.now()) {
        const locale = navigator?.language || undefined;
        const date = new Date(timestamp);
        const formatted = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        return `On this device • ${formatted}`;
    }

    function buildFolderPathLabel(handle) {
        if (!handle) return "";
        if (typeof handle.path === 'string' && handle.path.trim()) return handle.path;
        if (typeof handle.fullPath === 'string' && handle.fullPath.trim()) return handle.fullPath;
        return `/${handle.name || DEFAULT_CONNECTOR_LABEL}`;
    }

    function updateStatus(status, text) {
        storageState.status = status;

        // Folder label
        if (connectorFolderName) {
            if (status === 'connected' && text) {
                connectorFolderName.textContent = text;
            } else {
                connectorFolderName.textContent = DEFAULT_CONNECTOR_LABEL;
            }
        }

        // Determine visual state for the card
        let statusLabel = "Disconnected";
        let statusColor = "#878787"; // disconnected grey
        let statusIcon = statusIconDisconnected;
        let showIcon = true;

        if (status === 'connected') {
            statusLabel = "Connected";
            statusColor = "#059669"; // green
            statusIcon = statusIconConnected;
        }

        // Apply text + color
        if (connectorStatusText) {
            connectorStatusText.textContent = statusLabel;
            connectorStatusText.style.color = statusColor;
        }

        // Apply icon
        if (connectorStatusCheck) {
            connectorStatusCheck.src = statusIcon;
            connectorStatusCheck.style.display = showIcon ? "block" : "none";
        }

        // Card background state classes (for Figma design)
        if (projectFolderCard) {
            projectFolderCard.classList.remove('sidemenu-card-connected', 'sidemenu-card-disconnected');
            if (status === 'connected') {
                projectFolderCard.classList.add('sidemenu-card-connected');
            } else {
                projectFolderCard.classList.add('sidemenu-card-disconnected');
            }
        }
    }

    function showToast(title, msg, state = "success") {
        const toast = document.getElementById("toastNotification");
        if (!toast || !toast.show) return;

        // Auto-detect State if not explicitly provided
        if (title.toLowerCase().includes("failed") || title.toLowerCase().includes("disconnected")) state = "failed";

        toast.show(title, msg, state);
    }

    // Auto-save functions
    window.autoSaveFile = async function(fileName, contentContent, folderName = "File-convert") {
        if (storageState.isSkipped || !storageState.folderHandle) return;
        try {
            const hasAccess = await verifyPermission(storageState.folderHandle, {mode: 'readwrite'});
            if (!hasAccess) {
                updateStatus('disconnected', 'Access lost');
                return;
            }
            
            const folderHandle = await getFolderHandle(storageState.folderHandle, folderName);
            const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(contentContent);
            await writable.close();
            
            showToast("Auto-Saved", "Saved locally ✓");
        } catch (err) {
            console.error("Auto save error", err);
            // Handle gracefully, maybe it fell out of sync
        }
    };

    window.autoDeleteFile = async function(fileName, folderName = "File-convert") {
        if (storageState.isSkipped || !storageState.folderHandle) return;
        try {
            const hasAccess = await verifyPermission(storageState.folderHandle, {mode: 'readwrite'});
            if (!hasAccess) {
                updateStatus('disconnected', 'Access lost');
                return;
            }
            const folderHandle = await getFolderHandle(storageState.folderHandle, folderName);
            await folderHandle.removeEntry(fileName);
        } catch (err) {
            // File may not exist — that's fine, ignore gracefully
            if (err?.name !== 'NotFoundError') {
                console.warn("Auto delete error", err);
            }
        }
    };

    async function loadProjectsFromFolder(rootHandle) {
        try {
            // Skip loading from folder if artboards already exist on canvas
            // (restored from workspace snapshot or still present from current session)
            if (window._getImportCount && window._getImportCount() > 0) return;

            const allFiles = [];

            async function scanEntries(handle, path = "") {
                for await (const entry of handle.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file.name === 'Capture.html') continue;

                        const fullPath = path ? `${path}/${entry.name}` : entry.name;
                        try {
                            Object.defineProperty(file, 'webkitRelativePath', {
                                value: fullPath,
                                writable: true,
                                configurable: true
                            });
                        } catch (e) {
                            file.customPath = fullPath;
                        }
                        allFiles.push(file);
                    } else if (entry.kind === 'directory') {
                        await scanEntries(entry, path ? `${path}/${entry.name}` : entry.name);
                    }
                }
            }

            // Scan both File-convert and URL-convert folders
            const foldersToScan = ["File-convert", "URL-convert"];
            for (const folder of foldersToScan) {
                try {
                    const folderHandle = await getFolderHandle(rootHandle, folder);
                    await scanEntries(folderHandle);
                } catch (e) {
                    // Folder may not exist yet — that's fine
                }
            }

            if (allFiles.length > 0 && window.loadAppFiles) {
                // Flag to prevent re-saving files that are already on disk
                window._isRestoringFromFolder = true;
                try {
                    await window.loadAppFiles(allFiles, rootHandle.name);
                } finally {
                    window._isRestoringFromFolder = false;
                }
            }
        } catch (e) {
            console.warn("Could not read project folders to load existing project.", e);
        }
    }
});

// IndexedDB Helper
async function getSavedFolderHandle() {
    return new Promise((resolve) => {
         const req = indexedDB.open("Code2DesignDB", 1);
         req.onupgradeneeded = (e) => {
             const db = e.target.result;
             if (!db.objectStoreNames.contains("handles")) {
                 db.createObjectStore("handles");
             }
         };
         req.onsuccess = (e) => {
             const db = e.target.result;
             if (!db.objectStoreNames.contains("handles")) {
                 resolve(null);
                 return;
             }
             const tx = db.transaction("handles", "readonly");
             const store = tx.objectStore("handles");
             const reqGet = store.get("projectFolderHandle");
             reqGet.onsuccess = () => resolve(reqGet.result);
             reqGet.onerror = () => resolve(null);
         };
         req.onerror = () => resolve(null);
    });
}

async function clearFolderHandle() {
    return new Promise((resolve) => {
         const req = indexedDB.open("Code2DesignDB", 1);
         req.onsuccess = (e) => {
             const db = e.target.result;
             if (!db.objectStoreNames.contains("handles")) return resolve();
             const tx = db.transaction("handles", "readwrite");
             const store = tx.objectStore("handles");
             store.delete("projectFolderHandle");
             tx.oncomplete = () => resolve();
         };
         req.onerror = () => resolve();
    });
}

async function saveFolderHandle(handle) {
    return new Promise((resolve) => {
         const req = indexedDB.open("Code2DesignDB", 1);
         req.onupgradeneeded = (e) => {
             const db = e.target.result;
             if (!db.objectStoreNames.contains("handles")) {
                 db.createObjectStore("handles");
             }
         };
         req.onsuccess = (e) => {
             const db = e.target.result;
             const tx = db.transaction("handles", "readwrite");
             const store = tx.objectStore("handles");
             store.put(handle, "projectFolderHandle");
             tx.oncomplete = () => resolve();
         };
    });
}

async function verifyPermission(fileHandle, opts) {
  if ((await fileHandle.queryPermission(opts)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(opts)) === 'granted') {
    return true;
  }
  return false;
}

async function getFolderHandle(rootHandle, folderName) {
    return await rootHandle.getDirectoryHandle(folderName, { create: true });
}

async function getRecentFoldersList() {
    return new Promise((resolve) => {
        const req = indexedDB.open("Code2DesignDB", 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("handles")) {
                db.createObjectStore("handles");
            }
        };
        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("handles")) {
                resolve([]);
                return;
            }
            const tx = db.transaction("handles", "readonly");
            const store = tx.objectStore("handles");
            const reqGet = store.get("recentFolders");
            reqGet.onsuccess = () => {
                const value = reqGet.result;
                resolve(Array.isArray(value) ? value.filter(Boolean) : []);
            };
            reqGet.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
    });
}

async function saveRecentFolders(list) {
    return new Promise((resolve) => {
        const req = indexedDB.open("Code2DesignDB", 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("handles")) {
                db.createObjectStore("handles");
            }
        };
        req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction("handles", "readwrite");
            const store = tx.objectStore("handles");
            store.put(Array.isArray(list) ? list : [], "recentFolders");
            tx.oncomplete = () => resolve();
        };
        req.onerror = () => resolve();
    });
}
