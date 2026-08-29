// float-nav.js: Float mode navigation bar — renders sidebar nav as horizontal top bar.
(function initFloatNav() {
  const STORAGE_KEY = 'siteLayoutMode'; // 'classic' | 'float'
  const FLOAT_CSS_ID = 'float-layout-stylesheet';
  const FLOAT_ASSET_VERSION = '20260710-4';

  // Nav items that appear in the float nav (mirrors Sidebar.js primaryItems + workItems + starredItems)
  const NAV_ITEMS = [
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
      liveBadge: 'discover',
    },
    {
      key: 'latest-post',
      href: '/my-post',
      icon: 'ASSET/Icons/nav-my-latest-post.svg',
      label: 'My Latest Post',
      liveBadge: 'latestPost',
    },
    {
      key: 'mobile-templates',
      href: '/mobile-template',
      icon: 'ASSET/Icons/nav-mobile-templates.svg',
      label: 'Mobile Templates',
      liveBadge: 'mobileTemplates',
    },
    {
      key: 'web-templates',
      href: '/web-template',
      icon: 'ASSET/Icons/web-sidebar.svg',
      label: 'Web Templates',
      liveBadge: 'webTemplates',
    },
    {
      key: 'about',
      href: '/about-me',
      icon: 'ASSET/Icons/nav-about-me.svg',
      label: 'About Me',
    },
  ];

  function normalizeType(value) {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'design-post' || s === 'design-posts') return 'design-post';
    return 'template';
  }

  function isMobileTemplate(product) {
    const haystack = [product && product.category, product && product.title, Array.isArray(product && product.tags) ? product.tags.join(' ') : ''].join(' ').toLowerCase();
    return /mobile|app|ios|android/.test(haystack);
  }

  function isWebTemplate(product) {
    const haystack = [product && product.category, product && product.title, Array.isArray(product && product.tags) ? product.tags.join(' ') : ''].join(' ').toLowerCase();
    return /web|website|landing|dashboard|saas/.test(haystack);
  }

  function formatBadge(count) {
    const n = Number.isFinite(count) && count > 0 ? count : 0;
    return n > 0 ? String(n).padStart(2, '0') : '';
  }

  function getLiveBadges() {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const templates = products.filter((p) => normalizeType(p && p.productType) === 'template');
    const designPosts = products.filter((p) => normalizeType(p && p.productType) === 'design-post');
    return {
      discover: formatBadge(templates.length),
      latestPost: formatBadge(designPosts.length),
      mobileTemplates: formatBadge(templates.filter(isMobileTemplate).length || templates.length),
      webTemplates: formatBadge(templates.filter(isWebTemplate).length || templates.length),
    };
  }

  function getActiveKey() {
    const sidebar = document.querySelector('[data-sidebar-active]');
    if (sidebar) return sidebar.getAttribute('data-sidebar-active') || 'discover';
    const url = window.location.pathname.split('/').pop() || 'files.html';
    const page = url.replace('.html', '');
    const map = {
      'index': 'recents',
      'my-post': 'latest-post',
      'mobile-template': 'mobile-templates',
      'web-template': 'web-templates',
      'about-me': 'about',
      'filter-template': 'discover',
    };
    return map[page] || 'discover';
  }

  function navigateItem(event, href) {
    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
      window.MainShellRouter && typeof window.MainShellRouter.navigate === 'function' &&
      window.MainShellRouter.isShellPageUrl && window.MainShellRouter.isShellPageUrl(href)
    ) {
      event.preventDefault();
      window.MainShellRouter.navigate(href);
    }
  }

  function getSidebarNotificationSnapshot() {
    // Derive unread state and popover markup directly from the already-rendered
    // sidebar DOM (Sidebar.js now manages unread state in memory + Firestore;
    // the old motvin_notifications localStorage key no longer exists).
    const popoverNode = document.querySelector('.sidebar-notification-popover');

    // Count unread dots in the sidebar's own rendered notification list.
    const hasNotification = popoverNode
      ? popoverNode.querySelectorAll('.sidebar-notification-unread-dot').length > 0
      : false;

    return {
      hasNotification: hasNotification,
      popoverMarkup: popoverNode ? popoverNode.outerHTML : '<div class="sidebar-notification-popover" hidden><div class="sidebar-notification-panel"></div></div>',
    };
  }

  function renderFloatProfileMenu() {
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
                <span class="sidebar-profile-menu-icon" aria-hidden="true"><img src="ASSET/Icons/nav-updates-icon.svg" alt="" /></span>
                <span>Release Updates</span>
              </span>
            </span>
          </a>

          <a href="/saved-templates" class="sidebar-profile-menu-item" role="menuitem">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true"><img src="ASSET/Icons/profile-menu-saved-templates.svg" alt="" /></span>
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
                <span class="sidebar-profile-menu-icon" aria-hidden="true"><img src="ASSET/Icons/profile-menu-change-theme.svg" alt="" /></span>
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
                <span class="sidebar-profile-menu-icon" aria-hidden="true"><img src="ASSET/Icons/profile-menu-settings.svg" alt="" /></span>
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

        </div>

        <div class="sidebar-profile-menu-divider-wrap"><span class="sidebar-profile-menu-divider"></span></div>

        <div class="sidebar-profile-menu-list" role="menu" aria-label="Account actions">
          <button type="button" class="sidebar-profile-menu-item" role="menuitem" data-auth-toggle="true" data-auth-action="login">
            <span class="sidebar-profile-menu-item-main">
              <span class="sidebar-profile-menu-item-left">
                <span class="sidebar-profile-menu-icon" aria-hidden="true"><img src="ASSET/Icons/profile-menu-login.svg" alt="" /></span>
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

  function applyAuthStateToFloatProfile(nav, user) {
    if (!nav) return;

    const profile = nav.querySelector('.sidebar-profile');
    if (!profile) return;

    // Anonymous sessions (Firebase Anonymous Auth established for notification
    // read-state tracking) are a real truthy user object under the hood, but
    // should still render as "Guest" — same logic as Sidebar.js's realUser.
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

    const menuName = profile.querySelector('.sidebar-profile-menu-name');
    if (menuName) menuName.textContent = name;

    const menuEmail = profile.querySelector('.sidebar-profile-menu-email');
    if (menuEmail) menuEmail.textContent = email;

    const menuAvatarImage = profile.querySelector('.sidebar-profile-menu-avatar img');
    if (menuAvatarImage) {
      menuAvatarImage.src = photoURL;
      menuAvatarImage.alt = name;
    }

    const avatar = profile.querySelector('.sidebar-profile-main .sidebar-avatar');
    setAvatarState(avatar, realUser);

    const authToggleItem = profile.querySelector('[data-auth-toggle="true"]');
    const authLabel = profile.querySelector('.sidebar-profile-menu-auth-label');
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

  function positionFloatProfileMenu(anchor, menu) {
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

  function positionFloatNotificationPopover(anchor, menu) {
    if (!anchor || !menu || menu.hidden) return;

    const rect = anchor.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 320;
    const viewportPadding = 8;

    let left = Math.round(rect.left);
    const maxLeft = window.innerWidth - menuWidth - viewportPadding;
    if (left > maxLeft) {
      left = Math.max(viewportPadding, maxLeft);
    }

    menu.style.left = `${Math.max(viewportPadding, left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
  }

  function closeAllFloatProfileMenus(scope) {
    const root = scope || document;
    root.querySelectorAll('.float-nav .sidebar-profile').forEach((profile) => {
      const toggle = profile.querySelector('.sidebar-profile-left.float-nav-profile-link');
      const menu = profile.querySelector('.sidebar-profile-menu');
      if (!toggle || !menu) return;

      menu.hidden = true;
      menu.querySelectorAll('.sidebar-theme-submenu').forEach((submenu) => {
        submenu.hidden = true;
      });
      menu.querySelectorAll('[data-theme-trigger="true"], [data-settings-trigger="true"]').forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
      });
      menu.setAttribute('hidden', '');
      menu.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
      profile.classList.remove('is-profile-menu-open');
    });
  }

  function buildFloatNavHTML(activeKey) {
    const badges = getLiveBadges();
    const notification = getSidebarNotificationSnapshot();
    const items = NAV_ITEMS.map((item) => {
      const badge = item.liveBadge ? badges[item.liveBadge] : '';
      const badgeHtml = badge ? `<span class="float-nav-item-badge">${badge}</span>` : '';
      return `
        <a class="float-nav-item${item.key === activeKey ? ' is-active' : ''}" href="${item.href}" data-float-nav-key="${item.key}">
          <img src="${item.icon}" alt="" />
          <span>${item.label}</span>
          ${badgeHtml}
        </a>`;
    }).join('');

    return `
      <nav class="float-nav" id="float-nav-bar" role="navigation" aria-label="Float navigation">
        <div class="sidebar-profile">
          <div class="sidebar-profile-left float-nav-profile-link" role="button" tabindex="0" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded="false">
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
          ${renderFloatProfileMenu()}
          <div class="sidebar-profile-right">
            <button class="sidebar-notification-toggle" type="button" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false">
              <img src="ASSET/Icons/${notification.hasNotification ? 'nav-notification-icon-active.svg' : 'nav-notification-icon.svg'}" alt="" aria-hidden="true" />
            </button>
            ${notification.popoverMarkup}
          </div>
        </div>

        <div class="float-nav-center">
          <div class="float-nav-items" role="tablist" aria-label="Content sections">
            ${items}
          </div>
        </div>

        <div class="float-nav-tail">
          <label class="search-bar" aria-label="Search">
            <img src="ASSET/Icons/search-icon.svg" alt="" aria-hidden="true" />
            <input class="search-bar-input" type="search" placeholder="Search community" autocomplete="off" />
          </label>
        </div>
      </nav>`;
  }

  function injectFloatNav() {
    removeFloatNav();
    const layout = document.querySelector('.layout');
    if (!layout) return;

    const activeKey = getActiveKey();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildFloatNavHTML(activeKey).trim();
    const navEl = wrapper.firstElementChild;

    // Insert float-nav as the first child of layout (before .main)
    layout.insertBefore(navEl, layout.firstChild);

    bindFloatNavEvents(navEl);
    updateFloatNavActive();
  }

  function updateFloatNavActive() {
    const nav = document.getElementById('float-nav-bar');
    if (!nav) return;

    const activeKey = getActiveKey();
    nav.querySelectorAll('.float-nav-item[data-float-nav-key]').forEach((el) => {
      const key = el.getAttribute('data-float-nav-key');
      el.classList.toggle('is-active', key === activeKey);
    });

    const badges = getLiveBadges();
    NAV_ITEMS.forEach((item) => {
      if (!item.liveBadge) return;
      const el = nav.querySelector(`.float-nav-item[data-float-nav-key="${item.key}"] .float-nav-item-badge`);
      if (!el) return;
      const badge = badges[item.liveBadge];
      if (badge) {
        el.textContent = badge;
        el.hidden = false;
      }
    });

    syncFloatNotificationFromSidebar(nav);
  }

  function bindFloatNavEvents(nav) {
    nav.querySelectorAll('.float-nav-item[href]').forEach((link) => {
      link.addEventListener('click', (event) => {
        navigateItem(event, link.getAttribute('href'));
      });
    });

    bindFloatProfileMenu(nav);
    bindFloatNotificationPopover(nav);
  }

  function bindFloatProfileMenu(nav) {
    const profile = nav.querySelector('.sidebar-profile');
    if (!profile) return;

    const toggle = profile.querySelector('.sidebar-profile-left.float-nav-profile-link');
    const menu = profile.querySelector('.sidebar-profile-menu');
    if (!toggle || !menu || toggle.dataset.floatProfileMenuBound === 'true') return;

    toggle.dataset.floatProfileMenuBound = 'true';

    const closeMenu = () => {
      menu.hidden = true;
      menu.querySelectorAll('.sidebar-theme-submenu').forEach((submenu) => {
        submenu.hidden = true;
      });
      menu.querySelectorAll('[data-theme-trigger="true"], [data-settings-trigger="true"]').forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
      });
      toggle.setAttribute('aria-expanded', 'false');
      profile.classList.remove('is-profile-menu-open');
    };

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const willOpen = menu.hidden;
      closeAllFloatProfileMenus(document);
      closeFloatNotificationPopover(nav);

      if (willOpen) {
        menu.hidden = false;
        menu.removeAttribute('hidden');
        menu.style.display = 'flex';
        positionFloatProfileMenu(toggle, menu);
        toggle.setAttribute('aria-expanded', 'true');
        profile.classList.add('is-profile-menu-open');
      }
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle.click();
    });

    const themeTrigger = menu.querySelector('[data-theme-trigger="true"]');
    const themeSubmenu = themeTrigger ? themeTrigger.querySelector('.sidebar-theme-submenu') : null;
    const settingsTrigger = menu.querySelector('[data-settings-trigger="true"]');
    const settingsSubmenu = settingsTrigger ? settingsTrigger.querySelector('.sidebar-settings-submenu') : null;

    function syncThemeOptionChecks(submenu) {
      const current = window.ThemeManager ? window.ThemeManager.getCurrentTheme() : 'dark';
      submenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
        const isActive = opt.getAttribute('data-theme-option') === current;
        opt.classList.toggle('is-active', isActive);
        opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function syncLayoutOptionChecks(submenu) {
      const current = getStoredMode();
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
        menu.style.setProperty('z-index', '2147483646', 'important');
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

    bindHoverSubmenu(themeTrigger, themeSubmenu, syncThemeOptionChecks);
    const settingsMenuControl = bindHoverSubmenu(settingsTrigger, settingsSubmenu, syncLayoutOptionChecks);

    if (themeSubmenu) {
      themeSubmenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
        opt.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const theme = opt.getAttribute('data-theme-option');
          if (theme && window.ThemeManager) {
            window.ThemeManager.setTheme(theme);
          }
          syncThemeOptionChecks(themeSubmenu);
          closeMenu();
        });
      });
    }

    if (settingsSubmenu) {
      settingsSubmenu.querySelectorAll('.sidebar-theme-option').forEach((opt) => {
        opt.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const mode = opt.getAttribute('data-layout-option');
          if (mode) {
            setMode(mode);
          }
          syncLayoutOptionChecks(settingsSubmenu);
          settingsMenuControl.close();
          closeMenu();
        });
      });
    }

    menu.querySelectorAll('.sidebar-profile-menu-item').forEach((item) => {
      if (item.getAttribute('data-auth-toggle') === 'true') return;
      if (item.getAttribute('data-theme-trigger') === 'true') return;
      if (item.getAttribute('data-settings-trigger') === 'true') return;
      item.addEventListener('click', () => {
        closeMenu();
      });
    });

    const authToggleItem = menu.querySelector('[data-auth-toggle="true"]');
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
          closeMenu();
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
          console.error('Float auth action failed:', error);
          window.alert(error && error.message ? error.message : 'Login failed. Please try again.');
        } finally {
          authToggleItem.dataset.authBusy = 'false';
          authToggleItem.removeAttribute('aria-busy');
        }

        closeMenu();
      });
    }

    if (window.__floatProfileMenuGlobalBound) return;
    window.__floatProfileMenuGlobalBound = true;

    document.addEventListener('click', (event) => {
      if (event.target.closest('.float-nav .sidebar-profile-left.float-nav-profile-link')) return;
      if (event.target.closest('.float-nav .sidebar-profile-menu')) return;
      closeAllFloatProfileMenus(document);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllFloatProfileMenus(document);
      }
    });

    window.addEventListener('resize', () => {
      const openMenu = nav.querySelector('.sidebar-profile-menu:not([hidden])');
      if (!openMenu) return;
      positionFloatProfileMenu(toggle, openMenu);
    });

    window.addEventListener('scroll', () => {
      const openMenu = nav.querySelector('.sidebar-profile-menu:not([hidden])');
      if (!openMenu) return;
      positionFloatProfileMenu(toggle, openMenu);
    }, true);

    if (!window.__floatAuthGlobalBound) {
      window.__floatAuthGlobalBound = true;
      const authService = window.FirebaseAuthService;
      if (authService && typeof authService.onChange === 'function') {
        authService.onChange((user) => {
          const liveNav = document.getElementById('float-nav-bar');
          if (!liveNav) return;
          applyAuthStateToFloatProfile(liveNav, user);
        });
        if (typeof authService.init === 'function') {
          authService.init();
        }
      }
    }

    const authService = window.FirebaseAuthService;
    const user = authService && typeof authService.getCurrentUser === 'function'
      ? authService.getCurrentUser()
      : null;
    applyAuthStateToFloatProfile(nav, user);
  }

  function closeFloatNotificationPopover(nav) {
    document.querySelectorAll('.sidebar-notification-popover').forEach((popover) => {
      popover.hidden = true;
    });

    const root = nav || document;
    root.querySelectorAll('.sidebar-profile').forEach((profile) => {
      const toggle = profile.querySelector('.sidebar-notification-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      profile.classList.remove('is-notification-open');
    });
  }

  function syncFloatNotificationFromSidebar(nav) {
    const profile = nav.querySelector('.sidebar-profile');
    if (!profile) return;

    const sidebarSnapshot = getSidebarNotificationSnapshot();
    const toggleBtn = profile.querySelector('.sidebar-notification-toggle');
    const toggleImg = toggleBtn ? toggleBtn.querySelector('img') : null;
    if (toggleImg) {
      toggleImg.src = sidebarSnapshot.hasNotification 
        ? 'ASSET/Icons/nav-notification-icon-active.svg' 
        : 'ASSET/Icons/nav-notification-icon.svg';
    }

    const currentPopover = document.querySelector('.sidebar-notification-popover');
    if (!currentPopover) {
      profile.insertAdjacentHTML('beforeend', sidebarSnapshot.popoverMarkup);
    } else {
      const parent = currentPopover.parentNode;
      if (parent) {
        const temp = document.createElement('div');
        temp.innerHTML = sidebarSnapshot.popoverMarkup;
        const newPopover = temp.firstElementChild;
        if (newPopover) {
          parent.replaceChild(newPopover, currentPopover);
        }
      }
    }
  }

  function bindFloatNotificationPopover(nav) {
    const profile = nav.querySelector('.sidebar-profile');
    if (!profile) return;

    const toggle = profile.querySelector('.sidebar-notification-toggle');
    if (!toggle || toggle.dataset.floatNotificationBound === 'true') return;

    toggle.dataset.floatNotificationBound = 'true';

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const existingPopover = document.querySelector('.sidebar-notification-popover');
      const isAlreadyOpen = existingPopover && !existingPopover.hidden;

      // Always sync first so float mode uses the already-created sidebar menu markup.
      syncFloatNotificationFromSidebar(nav);

      const livePopover = document.querySelector('.sidebar-notification-popover');
      if (!livePopover) return;

      closeFloatNotificationPopover(nav);

      if (!isAlreadyOpen) {
        closeAllFloatProfileMenus(document);
        document.body.appendChild(livePopover);
        livePopover.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        profile.classList.add('is-notification-open');
        positionFloatNotificationPopover(toggle, livePopover);
      } else {
        livePopover.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        profile.classList.remove('is-notification-open');
      }
    });

    window.addEventListener('resize', () => {
      const openNotif = document.querySelector('.sidebar-notification-popover:not([hidden])');
      if (!openNotif) return;
      positionFloatNotificationPopover(toggle, openNotif);
    });

    window.addEventListener('scroll', () => {
      const openNotif = document.querySelector('.sidebar-notification-popover:not([hidden])');
      if (!openNotif) return;
      positionFloatNotificationPopover(toggle, openNotif);
    }, true);

    if (nav.dataset.floatNotificationGlobalBound === 'true') return;
    nav.dataset.floatNotificationGlobalBound = 'true';

    // Use mousedown to prevent click races and match Sidebar.js behavior
    document.addEventListener('mousedown', (event) => {
      if (event.target.closest('.sidebar-notification-popover')) return;
      if (event.target.closest('.sidebar-notification-toggle')) return;
      if (event.target.closest('.sidebar-profile-right')) return;
      closeFloatNotificationPopover(nav);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeFloatNotificationPopover(nav);
      }
    });
  }

  function removeFloatNav() {
    const nav = document.getElementById('float-nav-bar');
    if (nav) nav.remove();
  }

  function injectFloatStylesheet() {
    const existing = document.getElementById(FLOAT_CSS_ID);
    if (existing) {
      return;
    }

    // Resolve path relative to this script's location
    const scriptSrc = (document.currentScript && document.currentScript.src) || '';
    let cssHref = 'FLOAT SITE/float-layout.css';

    if (scriptSrc.includes('FLOAT%20SITE/') || scriptSrc.includes('FLOAT SITE/')) {
      // Script is in FLOAT SITE folder
      cssHref = 'float-layout.css';
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = FLOAT_CSS_ID;
    link.href = `${cssHref}?v=${encodeURIComponent(FLOAT_ASSET_VERSION)}`;
    document.head.appendChild(link);
  }

  function removeFloatStylesheet() {
    const link = document.getElementById(FLOAT_CSS_ID);
    if (link) link.remove();
  }

  function applyFloatMode() {
    injectFloatStylesheet();
    document.body.dataset.layout = 'float';
    injectFloatNav();
  }

  function removeFloatMode() {
    delete document.body.dataset.layout;
    removeFloatNav();
  }

  function getStoredMode() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || 'classic';
    } catch {
      return 'classic';
    }
  }

  function storeMode(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }

  let isLayoutSwitching = false;

  function setMode(mode, options = {}) {
    const next = mode === 'float' ? 'float' : 'classic';
    const isFloatActive = document.body.dataset.layout === 'float';
    const currentMode = isFloatActive ? 'float' : 'classic';

    if (currentMode === next && !options.force) {
      updateSidebarToggleUI(next);
      return;
    }

    storeMode(next);
    updateSidebarToggleUI(next);

    if (options.immediate) {
      if (next === 'float') {
        applyFloatMode();
      } else {
        removeFloatMode();
      }
      return;
    }

    if (isLayoutSwitching) return;
    isLayoutSwitching = true;

    let glow = document.querySelector('.layout-switch-ambient-glow');
    if (!glow) {
      glow = document.createElement('div');
      glow.className = 'layout-switch-ambient-glow';
      document.body.appendChild(glow);
    }

    injectFloatStylesheet();

    if (next === 'float') {
      injectFloatNav();
      document.body.classList.add('is-layout-switching', 'switching-to-float');

      setTimeout(() => {
        document.body.dataset.layout = 'float';
      }, 120);

      setTimeout(() => {
        document.body.classList.remove('is-layout-switching', 'switching-to-float');
        isLayoutSwitching = false;
        window.dispatchEvent(new CustomEvent('layout:mode-changed', { detail: { mode: 'float' } }));
      }, 420);
    } else {
      document.body.classList.add('is-layout-switching', 'switching-to-classic');

      setTimeout(() => {
        delete document.body.dataset.layout;
      }, 120);

      setTimeout(() => {
        removeFloatNav();
        document.body.classList.remove('is-layout-switching', 'switching-to-classic');
        isLayoutSwitching = false;
        window.dispatchEvent(new CustomEvent('layout:mode-changed', { detail: { mode: 'classic' } }));
      }, 420);
    }
  }

  function updateSidebarToggleUI(mode) {
    document.querySelectorAll('[data-layout-toggle], .sidebar-settings-submenu, [aria-label="Select layout"]').forEach((toggle) => {
      const classicBtn = toggle.querySelector('[data-layout-option="classic"]');
      const floatBtn = toggle.querySelector('[data-layout-option="float"]');
      if (classicBtn) {
        classicBtn.classList.toggle('is-active', mode === 'classic');
        classicBtn.setAttribute('aria-checked', mode === 'classic' ? 'true' : 'false');
      }
      if (floatBtn) {
        floatBtn.classList.toggle('is-active', mode === 'float');
        floatBtn.setAttribute('aria-checked', mode === 'float' ? 'true' : 'false');
      }
    });
  }

  function init() {
    injectFloatStylesheet();

    // Apply persisted mode on page load
    const stored = getStoredMode();
    setMode(stored, { immediate: true });

    // Listen to shell navigation to update active state
    window.addEventListener('main-shell:navigated', () => {
      if (document.body.dataset.layout === 'float') {
        updateFloatNavActive();
      }
    });

    // Listen for products update to refresh badges
    document.addEventListener('products:updated', () => {
      if (document.body.dataset.layout === 'float') {
        updateFloatNavActive();
      }
    });
  }

  window.FloatNav = {
    init,
    setMode,
    getStoredMode,
    updateFloatNavActive,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
