// Sidebar.js: shared sidebar component for marketplace pages.
(function initSidebarComponent() {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isFileProtocol = window.location.protocol === 'file:';
  const motvinHref = (isLocalHost || isFileProtocol) ? 'MOTVIN/index.html' : '/motvin/';

  // Tracks every bound `.sidebar-profile-menu`, since opening one portals it to
  // document.body (see bindSidebarInteractions) so it escapes the `.sidebar`
  // stacking context (position: sticky traps its z-index otherwise) and can
  // no longer be found via `profile.querySelector('.sidebar-profile-menu')`.
  const profileMenuRegistry = new Set();
  const notifPopoverRegistry = new Set();

  function restoreProfileMenuHome(menu) {
    const homeParent = menu.__sidebarProfileHomeParent;
    if (!homeParent) return;
    const homeNext = menu.__sidebarProfileHomeNext;
    if (homeNext && homeNext.parentNode === homeParent) {
      homeParent.insertBefore(menu, homeNext);
    } else if (menu.parentNode !== homeParent) {
      homeParent.appendChild(menu);
    }
  }

  function restoreNotifPopoverHome(popover) {
    const homeParent = popover.__sidebarNotifHomeParent;
    if (!homeParent) return;
    const homeNext = popover.__sidebarNotifHomeNext;
    if (homeNext && homeNext.parentNode === homeParent) {
      homeParent.insertBefore(popover, homeNext);
    } else if (popover.parentNode !== homeParent) {
      homeParent.appendChild(popover);
    }
  }

  const primaryItems = [
    {
      key: 'recents',
      href: '/files',
      icon: 'ASSET/Icons/nav-recents.svg',
      label: 'Recents',
    },
    {
      key: 'discover',
      href: '/discover-templates',
      icon: 'ASSET/Icons/nav-discover-templates.svg',
      label: 'Discover Templates',
    },
    {
      key: 'my-post',
      href: '/my-post',
      icon: 'ASSET/Icons/nav-my-latest-post.svg',
      label: 'My Latest Post',
      liveBadge: 'latest-post',
    },
  ];

  const topItems = [
    {
      key: 'motvin',
      href: motvinHref,
      icon: 'ASSET/Icons/nav-discover-templates.svg',
      label: 'MOTVIN',
      badge: 'New ✨',
      badgeType: 'new',
      shellNavOff: false,
      openInNewTab: false,
    },
  ];

  const workItems = [
    {
      key: 'mobile-templates',
      href: '/mobile-template',
      icon: 'ASSET/Icons/nav-mobile-templates.svg',
      label: 'Mobile Templates',
      liveBadge: 'mobile-templates',
    },
    {
      key: 'web-templates',
      href: '/web-template',
      icon: 'ASSET/Icons/web-sidebar.svg',
      label: 'Web Templates',
      liveBadge: 'web-templates',
    },
  ];

  function getProducts() {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function normalizeType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'design-post' || normalized === 'design-posts') return 'design-post';
    if (normalized === 'template' || normalized === 'templates') return 'template';
    return 'template';
  }

  function isMobileTemplate(product) {
    const haystack = [product && product.category, product && product.title, product && product.summary, Array.isArray(product && product.tags) ? product.tags.join(' ') : '']
      .join(' ')
      .toLowerCase();
    return /mobile|app|ios|android/.test(haystack);
  }

  function isWebTemplate(product) {
    const haystack = [product && product.category, product && product.title, product && product.summary, Array.isArray(product && product.tags) ? product.tags.join(' ') : '']
      .join(' ')
      .toLowerCase();
    return /web|website|landing|dashboard|saas/.test(haystack);
  }

  function formatCountBadge(count) {
    const safe = Number.isFinite(count) && count > 0 ? count : 0;
    return String(safe).padStart(2, '0');
  }

  function getLiveBadges() {
    const products = getProducts();
    const templates = products.filter((item) => normalizeType(item && item.productType) === 'template');
    const designPosts = products.filter((item) => normalizeType(item && item.productType) === 'design-post');
    const mobileTemplates = templates.filter(isMobileTemplate);
    const webTemplates = templates.filter(isWebTemplate);

    return {
      discover: formatCountBadge(templates.length),
      'latest-post': formatCountBadge(designPosts.length),
      'mobile-templates': formatCountBadge(mobileTemplates.length || templates.length),
      'web-templates': formatCountBadge(webTemplates.length || templates.length),
    };
  }

  const followItems = [
    {
      key: 'instagram',
      href: 'https://www.instagram.com/siren.uix/',
      icon: 'ASSET/Icons/nav-instagram.svg',
      label: 'Instagram',
      external: true,
    },
    {
      key: 'twitter',
      href: 'https://twitter.com/Siren_UIX',
      icon: 'ASSET/Icons/nav-twitter.svg',
      label: 'Twitter',
      external: true,
    },
  ];

  const starredItems = [
    {
      key: 'about',
      href: '/about-me',
      icon: 'ASSET/Icons/nav-about-me.svg',
      label: 'About Me',
    },
  ];

  function formatRelativeTime(timestamp) {
    const diffMs = Date.now() - timestamp;
    if (diffMs < 60000) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  }

  // ── Notification system ─────────────────────────────────────────────────
  // Derived live from the products collection — no static seed data, no
  // separate "notification records".  Products updated within the last 30 days
  // are treated as notifications; per-user read state is stored in Firestore
  // at notificationReads/{uid}/items/{slug} so every account (Google-authed
  // or anonymous guest) maintains its own independent unread markers.

  const NOTIFICATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const NOTIFICATION_MAX = 50;

  // In-memory cache: { uid: string | null, readState: { [slug]: updatedAtSeen } }
  // Primed on init and updated after each markRead call.
  let _notifCache = { uid: null, readState: {}, lastToggleOpenedTime: 0 };

  function getLocalReadStateKey(uid) {
    return uid ? `motvin_notif_read_state_${uid}` : 'motvin_notif_read_state_guest';
  }

  function getLocalToggleOpenedKey(uid) {
    return uid ? `motvin_notif_toggle_opened_${uid}` : 'motvin_notif_toggle_opened_guest';
  }

  function getLocalReadState(uid) {
    try {
      const key = getLocalReadStateKey(uid);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  function saveLocalReadState(uid, readState) {
    try {
      const key = getLocalReadStateKey(uid);
      localStorage.setItem(key, JSON.stringify(readState || {}));
    } catch {}
  }

  function getLocalToggleOpenedTime(uid) {
    try {
      const key = getLocalToggleOpenedKey(uid);
      const val = localStorage.getItem(key);
      return val ? Number(val) : 0;
    } catch {
      return 0;
    }
  }

  function saveLocalToggleOpenedTime(uid, ts) {
    try {
      const key = getLocalToggleOpenedKey(uid);
      localStorage.setItem(key, String(ts || 0));
    } catch {}
  }

  // Helper: build a Firestore REST URL for the notificationReads subcollection.
  function _notifRestBase(uid) {
    const config = window.FIREBASE_CONFIG || {};
    if (!config.projectId || !uid) return null;
    const project = encodeURIComponent(config.projectId);
    const uidEnc = encodeURIComponent(uid);
    return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/notificationReads/${uidEnc}/items`;
  }

  // Fetch per-user read state from Firestore.
  // Returns { [slug]: updatedAtSeen } map (empty on error).
  async function fetchNotificationReadState(uid) {
    if (!uid) return getLocalReadState(uid);
    const base = _notifRestBase(uid);
    if (!base) return getLocalReadState(uid);

    const config = window.FIREBASE_CONFIG || {};
    const authService = window.FirebaseAuthService;
    const token = authService && typeof authService.getIdToken === 'function'
      ? await authService.getIdToken()
      : null;

    if (!token) {
      return getLocalReadState(uid);
    }

    try {
      const url = config.apiKey ? `${base}?key=${encodeURIComponent(config.apiKey)}` : base;
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(url, { headers });
      if (!res.ok) {
        return getLocalReadState(uid);
      }
      const json = await res.json();
      const docs = Array.isArray(json.documents) ? json.documents : [];
      const result = getLocalReadState(uid);
      docs.forEach((doc) => {
        if (!doc || !doc.name) return;
        const slug = decodeURIComponent(doc.name.split('/').pop());
        const updatedAtSeen = doc.fields && doc.fields.updatedAtSeen
          ? (doc.fields.updatedAtSeen.stringValue || 'read')
          : 'read';
        if (slug) result[slug] = updatedAtSeen;
      });
      saveLocalReadState(uid, result);
      return result;
    } catch {
      return getLocalReadState(uid);
    }
  }

  // Write a single read-state entry to Firestore and LocalStorage.
  async function markNotificationRead(uid, slug, updatedAt) {
    if (!slug) return;
    const val = String(updatedAt || 'read');

    // Instantly save to local cache for 0ms delay across page reloads
    _notifCache.readState = _notifCache.readState || {};
    _notifCache.readState[slug] = val;
    saveLocalReadState(uid, _notifCache.readState);

    if (!uid) return;
    const base = _notifRestBase(uid);
    if (!base) return;

    const config = window.FIREBASE_CONFIG || {};
    const authService = window.FirebaseAuthService;
    const token = authService && typeof authService.getIdToken === 'function'
      ? await authService.getIdToken()
      : null;
    if (!token) return;

    try {
      const slugEnc = encodeURIComponent(slug);
      const url = `${base}/${slugEnc}?updateMask.fieldPaths=updatedAtSeen${config.apiKey ? `&key=${encodeURIComponent(config.apiKey)}` : ''}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: { updatedAtSeen: { stringValue: val } },
        }),
        keepalive: true, // keeps HTTP request alive across page navigation unloads
      });
    } catch (err) {
      console.error('[Notification Debug] Error patching read state:', err);
    }
  }

  // Filter products to the notification window and only allowed types.
  function getRecentProducts() {
    const products = getProducts();
    const cutoff = Date.now() - NOTIFICATION_WINDOW_MS;
    return products
      .filter((p) => {
        if (!p || !p.slug) return false;
        const type = String(p.productType || '').toLowerCase();
        if (type !== 'template' && type !== 'design-post') return false;
        const ts = p._updatedTimestamp || (p.updatedAt ? Date.parse(p.updatedAt) : 0);
        return Number.isFinite(ts) && ts >= cutoff;
      })
      .slice(0, NOTIFICATION_MAX);
  }

  // Format a date string for display in the meta line.
  function formatUpdatedDate(updatedAt) {
    const ts = Date.parse(updatedAt);
    if (!Number.isFinite(ts)) return '';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Determine if a product counts as unread for the current read-state cache.
  function isProductUnread(product, readState) {
    const slug = product && product.slug;
    if (!slug) return false;
    if (!readState || typeof readState !== 'object') return true;
    if (!(slug in readState)) return true; // never marked read
    const seen = String(readState[slug]);
    const updatedAt = product.updatedAt || (product._updatedTimestamp ? new Date(product._updatedTimestamp).toISOString() : 'read');
    const current = String(updatedAt);
    return current !== seen; // re-edited/updated since last mark-read
  }

  // Helper to group products by relative time window
  function groupProductsByTime(products) {
    const groups = {
      'Today': [],
      'Yesterday': [],
      'Last 7 days': [],
      'Older': []
    };

    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    (products || []).forEach((product) => {
      const ts = product._updatedTimestamp || (product.updatedAt ? Date.parse(product.updatedAt) : 0) || now;
      const diff = Math.max(0, now - ts);

      if (diff <= ONE_DAY) {
        groups['Today'].push(product);
      } else if (diff <= 2 * ONE_DAY) {
        groups['Yesterday'].push(product);
      } else if (diff <= 7 * ONE_DAY) {
        groups['Last 7 days'].push(product);
      } else {
        groups['Older'].push(product);
      }
    });

    return groups;
  }

  // Render a single notification item button
  function buildNotificationEntryHtml(product, readState) {
    const slug = product.slug || '';
    const type = product.productType || 'template';
    const unread = isProductUnread(product, readState);
    const unreadClass = unread ? ' is-unread' : '';
    const updatedAt = product.updatedAt || (product._updatedTimestamp ? new Date(product._updatedTimestamp).toISOString() : '');
    const timeLabel = formatRelativeTime(product._updatedTimestamp || (updatedAt ? Date.parse(updatedAt) : 0) || Date.now());
    const imageSrc = product.image || 'ASSET/Icons/nav-my-latest-post.svg';
    const categoryLabel = product.category || (type === 'design-post' ? 'Design Post' : 'Mobile Templates');

    return `
      <button type="button" class="sidebar-notification-entry sidebar-notification-item${unreadClass}" data-slug="${slug}" data-type="${type}" data-updated-at="${updatedAt}" aria-label="${product.title || 'Notification'}">
        <span class="sidebar-notification-thumb">
          <img src="${imageSrc}" alt="" />
        </span>
        <span class="sidebar-notification-entry-info">
          <span class="sidebar-notification-entry-row">
            <span class="sidebar-notification-entry-title">${product.title || 'Untitled'}</span>
            <span class="sidebar-notification-time-wrap">
              <span class="sidebar-notification-time">${timeLabel}</span>
              ${unread ? '<span class="sidebar-notification-unread-dot"></span>' : ''}
            </span>
          </span>
          <span class="sidebar-notification-entry-row">
            <span class="sidebar-notification-entry-meta">${categoryLabel}</span>
          </span>
        </span>
      </button>`;
  }

  // Build notification row HTML for a list of products (with time-based grouping)
  function buildNotificationRows(products, readState, activeFilter = 'all') {
    let filtered = products || [];
    if (activeFilter === 'unread') {
      filtered = filtered.filter((p) => isProductUnread(p, readState));
    }

    if (!filtered.length) {
      return '<div class="notification-empty" style="padding: 24px 16px; text-align: center; color: rgba(255,255,255,0.4); font-size: 11px; font-family: Inter, sans-serif;">No notifications yet</div>';
    }

    const grouped = groupProductsByTime(filtered);
    const groupKeys = ['Today', 'Yesterday', 'Last 7 days', 'Older'];
    let html = '';

    groupKeys.forEach((key) => {
      const items = grouped[key];
      if (items && items.length > 0) {
        const rows = items.map((p) => buildNotificationEntryHtml(p, readState)).join('');
        html += `
          <div class="sidebar-notification-group">
            <div class="sidebar-notification-group-title">${key}</div>
            <div class="sidebar-notification-group-items">${rows}</div>
          </div>`;
      }
    });

    return html || '<div class="notification-empty" style="padding: 24px 16px; text-align: center; color: rgba(255,255,255,0.4); font-size: 11px; font-family: Inter, sans-serif;">No notifications yet</div>';
  }

  // Update all bell icon images based on in-memory cache and last toggle opened time.
  function updateBellIconsState() {
    const products = getRecentProducts();
    const lastOpened = _notifCache.lastToggleOpenedTime || getLocalToggleOpenedTime(_notifCache.uid);

    // Bell is active only if there is an unread item with updated timestamp newer than lastOpened
    const hasNewUnread = products.some((p) => {
      if (!isProductUnread(p, _notifCache.readState)) return false;
      const ts = p._updatedTimestamp || (p.updatedAt ? Date.parse(p.updatedAt) : 0) || 0;
      return ts > lastOpened;
    });

    const src = hasNewUnread
      ? 'ASSET/Icons/nav-notification-icon-active.svg'
      : 'ASSET/Icons/nav-notification-icon.svg';

    document.querySelectorAll('.sidebar-notification-toggle img').forEach((img) => {
      img.src = src;
    });

    document.dispatchEvent(new CustomEvent('motvin:notifications-updated', { detail: { hasUnread: hasNewUnread } }));
  }

  // Prime the read-state cache once on init (async, non-blocking).
  async function primeNotificationReadState() {
    const authService = window.FirebaseAuthService;
    let user = authService && typeof authService.getCurrentUser === 'function' ? authService.getCurrentUser() : null;
    if (!user && authService && typeof authService.ensureGuestSession === 'function') {
      try { user = await authService.ensureGuestSession(); } catch {}
    }
    const uid = user && user.uid ? user.uid : null;

    _notifCache.uid = uid;
    _notifCache.lastToggleOpenedTime = getLocalToggleOpenedTime(uid);
    const localState = getLocalReadState(uid);
    _notifCache.readState = { ...localState, ..._notifCache.readState };
    updateBellIconsState();

    if (uid) {
      const remoteState = await fetchNotificationReadState(uid);
      _notifCache.readState = { ...localState, ...remoteState, ..._notifCache.readState };
      saveLocalReadState(uid, _notifCache.readState);
      updateBellIconsState();
    }
  }

  function renderBadge(item) {
    if (item.badgeType === 'skeleton') {
      return '<span class="nav-badge nav-badge--skeleton" aria-hidden="true"></span>';
    }

    if (!item.badge) return '';

    if (item.badgeType === 'new') {
      return '<span class="nav-badge nav-badge--new">Beta</span>';
    }

    return `<span class="nav-badge">${item.badge}</span>`;
  }

  function renderRedirectIcon() {
    return `
      <span class="nav-redirect-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#sidebar-redirect-icon-clip)">
            <path d="M6.66782 2C4.70358 2.02139 3.60733 2.14619 2.87894 2.87459C1.99994 3.75358 1.99994 5.16832 1.99994 7.99773C1.99994 10.8273 1.99994 12.242 2.87894 13.121C3.75794 14 5.17268 14 8.00215 14C10.8316 14 12.2464 14 13.1254 13.121C13.8539 12.3925 13.9786 11.2959 14 9.33087M9.33335 2H12C12.9428 2 13.4142 2 13.7072 2.29289C14 2.58579 14 3.05719 14 4V6.66667M13.3334 2.66667L7.33335 8.66667" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
          <defs>
            <clipPath id="sidebar-redirect-icon-clip">
              <rect width="16" height="16" fill="white"/>
            </clipPath>
          </defs>
        </svg>
      </span>`;
  }

  function renderNotificationIcon() {
    // Use in-memory cache for initial icon state; primeNotificationReadState()
    // refreshes this asynchronously after init.
    const products = getRecentProducts();
    const hasUnread = products.some((p) => isProductUnread(p, _notifCache.readState));
    const src = hasUnread
      ? 'ASSET/Icons/nav-notification-icon-active.svg'
      : 'ASSET/Icons/nav-notification-icon.svg';
    return `
      <img src="${src}" alt="" aria-hidden="true" />`;
  }

  function renderNavIcon(item) {
    if (item && item.key === 'motvin') {
      return `
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <path d="M12.5 0H3.5C1.567 0 0 1.567 0 3.5V12.5C0 14.433 1.567 16 3.5 16H12.5C14.433 16 16 14.433 16 12.5V3.5C16 1.567 14.433 0 12.5 0Z" fill="#5C4AE4"/>
          <path d="M6.09523 5.85712L5.64284 4.88092L4.66667 4.42856L5.64284 3.97617L6.09523 3L6.54763 3.97617L7.5238 4.42856L6.54763 4.88092L6.09523 5.85712ZM11.5714 11.3333L11.119 10.3571L10.1428 9.90473L11.119 9.45237L11.5714 8.47617L12.0238 9.45237L13 9.90473L12.0238 10.3571L11.5714 11.3333ZM4.47618 12.8571L3.14287 11.5238C3.04762 11.4286 3 11.3135 3 11.1785C3 11.0436 3.04762 10.9286 3.14287 10.8333L8.45238 5.5238C8.54762 5.42856 8.66269 5.38094 8.79761 5.38094C8.93254 5.38094 9.04763 5.42856 9.14285 5.5238L10.4762 6.85712C10.5714 6.95237 10.6191 7.06743 10.6191 7.20236C10.6191 7.33728 10.5714 7.45238 10.4762 7.54759L5.16665 12.8571C5.07144 12.9524 4.95634 13 4.82142 13C4.6865 13 4.57143 12.9524 4.47618 12.8571ZM4.83333 11.8571L8.23809 8.42855L7.57142 7.76191L4.14286 11.1667L4.83333 11.8571Z" fill="white"/>
          <path opacity="0.95" d="M10.8117 5.4321L11.1734 6.21257L11.5351 5.4321L12.3156 5.0704L11.5351 4.7087L11.1734 3.92822L10.8117 4.7087L10.0312 5.0704L10.8117 5.4321Z" fill="white"/>
          <path opacity="0.34" d="M12.2458 7.46239L12.3724 7.73556L12.499 7.46239L12.7722 7.33581L12.499 7.20921L12.3724 6.93604L12.2458 7.20921L11.9727 7.33581L12.2458 7.46239Z" fill="white"/>
        </svg>`;
    }

    return `<img class="nav-icon" src="${item.icon}" alt="" />`;
  }

  function renderNotificationPopover() {
    const products = getRecentProducts();
    const unreadCount = products.filter((p) => isProductUnread(p, _notifCache.readState)).length;
    const rows = buildNotificationRows(products, _notifCache.readState, 'all');

    return `
      <div class="sidebar-notification-popover" hidden>
        <div class="sidebar-notification-panel" data-node-id="112:30372" data-name="sidebar-notification-panel">
          <div class="sidebar-notification-header">
            <p class="sidebar-notification-header-title">Notifications</p>
          </div>
          <div class="sidebar-notification-filter-bar">
            <div class="sidebar-notification-filter-tabs">
              <button type="button" class="sidebar-notification-filter-tab is-active" data-filter="all">All</button>
              <button type="button" class="sidebar-notification-filter-tab" data-filter="unread">Unread (${unreadCount})</button>
            </div>
            <button type="button" class="sidebar-notification-mark-all-read">Mark all as read</button>
          </div>
          <div class="sidebar-notification-list-body sidebar-notification-list">
            ${rows}
          </div>
        </div>
      </div>`;
  }

  function renderProfileMenu() {
    return `
      <div class="sidebar-profile-menu" hidden>
        <div class="sidebar-profile-menu-header">
          <span class="sidebar-profile-menu-avatar">
            <img src="ASSET/Icons/sidebar-avatar-placeholder.svg" alt="Guest" />
          </span>
          <div class="sidebar-profile-menu-user">
            <p class="sidebar-profile-menu-name">Siren.uix</p>
            <p class="sidebar-profile-menu-email">surendarv638@gmail.com</p>
          </div>
        </div>

        <div class="sidebar-profile-menu-divider-wrap"><span class="sidebar-profile-menu-divider"></span></div>

        <div class="sidebar-profile-menu-list" role="menu" aria-label="Profile menu">
          <a href="/updates/" class="sidebar-profile-menu-item" role="menuitem">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true">
                  <img src="ASSET/Icons/nav-updates-icon.svg" alt="" />
                </span>
                <span>Release Updates</span>
              </span>
            </span>
          </a>

          <a href="/saved-templates" class="sidebar-profile-menu-item" role="menuitem">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true">
                  <img src="ASSET/Icons/profile-menu-saved-templates.svg" alt="" />
                </span>
                <span>Saved Templates</span>
              </span>
              <span class="sidebar-profile-menu-tag" aria-hidden="true" data-saved-count-badge="true">0</span>
            </span>
          </a>
        </div>

        <div class="sidebar-profile-menu-divider-wrap"><span class="sidebar-profile-menu-divider"></span></div>

        <div class="sidebar-profile-menu-list" role="menu" aria-label="Preferences">
          <div class="sidebar-profile-menu-item sidebar-theme-trigger" role="menuitem" aria-haspopup="true" aria-expanded="false" data-theme-trigger="true">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true">
                  <img src="ASSET/Icons/profile-menu-change-theme.svg" alt="" />
                </span>
                <span>Change Theme</span>
              </span>
              <span class="sidebar-theme-trigger-chevron" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 2L7 5L4 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </span>
            <div class="sidebar-theme-submenu" hidden role="menu" aria-label="Select theme">
              <button class="sidebar-theme-option" type="button" role="menuitem" data-theme-option="light">
                <span class="sidebar-theme-option-label">Light</span>
                <span class="sidebar-theme-option-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </button>
              <button class="sidebar-theme-option" type="button" role="menuitem" data-theme-option="dark">
                <span class="sidebar-theme-option-label">Dark</span>
                <span class="sidebar-theme-option-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </button>
              <button class="sidebar-theme-option" type="button" role="menuitem" data-theme-option="system">
                <span class="sidebar-theme-option-label">System</span>
                <span class="sidebar-theme-option-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>

          <div class="sidebar-profile-menu-item sidebar-theme-trigger sidebar-settings-trigger" role="menuitem" aria-haspopup="true" aria-expanded="false" data-settings-trigger="true">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true">
                  <img src="ASSET/Icons/profile-menu-settings.svg" alt="" />
                </span>
                <span>Settings</span>
              </span>
              <span class="sidebar-theme-trigger-chevron" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 2L7 5L4 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </span>
            <div class="sidebar-theme-submenu sidebar-settings-submenu" hidden role="menu" aria-label="Select layout">
              <button class="sidebar-theme-option" type="button" role="menuitem" data-layout-option="classic">
                <span class="sidebar-theme-option-label">Classic</span>
                <span class="sidebar-theme-option-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </button>
              <button class="sidebar-theme-option" type="button" role="menuitem" data-layout-option="float">
                <span class="sidebar-theme-option-label">Float</span>
                <span class="sidebar-theme-option-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>

          <a href="/ADMIN-PAGE/admin.html" class="sidebar-profile-menu-item" role="menuitem" data-admin-page-link="true" hidden>
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_2160_17979)">
<path d="M5.14728 9.71357H4.51782C3.85005 9.71357 3.20964 9.98446 2.73745 10.4667C2.26527 10.9488 2 11.6028 2 12.2848V13.5704M10.215 8.18114C10.2566 8.05087 10.3379 7.93758 10.447 7.85779C10.556 7.77801 10.6872 7.7359 10.8214 7.73763C10.9556 7.73935 11.0857 7.78481 11.1928 7.86737C11.2998 7.94993 11.3783 8.06527 11.4167 8.19657L11.8806 9.12991C11.9257 9.22064 11.9913 9.29913 12.072 9.35892C12.1526 9.4187 12.246 9.45808 12.3445 9.47381L13.373 9.63836C13.5054 9.63889 13.6344 9.68207 13.7414 9.76175C13.8484 9.84142 13.9281 9.95355 13.9691 10.0822C14.0101 10.2108 14.0103 10.3493 13.9697 10.478C13.9292 10.6068 13.8499 10.7192 13.7431 10.7993L13.0054 11.55C12.9348 11.6219 12.8818 11.7098 12.851 11.8065C12.8201 11.9033 12.8122 12.0062 12.8279 12.1067L12.9909 13.1435C13.0358 13.2735 13.0385 13.4147 12.9988 13.5464C12.9591 13.6781 12.879 13.7933 12.7703 13.8749C12.6617 13.9566 12.5302 14.0004 12.3952 14C12.2603 13.9996 12.1291 13.9548 12.0209 13.8725L11.0988 13.3904C11.0099 13.3439 10.9116 13.3196 10.8117 13.3196C10.7119 13.3196 10.6135 13.3439 10.5247 13.3904L9.60256 13.8725C9.49441 13.9542 9.36347 13.9983 9.22895 13.9985C9.09443 13.9986 8.96339 13.9548 8.85506 13.8733C8.74672 13.7919 8.66679 13.6771 8.62698 13.5459C8.58717 13.4147 8.58957 13.2739 8.63383 13.1442L8.79623 12.1073C8.81191 12.0068 8.804 11.904 8.77314 11.8072C8.74228 11.7104 8.68936 11.6225 8.61873 11.5507L7.89108 10.8095C7.7807 10.7315 7.69768 10.6194 7.65412 10.4897C7.61057 10.36 7.60877 10.2194 7.64898 10.0886C7.6892 9.9578 7.76933 9.84354 7.87766 9.76253C7.98599 9.68153 8.11685 9.63802 8.25112 9.63836L9.27902 9.47381C9.37749 9.45808 9.47089 9.4187 9.55154 9.35892C9.63219 9.29913 9.69779 9.22064 9.74293 9.12991L10.215 8.18114ZM8.92401 4.57119C8.92401 5.99122 7.79674 7.14238 6.40619 7.14238C5.01563 7.14238 3.88837 5.99122 3.88837 4.57119C3.88837 3.15116 5.01563 2 6.40619 2C7.79674 2 8.92401 3.15116 8.92401 4.57119Z" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_2160_17979">
<rect width="16" height="16" fill="white"/>
</clipPath>
</defs>
</svg>
                </span>
                <span>Admin Page</span>
              </span>
            </span>
          </a>

        </div>

        <div class="sidebar-profile-menu-divider-wrap"><span class="sidebar-profile-menu-divider"></span></div>

        <div class="sidebar-profile-menu-list" role="menu" aria-label="Account actions">
          <button type="button" class="sidebar-profile-menu-item" role="menuitem" data-auth-toggle="true" data-auth-action="login">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true">
                  <img src="ASSET/Icons/profile-menu-login.svg" alt="" />
                </span>
                <span class="sidebar-profile-menu-auth-label">Log in</span>
              </span>
              <span class="sidebar-profile-menu-tag" aria-hidden="true">32</span>
            </span>
          </button>
        </div>
      </div>`;
  }

  function setAvatarState(avatarEl, user) {
    if (!avatarEl) return;

    avatarEl.classList.remove(
      'sidebar-avatar--not-login',
      'sidebar-avatar--not-login-hover',
      'sidebar-avatar--without-profile',
      'sidebar-avatar--with-profile'
    );

    const initialNode = avatarEl.querySelector('.sidebar-avatar-initial');
    const photoNode = avatarEl.querySelector('.sidebar-avatar-photo');
    const name = String((user && user.displayName) || '').trim();
    const initial = (name || 'S').charAt(0).toUpperCase();

    if (initialNode) initialNode.textContent = initial;

    if (!user) {
      avatarEl.classList.add('sidebar-avatar--not-login');
      if (photoNode) photoNode.src = 'ASSET/Images/avatar.png';
      return;
    }

    const photoURL = String(user.photoURL || '').trim();
    if (photoURL) {
      avatarEl.classList.add('sidebar-avatar--with-profile');
      if (photoNode) photoNode.src = photoURL;
      return;
    }

    avatarEl.classList.add('sidebar-avatar--without-profile');
    if (photoNode) photoNode.src = 'ASSET/Images/avatar.png';
  }

  function applyAuthStateToSidebarProfile(profile, user) {
    if (!profile || !profile.closest('.sidebar')) return;

    // Guest sessions (Firebase Anonymous Auth, established via
    // authService.ensureGuestSession() so per-account notification
    // read-state works for everyone) are a real, truthy Firebase user
    // object under the hood — but should still render as "Guest" here,
    // exactly like today's signed-out state.
    const realUser = user && !user.isAnonymous ? user : null;

    const name = realUser
      ? (String(realUser.displayName || '').trim() || 'Guest')
      : 'Guest';
    const email = realUser
      ? (String(realUser.email || '').trim() || '-')
      : '-';
    const photoURL = realUser
      ? (String(realUser.photoURL || '').trim() || 'ASSET/Images/avatar.png')
      : 'ASSET/Icons/sidebar-avatar-placeholder.svg';

    const profileName = profile.querySelector('.sidebar-profile-main .sidebar-profile-name');
    if (profileName) profileName.textContent = name;

    // The menu may currently be portaled to <body> (open profile menus move
    // out of `.sidebar-profile` to escape its stacking context), so fall
    // back to the toggle's stored reference instead of only querying `profile`.
    const leftToggleEl = profile.querySelector('.sidebar-profile-left');
    const menuEl = profile.querySelector('.sidebar-profile-menu')
      || (leftToggleEl && leftToggleEl.__sidebarProfileMenu)
      || null;

    const menuName = menuEl && menuEl.querySelector('.sidebar-profile-menu-name');
    if (menuName) menuName.textContent = name;

    const menuEmail = menuEl && menuEl.querySelector('.sidebar-profile-menu-email');
    if (menuEmail) menuEmail.textContent = email;

    const menuAvatarImage = menuEl && menuEl.querySelector('.sidebar-profile-menu-avatar img');
    if (menuAvatarImage) {
      menuAvatarImage.src = photoURL;
      menuAvatarImage.alt = name;
    }

    const avatar = profile.querySelector('.sidebar-profile-main .sidebar-avatar');
    setAvatarState(avatar, realUser);

    const authToggleItem = menuEl && menuEl.querySelector('[data-auth-toggle="true"]');
    const authLabel = menuEl && menuEl.querySelector('.sidebar-profile-menu-auth-label');
    const authIcon = authToggleItem ? authToggleItem.querySelector('.sidebar-profile-menu-icon img') : null;

    if (authToggleItem) {
      authToggleItem.setAttribute('data-auth-action', realUser ? 'logout' : 'login');
    }

    if (authLabel) {
      authLabel.textContent = realUser ? 'Log out' : 'Log in';
    }

    if (authIcon) {
      authIcon.src = realUser ? 'ASSET/Icons/profile-menu-logout.svg' : 'ASSET/Icons/profile-menu-login.svg';
    }
  }

  function syncSidebarAuthState(scope, user) {
    const root = scope || document;
    root.querySelectorAll('.layout > .sidebar .sidebar-profile').forEach((profile) => {
      applyAuthStateToSidebarProfile(profile, user);
    });
  }

  const SITE_SUPER_ADMIN_EMAIL = 'surendarv638@gmail.com';

  function setAdminPageLinkVisible(visible) {
    document.querySelectorAll('[data-admin-page-link="true"]').forEach((link) => {
      link.hidden = !visible;
    });
  }

  // One lightweight Firestore REST GET (no SDK needed site-wide) to check
  // whether the signed-in, non-owner user has been explicitly granted admin
  // access via the siteAdmins collection (see Firebase/firestore.rules.active.txt).
  async function isGrantedSiteAdmin(email) {
    const config = window.FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return false;

    const authService = window.FirebaseAuthService;
    const token = authService && typeof authService.getIdToken === 'function'
      ? await authService.getIdToken()
      : null;
    if (!token) return false;

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/siteAdmins/${encodeURIComponent(email)}?key=${encodeURIComponent(config.apiKey)}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return false;
      const doc = await response.json();
      const fields = doc.fields || {};
      return Boolean(fields.active && fields.active.booleanValue === true);
    } catch {
      return false;
    }
  }

  async function updateAdminPageLinkVisibility(user) {
    if (!user || !user.email) {
      setAdminPageLinkVisible(false);
      return;
    }

    const email = String(user.email).trim().toLowerCase();
    if (email === SITE_SUPER_ADMIN_EMAIL) {
      setAdminPageLinkVisible(true);
      return;
    }

    setAdminPageLinkVisible(await isGrantedSiteAdmin(email));
  }

  function positionNotificationPopover(toggle, popover) {
    if (!toggle || !popover || popover.hidden) return;

    const rect = toggle.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth || 320;
    const viewportPadding = 8;

    // Open below the toggle button, aligned to its left edge.
    let left = Math.round(rect.left);
    const maxLeft = window.innerWidth - popoverWidth - viewportPadding;
    if (left > maxLeft) left = Math.max(viewportPadding, maxLeft);

    popover.style.left = `${left}px`;
    popover.style.top = `${Math.round(rect.bottom + 8)}px`;
  }

  function repositionOpenNotificationPopovers(scope) {
    notifPopoverRegistry.forEach((popover) => {
      const toggle = popover.__sidebarNotifToggle;
      if (!toggle || popover.hidden) return;

      positionNotificationPopover(toggle, popover);
    });

    const root = scope || document;
    root.querySelectorAll('.sidebar-profile').forEach((profile) => {
      const toggle = profile.querySelector('.sidebar-notification-toggle');
      const popover = profile.querySelector('.sidebar-notification-popover');
      if (!toggle || !popover || popover.hidden) return;

      positionNotificationPopover(toggle, popover);
    });
  }

  function positionProfileMenu(anchor, menu) {
    if (!anchor || !menu || menu.hidden) return;

    const rect = anchor.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 260;
    const viewportPadding = 8;

    let left = Math.round(rect.left);
    const maxLeft = window.innerWidth - menuWidth - viewportPadding;
    if (left > maxLeft) {
      left = Math.max(viewportPadding, maxLeft);
    }

    menu.style.left = `${Math.max(viewportPadding, left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
  }

  function repositionOpenProfileMenus() {
    profileMenuRegistry.forEach((menu) => {
      const anchor = menu.__sidebarProfileToggle;
      if (!anchor || menu.hidden) return;

      positionProfileMenu(anchor, menu);
    });
  }

  function createNavTab(options) {
    const item = options || {};
    const state = item.state || 'default';
    const isActive = state === 'active' || !!item.isActive;
    const externalAttrs = (item.external || item.openInNewTab) ? ' target="_blank" rel="noopener"' : '';
    const currentAttr = isActive ? ' aria-current="page"' : '';
    const label = item.variant === 'tablet' && item.tabletLabel ? item.tabletLabel : item.label;
    const stateClass = ` nav-tab--state-${state}`;
    const externalClass = item.external ? ' nav-tab--external' : '';
    const navKeyAttr = item.key ? ` data-nav-key="${item.key}"` : '';
    const shellNavAttr = item.shellNavOff ? ' data-shell-nav="off"' : '';
    const trailingContent = item.badge || item.badgeType === 'new' || item.badgeType === 'skeleton' || item.external
      ? `
        <span class="nav-tab-slot">
          ${renderBadge(item)}
          ${item.external ? renderRedirectIcon() : ''}
        </span>`
      : '<span class="nav-tab-slot nav-tab-slot--empty" aria-hidden="true"></span>';

    return `
      <a href="${item.href}" class="nav-tab${stateClass}${externalClass}${isActive ? ' active' : ''}"${externalAttrs}${currentAttr}${navKeyAttr}${shellNavAttr}>
        <div class="nav-tab-left">
          ${renderNavIcon(item)}
          <div class="nav-label-wrap">
            <span class="nav-label">${label}</span>
            ${item.trailingChevron ? '<img class="nav-chevron-icon" src="ASSET/Icons/chevron-dropdown.svg" alt="" />' : ''}
          </div>
        </div>
        ${trailingContent}
      </a>`;
  }

  function renderNavItem(item, activeKey, variant) {
    const liveBadges = getLiveBadges();
    const liveBadge = item.liveBadge ? liveBadges[item.liveBadge] : '';
    const isLiveBadgeLoading = !!(item.liveBadge && window.__sidebarLiveBadgeLoading);

    return createNavTab({
      ...item,
      badge: isLiveBadgeLoading ? '' : (liveBadge || item.badge),
      badgeType: isLiveBadgeLoading ? 'skeleton' : item.badgeType,
      variant,
      state: item.key === activeKey ? 'active' : 'default',
      isActive: item.key === activeKey,
    });
  }

  function renderGroup(items, activeKey, extraClass, variant) {
    return `<div class="sidebar-section sidebar-section-items${extraClass ? ` ${extraClass}` : ''}">${items.map((item) => renderNavItem(item, activeKey, variant)).join('')}</div>`;
  }

  function getLayoutMode() {
    try {
      return window.localStorage.getItem('siteLayoutMode') || 'classic';
    } catch {
      return 'classic';
    }
  }

  function renderSidebar(options) {
    const opts = options || {};
    const activeKey = opts.activeKey || 'discover';
    const variantClass = opts.variant === 'tablet' ? ' sidebar--tablet' : '';
    const responsiveClass = opts.variant ? '' : ' sidebar--responsive';
    const variant = opts.variant || 'desktop';


    return `
      <aside class="sidebar${responsiveClass}${variantClass}">
        <div class="sidebar-profile">
          <div class="sidebar-profile-left" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false">
            <span class="sidebar-profile-main">
              <span class="sidebar-avatar sidebar-avatar--not-login" aria-hidden="true">
                <span class="sidebar-avatar-core">
                  <span class="sidebar-avatar-icon">
                    <img src="ASSET/Icons/sidebar-avatar-placeholder.svg" alt="" />
                  </span>
                  <span class="sidebar-avatar-initial">S</span>
                  <img class="sidebar-avatar-photo" src="ASSET/Images/avatar.png" alt="" />
                </span>
              </span>
              <span class="sidebar-profile-name">Siren.uix</span>
            </span>
            <span class="sidebar-profile-chevron" aria-hidden="true">
              <img src="ASSET/Icons/chevron-dropdown.svg" alt="" />
            </span>
          </div>
          ${renderProfileMenu()}
          <div class="sidebar-profile-right">
            <button class="sidebar-notification-toggle" type="button" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false">
              ${renderNotificationIcon()}
            </button>
            ${renderNotificationPopover()}
          </div>
        </div>

        <div class="sidebar-search-wrap">
          <div class="sidebar-search-bar" role="search">
            <img src="ASSET/Icons/search-icon.svg" alt="" aria-hidden="true" />
            <input
              class="sidebar-search-input"
              type="search"
              placeholder="Search"
              aria-label="Search"
            />
          </div>
        </div>

        <section class="sidebar-section">
          ${renderGroup(topItems, activeKey, '', variant)}
        </section>

        <section class="sidebar-section">
          ${renderGroup(primaryItems, activeKey, 'sidebar-primary-items', variant)}
        </section>

        <section class="sidebar-section">
          <div class="sidebar-section-title"><span>Work Sections</span></div>
          ${renderGroup(workItems, activeKey, '', variant)}
        </section>

        <section class="sidebar-section">
          <div class="sidebar-section-title"><span>Follow Me</span></div>
          ${renderGroup(followItems, activeKey, 'sidebar-section-items--borderless', variant)}
          <div class="sidebar-whatsapp-block">
            <div class="sidebar-whatsapp-card">
              <img src="ASSET/Icons/whatsapp-icon.svg" alt="WhatsApp" />
              <p>A Join India's largest WhatsApp community for designers.</p>
              <a class="btn-join" href="https://chat.whatsapp.com/JxLUrQpNpaXJ4ido6muIW6" target="_blank" rel="noopener">
                <img src="ASSET/Icons/join-now-icon.svg" alt="" />
                <span>Join Now</span>
              </a>
            </div>
          </div>
        </section>

        <section class="sidebar-section sidebar-starred-section is-expanded">
          <button class="sidebar-starred-toggle" type="button" aria-expanded="true">
            <img class="sidebar-starred-chevron" src="ASSET/Icons/chevron-dropdown.svg" alt="" />
            <span>Starred</span>
          </button>
          <div class="sidebar-starred-panel">
            ${renderGroup(starredItems, activeKey, 'sidebar-section-items--borderless', variant)}
          </div>
        </section>
      </aside>`;
  }

  function bindSidebarInteractions(scope) {
    const root = scope || document;
    root.querySelectorAll('.sidebar-starred-section').forEach((section) => {
      const toggle = section.querySelector('.sidebar-starred-toggle');
      if (!toggle || toggle.dataset.bound === 'true') return;

      toggle.dataset.bound = 'true';
      toggle.addEventListener('click', () => {
        const expanded = section.classList.toggle('is-expanded');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
    });

    root.querySelectorAll('.sidebar-profile').forEach((profile) => {
      const leftToggle = profile.querySelector('.sidebar-profile-left');
      const profileMenu = profile.querySelector('.sidebar-profile-menu');

      if (leftToggle && profileMenu && leftToggle.dataset.profileMenuBound !== 'true') {
        profileMenu.__sidebarProfileToggle = leftToggle;
        profileMenu.__sidebarProfileHost = profile;
        profileMenu.__sidebarProfileHomeParent = profile;
        profileMenu.__sidebarProfileHomeNext = profileMenu.nextSibling;
        leftToggle.__sidebarProfileMenu = profileMenu;
        profileMenuRegistry.add(profileMenu);

        const closeProfileMenu = () => {
          profileMenu.hidden = true;
          profileMenu.querySelectorAll('.sidebar-theme-submenu').forEach((submenu) => {
            submenu.hidden = true;
          });
          profileMenu.querySelectorAll('[data-theme-trigger="true"], [data-settings-trigger="true"]').forEach((trigger) => {
            trigger.setAttribute('aria-expanded', 'false');
          });
          leftToggle.setAttribute('aria-expanded', 'false');
          profile.classList.remove('is-profile-menu-open');
          restoreProfileMenuHome(profileMenu);
        };

        leftToggle.dataset.profileMenuBound = 'true';

        leftToggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const willOpen = profileMenu.hidden;
          closeAllProfileMenus(root);
          closeAllNotificationPopovers(root);

          if (willOpen) {
            // Move to <body> so it escapes `.sidebar`'s stacking context
            // (position: sticky creates one even without an explicit
            // z-index), otherwise other fixed/absolute overlays elsewhere
            // on the page can render on top of it despite its own z-index.
            document.body.appendChild(profileMenu);
            profileMenu.hidden = false;
            positionProfileMenu(leftToggle, profileMenu);
            leftToggle.setAttribute('aria-expanded', 'true');
            profile.classList.add('is-profile-menu-open');
          }
        });

        leftToggle.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          leftToggle.click();
        });

        // Bind theme/settings submenu triggers.
        const themeTrigger = profileMenu.querySelector('[data-theme-trigger="true"]');
        const themeSubmenu = themeTrigger ? themeTrigger.querySelector('.sidebar-theme-submenu') : null;
        const settingsTrigger = profileMenu.querySelector('[data-settings-trigger="true"]');
        const settingsSubmenu = settingsTrigger ? settingsTrigger.querySelector('.sidebar-settings-submenu') : null;

        function closeThemeSubmenu() {
          if (!themeSubmenu) return;
          themeSubmenu.hidden = true;
          if (themeTrigger) themeTrigger.setAttribute('aria-expanded', 'false');
        }

        function openThemeSubmenu() {
          if (!themeSubmenu) return;
          themeSubmenu.hidden = false;
          profileMenu.style.setProperty('z-index', '2147483646', 'important');
          themeSubmenu.style.setProperty('z-index', '2147483647', 'important');

          // Position fixed submenu next to the trigger using viewport coords.
          const rect = themeTrigger.getBoundingClientRect();
          themeSubmenu.style.top = `${Math.round(rect.top)}px`;
          themeSubmenu.style.left = `${Math.round(rect.right + 6)}px`;

          if (themeTrigger) themeTrigger.setAttribute('aria-expanded', 'true');
          syncThemeOptionChecks(themeSubmenu);
        }

        function syncThemeOptionChecks(submenu) {
          const current = window.ThemeManager ? window.ThemeManager.getCurrentTheme() : 'dark';
          submenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
            const isActive = opt.getAttribute('data-theme-option') === current;
            opt.classList.toggle('is-active', isActive);
            opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
          });
        }

        function syncLayoutOptionChecks(submenu) {
          const current = getLayoutMode();
          submenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
            const mode = opt.getAttribute('data-layout-option');
            const isActive = mode === current;
            opt.classList.toggle('is-active', isActive);
            opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
          });
        }

        function bindHoverSubmenu(trigger, submenu, syncFn) {
          if (!trigger || !submenu) return { close: () => {} };

          let closeTimer = null;

          function clearCloseTimer() {
            if (!closeTimer) return;
            window.clearTimeout(closeTimer);
            closeTimer = null;
          }

          function close() {
            clearCloseTimer();
            submenu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
          }

          function open() {
            clearCloseTimer();
            submenu.hidden = false;
            profileMenu.style.setProperty('z-index', '2147483646', 'important');
            submenu.style.setProperty('z-index', '2147483647', 'important');
            const rect = trigger.getBoundingClientRect();
            submenu.style.top = `${Math.round(rect.top)}px`;
            submenu.style.left = `${Math.round(rect.right + 6)}px`;
            trigger.setAttribute('aria-expanded', 'true');
            if (typeof syncFn === 'function') syncFn(submenu);
          }

          function scheduleClose() {
            clearCloseTimer();
            closeTimer = window.setTimeout(() => {
              if (trigger.matches(':hover') || submenu.matches(':hover')) return;
              close();
            }, 120);
          }

          trigger.addEventListener('mouseenter', open);
          trigger.addEventListener('mouseleave', scheduleClose);
          submenu.addEventListener('mouseenter', clearCloseTimer);
          submenu.addEventListener('mouseleave', scheduleClose);

          trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submenu.hidden ? open() : close();
          });

          return { close, open };
        }

        const themeMenuControl = bindHoverSubmenu(themeTrigger, themeSubmenu, syncThemeOptionChecks);
        const settingsMenuControl = bindHoverSubmenu(settingsTrigger, settingsSubmenu, syncLayoutOptionChecks);

        if (themeTrigger && themeSubmenu) {
          themeMenuControl.close = closeThemeSubmenu;

          themeSubmenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
            opt.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const theme = opt.getAttribute('data-theme-option');
              if (theme && window.ThemeManager) {
                window.ThemeManager.setTheme(theme);
              }
              syncThemeOptionChecks(themeSubmenu);
              closeThemeSubmenu();
              closeProfileMenu();
            });
          });
        }

        if (settingsTrigger && settingsSubmenu) {
          settingsSubmenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
            opt.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();

              const mode = opt.getAttribute('data-layout-option');
              if (mode && window.FloatNav && typeof window.FloatNav.setMode === 'function') {
                window.FloatNav.setMode(mode);
              }

              syncLayoutOptionChecks(settingsSubmenu);
              settingsMenuControl.close();
              closeProfileMenu();
            });
          });
        }

        profileMenu.querySelectorAll('.sidebar-profile-menu-item').forEach((item) => {
          if (item.getAttribute('data-auth-toggle') === 'true') return;
          if (item.getAttribute('data-theme-trigger') === 'true') return;
          if (item.getAttribute('data-settings-trigger') === 'true') return;
          item.addEventListener('click', () => {
            closeProfileMenu();
          });
        });

        const authToggleItem = profileMenu.querySelector('[data-auth-toggle="true"]');
        if (authToggleItem && authToggleItem.dataset.authToggleBound !== 'true') {
          authToggleItem.dataset.authToggleBound = 'true';
          authToggleItem.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (authToggleItem.dataset.authBusy === 'true') {
              return;
            }
            authToggleItem.dataset.authBusy = 'true';
            authToggleItem.setAttribute('aria-busy', 'true');

            const authService = window.FirebaseAuthService;
            if (!authService) {
              authToggleItem.dataset.authBusy = 'false';
              authToggleItem.removeAttribute('aria-busy');
              closeProfileMenu();
              return;
            }

            try {
              const action = authToggleItem.getAttribute('data-auth-action') || 'login';
              if (action === 'logout') {
                await authService.logout();
              } else {
                await authService.loginWithGoogle({ method: 'popup' });
              }
            } catch (error) {
              console.error('Sidebar auth action failed:', error);
              window.alert(error && error.message ? error.message : 'Login failed. Please try again.');
            } finally {
              authToggleItem.dataset.authBusy = 'false';
              authToggleItem.removeAttribute('aria-busy');
            }

            closeProfileMenu();
          });
        }
      }

      const toggle = profile.querySelector('.sidebar-notification-toggle');
      const popover = profile.querySelector('.sidebar-notification-popover');

      if (!toggle || !popover || toggle.dataset.notificationBound === 'true') return;

      popover.__sidebarNotifToggle = toggle;
      popover.__sidebarNotifHost = profile;
      popover.__sidebarNotifHomeParent = profile;
      popover.__sidebarNotifHomeNext = popover.nextSibling;
      toggle.__sidebarNotifPopover = popover;
      notifPopoverRegistry.add(popover);

      toggle.dataset.notificationBound = 'true';
      toggle.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const isOpen = !popover.hidden;

        // Always close profile menu when bell is clicked.
        closeAllProfileMenus(root);

        if (isOpen) {
          // Toggle closed — directly update state without calling closeAll
          // (which would be redundant and could race with the global handler).
          popover.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
          profile.classList.remove('is-notification-open');
          restoreNotifPopoverHome(popover);
          return;
        }

        // Open the popover: portal to document.body so it escapes `.sidebar` stacking context
        document.body.appendChild(popover);
        popover.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        profile.classList.add('is-notification-open');
        positionNotificationPopover(toggle, popover);

        // Acknowledge bell toggle so bell returns to default icon, while preserving panel unread items
        try {
          const authService = window.FirebaseAuthService;
          let uid = _notifCache.uid;
          if (!uid && authService) {
            const u = authService.getCurrentUser && authService.getCurrentUser();
            uid = u && u.uid ? u.uid : uid;
          }

          const now = Date.now();
          _notifCache.lastToggleOpenedTime = now;
          saveLocalToggleOpenedTime(uid, now);

          // Patch list HTML using existing readState (panel items keep unread state)
          const freshProducts = getRecentProducts();
          const listEl = popover.querySelector('.sidebar-notification-list-body, .sidebar-notification-list');
          if (listEl) {
            const activeTab = popover.querySelector('.sidebar-notification-filter-tab.is-active');
            const filterMode = activeTab ? activeTab.getAttribute('data-filter') : 'all';
            listEl.innerHTML = buildNotificationRows(freshProducts, _notifCache.readState, filterMode);
          }

          updateBellIconsState();
        } catch {
          // silently ignore
        }
      });
    });

    if (!window.__sidebarNotificationGlobalBound) {
      window.__sidebarNotificationGlobalBound = true;

      // Global click handler for notifications filter tabs, mark all read, and item clicks.
      document.addEventListener('click', async (event) => {
        // Filter tab click handler
        const filterTab = event.target.closest('.sidebar-notification-filter-tab');
        if (filterTab) {
          event.preventDefault();
          event.stopPropagation();

          const filterBar = filterTab.closest('.sidebar-notification-filter-bar');
          if (filterBar) {
            filterBar.querySelectorAll('.sidebar-notification-filter-tab').forEach((t) => t.classList.remove('is-active'));
            filterTab.classList.add('is-active');
          }

          const filterMode = filterTab.getAttribute('data-filter') || 'all';
          const popover = filterTab.closest('.sidebar-notification-popover');
          if (popover) {
            const listEl = popover.querySelector('.sidebar-notification-list-body, .sidebar-notification-list');
            if (listEl) {
              const products = getRecentProducts();
              listEl.innerHTML = buildNotificationRows(products, _notifCache.readState, filterMode);
            }
          }
          return;
        }

        // Mark all as read button handler
        const markAllBtn = event.target.closest('.sidebar-notification-mark-all-read');
        if (markAllBtn) {
          event.preventDefault();
          event.stopPropagation();

          const products = getRecentProducts();
          const authService = window.FirebaseAuthService;
          const uid = _notifCache.uid
            || (authService && authService.getCurrentUser && authService.getCurrentUser() && authService.getCurrentUser().uid)
            || null;

          _notifCache.readState = _notifCache.readState || {};

          products.forEach((product) => {
            if (product && product.slug) {
              const val = product.updatedAt || 'read';
              _notifCache.readState[product.slug] = val;
              if (uid) {
                markNotificationRead(uid, product.slug, val).catch(() => {});
              }
            }
          });

          // Update DOM unread indicators
          document.querySelectorAll('.sidebar-notification-unread-dot').forEach((dot) => dot.remove());
          document.querySelectorAll('.sidebar-notification-entry.is-unread').forEach((el) => el.classList.remove('is-unread'));
          document.querySelectorAll('.sidebar-notification-filter-tab[data-filter="unread"]').forEach((tab) => {
            tab.textContent = 'Unread (0)';
          });

          updateBellIconsState();

          const popover = markAllBtn.closest('.sidebar-notification-popover');
          if (popover) {
            const activeTab = popover.querySelector('.sidebar-notification-filter-tab.is-active');
            const currentFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
            const listEl = popover.querySelector('.sidebar-notification-list-body, .sidebar-notification-list');
            if (listEl) {
              listEl.innerHTML = buildNotificationRows(products, _notifCache.readState, currentFilter);
            }
          }
          return;
        }

        // Notification item click handler
        const entry = event.target.closest('.sidebar-notification-entry');
        if (!entry) return;

        event.preventDefault();
        event.stopPropagation();

        const slug = entry.getAttribute('data-slug');
        const type = entry.getAttribute('data-type') || 'template';
        const updatedAt = entry.getAttribute('data-updated-at') || '';
        const val = updatedAt || 'read';

        // Instantly update DOM (optimistic) so the dot disappears immediately.
        document.querySelectorAll(`.sidebar-notification-entry[data-slug="${CSS.escape(slug)}"]`).forEach((el) => {
          el.classList.remove('is-unread');
          const dot = el.querySelector('.sidebar-notification-unread-dot');
          if (dot) dot.remove();
        });

        // Update in-memory cache so bell icon reflects after close.
        if (slug) {
          _notifCache.readState = _notifCache.readState || {};
          _notifCache.readState[slug] = val;
        }
        updateBellIconsState();

        // Persist to Firestore for this user (await to prevent browser aborting page unload).
        const authService = window.FirebaseAuthService;
        const uid = _notifCache.uid
          || (authService && authService.getCurrentUser && authService.getCurrentUser() && authService.getCurrentUser().uid)
          || null;
        if (uid && slug) {
          try {
            await markNotificationRead(uid, slug, val);
          } catch (err) {
            console.warn('Silent read status write failure:', err);
          }
        }

        closeAllNotificationPopovers(document);

        if (slug) {
          const detailPath = type === 'design-post' ? 'my-post-detail.html' : 'product-detail.html';
          window.location.href = `${detailPath}?product=${encodeURIComponent(slug)}`;
        }
      });

      // Use 'mousedown' (not 'click') so outside-close fires BEFORE the
      // toggle's click handler — the two event types never conflict, meaning
      // the popover stays open until a genuine outside press closes it.
      document.addEventListener('mousedown', (event) => {
        if (event.target.closest('.sidebar-profile-right')) return;
        if (event.target.closest('.sidebar-notification-popover')) return;
        if (event.target.closest('.sidebar-notification-toggle')) return;
        closeAllNotificationPopovers(document);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeAllNotificationPopovers(document);
        }
      });

      window.addEventListener('resize', () => {
        repositionOpenNotificationPopovers(document);
      });

      window.addEventListener('scroll', () => {
        repositionOpenNotificationPopovers(document);
      }, true);
    }

    if (!window.__sidebarProfileMenuGlobalBound) {
      window.__sidebarProfileMenuGlobalBound = true;

      document.addEventListener('click', (event) => {
        if (event.target.closest('.sidebar-profile-left') || event.target.closest('.sidebar-profile-menu')) return;
        closeAllProfileMenus(document);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeAllProfileMenus(document);
        }
      });

      window.addEventListener('resize', () => {
        repositionOpenProfileMenus(document);
      });

      window.addEventListener('scroll', () => {
        repositionOpenProfileMenus(document);
      }, true);
    }

    if (!window.__sidebarAuthGlobalBound) {
      window.__sidebarAuthGlobalBound = true;
      const authService = window.FirebaseAuthService;
      if (authService && typeof authService.onChange === 'function') {
        authService.onChange((user) => {
          syncSidebarAuthState(document, user);
          updateAdminPageLinkVisibility(user);
          // When auth state changes (sign-in, sign-out, anonymous session
          // established), refresh the read-state cache so the bell icon
          // and popover reflect the new user's personal unread markers.
          const realUser = user && !user.isAnonymous ? user : null;
          if (realUser && realUser.uid) {
            _notifCache.uid = realUser.uid;
            fetchNotificationReadState(realUser.uid).then((rs) => {
              _notifCache.readState = rs || {};
              updateBellIconsState();
            }).catch(() => {});
          } else if (user && user.isAnonymous && user.uid) {
            // Anonymous guest — still track their read state
            _notifCache.uid = user.uid;
            fetchNotificationReadState(user.uid).then((rs) => {
              _notifCache.readState = rs || {};
              updateBellIconsState();
            }).catch(() => {});
          } else {
            _notifCache = { uid: null, readState: {} };
            updateBellIconsState();
          }
        });
        if (typeof authService.init === 'function') {
          authService.init();
        }
        // Establish a stable per-visitor identity even for guests, so
        // "Mark as read" state can be tied to a real Firestore uid for
        // everyone — Google-signed-in and anonymous guests alike.
        if (typeof authService.ensureGuestSession === 'function') {
          // ensureGuestSession is also a trigger for primeNotificationReadState
          authService.ensureGuestSession().then(() => {
            primeNotificationReadState();
          }).catch(() => {
            primeNotificationReadState();
          });
        } else {
          primeNotificationReadState();
        }
      }
    }

    const authService = window.FirebaseAuthService;
    // Fall back to the shared same-origin snapshot (see JS/firebase-auth.js)
    // for an instant paint: getCurrentUser() is still null here on a fresh
    // page load since Firebase's own IndexedDB restore hasn't resolved yet.
    // The onChange listener above corrects this shortly after with the
    // authoritative state.
    const user = authService
      ? (typeof authService.getCurrentUser === 'function' && authService.getCurrentUser())
        || (typeof authService.getCachedUser === 'function' && authService.getCachedUser())
        || null
      : null;
    syncSidebarAuthState(root, user);
    void updateAdminPageLinkVisibility(user);
  }

  function closeAllProfileMenus() {
    profileMenuRegistry.forEach((menu) => {
      const leftToggle = menu.__sidebarProfileToggle;
      const profile = menu.__sidebarProfileHost;

      if (menu.contains(document.activeElement)) {
        if (leftToggle && typeof leftToggle.focus === 'function') {
          leftToggle.focus();
        } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }

      menu.hidden = true;
      if (leftToggle) leftToggle.setAttribute('aria-expanded', 'false');
      if (profile) profile.classList.remove('is-profile-menu-open');
      restoreProfileMenuHome(menu);
    });
  }

  function closeAllNotificationPopovers(scope) {
    notifPopoverRegistry.forEach((popover) => {
      const toggle = popover.__sidebarNotifToggle;
      const profile = popover.__sidebarNotifHost;

      if (popover.contains(document.activeElement)) {
        if (toggle && typeof toggle.focus === 'function') {
          toggle.focus();
        } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }

      popover.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      if (profile) profile.classList.remove('is-notification-open');
      restoreNotifPopoverHome(popover);
    });

    const root = scope || document;
    root.querySelectorAll('.sidebar-profile').forEach((profile) => {
      const toggle = profile.querySelector('.sidebar-notification-toggle');
      const popover = profile.querySelector('.sidebar-notification-popover');
      if (!toggle || !popover) return;

      popover.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      profile.classList.remove('is-notification-open');
    });
  }

  function mount(root, options) {
    if (!root) return;

    const opts = options || {};
    const activeKey = opts.activeKey || root.dataset.sidebarActive || 'discover';
    const variant = opts.variant || root.dataset.sidebarVariant || '';

    root.outerHTML = renderSidebar({ activeKey, variant });
  }

  function requestProductsLoad() {
    if (window.__sidebarProductsLoadRequested) return;
    if (!window.ProductDataSource || typeof window.ProductDataSource.loadProducts !== 'function') {
      window.__sidebarLiveBadgeLoading = false;
      return;
    }

    window.__sidebarProductsLoadRequested = true;
    window.__sidebarLiveBadgeLoading = true;

    Promise.resolve(window.ProductDataSource.loadProducts())
      .catch(() => {})
      .finally(() => {
        window.__sidebarLiveBadgeLoading = false;
        refreshMountedSidebars();
      });
  }

  function mountAll() {
    requestProductsLoad();

    document.querySelectorAll('[data-sidebar-root]').forEach((root) => {
      mount(root);
    });

    bindSidebarInteractions(document);
  }

  function getActiveKeyFromSidebar(sidebar) {
    if (!sidebar) return 'discover';

    if (sidebar.hasAttribute('data-sidebar-active')) {
      return sidebar.getAttribute('data-sidebar-active') || 'discover';
    }

    const activeTab = sidebar.querySelector('.nav-tab.active[data-nav-key]');
    return activeTab ? activeTab.getAttribute('data-nav-key') : 'discover';
  }

  function refreshMountedSidebars() {
    document.querySelectorAll('.layout > .sidebar').forEach((sidebar) => {
      const activeKey = getActiveKeyFromSidebar(sidebar);
      const variant = sidebar.classList.contains('sidebar--tablet') ? 'tablet' : '';

      sidebar.outerHTML = renderSidebar({ activeKey, variant });
    });

    bindSidebarInteractions(document);
  }

  window.SidebarComponent = {
    bindSidebarInteractions,
    createNavTab,
    mount,
    mountAll,
    refreshMountedSidebars,
    renderSidebar,
  };

  document.addEventListener('products:updated', () => {
    window.__sidebarLiveBadgeLoading = false;
    refreshMountedSidebars();
  });

  let initialMountDone = false;

  function delayedMountAll() {
    if (initialMountDone) return;
    initialMountDone = true;
    mountAll();
  }

  document.addEventListener('app:layoutReady', delayedMountAll);

  // Safety fallback in case a page forgets to dispatch
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(delayedMountAll, 1000));
  } else {
    setTimeout(delayedMountAll, 1000);
  }
})();