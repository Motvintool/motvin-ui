// top-pane-product-tabs.js: Shared top-pane product tabs behavior for index/detail pages.
(function initProductTopPaneTabs() {
  const STORAGE_KEY = 'openedProductSlugs';
  const FILTER_PREFIX = 'filter:';
  const MOBILE_TOP_PANE_BREAKPOINT = 670;
  const SITE_SUPER_ADMIN_EMAIL = 'surendarv638@gmail.com';

  function normalizeTemplateCategory(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replaceAll('&', 'and')
      .replace(/[^a-z0-9]+/g, '-');

    if (!normalized) return 'free-paid';
    if (normalized === 'mobile' || normalized === 'mobile-templates') return 'mobile';
    if (normalized === 'web' || normalized === 'web-templates') return 'web';
    if (normalized === 'free' || normalized === 'free-templates') return 'free';
    if (normalized === 'paid' || normalized === 'paid-templates') return 'paid';
    if (
      normalized === 'free-paid' ||
      normalized === 'free-and-paid' ||
      normalized === 'all' ||
      normalized === 'all-templates'
    ) {
      return 'free-paid';
    }
    if (normalized === 'recent' || normalized === 'recent-templates') return 'recent';
    return 'free-paid';
  }

  function isFilterTabSlug(slug) {
    return typeof slug === 'string' && slug.startsWith(FILTER_PREFIX);
  }

  function buildFilterTabSlug(category) {
    return `${FILTER_PREFIX}${normalizeTemplateCategory(category)}`;
  }

  function getFilterCategoryFromSlug(slug) {
    if (!isFilterTabSlug(slug)) return 'free-paid';
    return normalizeTemplateCategory(slug.slice(FILTER_PREFIX.length));
  }

  function getFilterTabLabel(category) {
    const labels = {
      mobile: 'Mobile Templates',
      web: 'Web Templates',
      free: 'Free Templates',
      paid: 'Paid Templates',
      'free-paid': 'Free & Paid Templates',
      recent: 'Recent Templates',
    };
    return labels[normalizeTemplateCategory(category)] || labels['free-paid'];
  }

  function getOpenedProductSlugs() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item === 'string');
    } catch {
      return [];
    }
  }

  function setOpenedProductSlugs(slugs) {
    const uniqueSlugs = [];
    slugs.forEach((slug) => {
      if (typeof slug === 'string' && !uniqueSlugs.includes(slug)) {
        uniqueSlugs.push(slug);
      }
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueSlugs));
  }

  function rememberOpenedProductSlug(slug, options) {
    if (!slug) return;
    const opts = options || {};
    const opened = getOpenedProductSlugs();
    if (!opened.includes(slug)) {
      opened.push(slug);
      setOpenedProductSlugs(opened);

      if (opts.skipRefresh !== true) {
        // Repaint tabs immediately after opening a new product.
        refreshAll();
      }
    }
  }

  function removeOpenedProductSlug(slug) {
    const remaining = getOpenedProductSlugs().filter((item) => item !== slug);
    setOpenedProductSlugs(remaining);
    return remaining;
  }

  function labelFromSlug(slug) {
    const raw = String(slug || '').trim();
    if (!raw) return 'Opening...';

    return raw
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function findProductBySlug(slug) {
    if (!Array.isArray(window.PRODUCTS)) return null;
    return window.PRODUCTS.find((product) => product.slug === slug) || null;
  }

  function normalizeProductType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'design-post' || normalized === 'design-posts') return 'design-post';
    return 'template';
  }

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function getDetailPagePath() {
    const page = getCurrentPageName();
    if (page === 'my-post.html' || page === 'my-post-detail.html') {
      return 'my-post-detail.html';
    }
    return 'product-detail.html';
  }

  function getDetailPagePathForSlug(slug) {
    const product = findProductBySlug(slug);
    if (product) {
      return normalizeProductType(product.productType) === 'design-post'
        ? 'my-post-detail.html'
        : 'product-detail.html';
    }

    return getDetailPagePath();
  }

  function buildDetailUrl(slug) {
    return `${getDetailPagePathForSlug(slug)}?product=${encodeURIComponent(slug)}`;
  }

  function buildFilterUrl(category) {
    const normalized = normalizeTemplateCategory(category);
    if (normalized === 'mobile') {
      return 'mobile-template.html';
    }
    if (normalized === 'web') {
      return 'web-template.html';
    }
    return `filter-template.html?category=${encodeURIComponent(normalized)}`;
  }

  function findTabBySlug(slug) {
    if (isFilterTabSlug(slug)) {
      const category = getFilterCategoryFromSlug(slug);
      const title = getFilterTabLabel(category);
      return {
        slug,
        title,
        author: 'Siren.uix',
        category: 'Template Collection',
        price: '',
        isFilterTab: true,
      };
    }

    const product = findProductBySlug(slug);
    if (product) return product;

    // Keep tab visibility stable even if products load asynchronously.
    return {
      slug,
      title: labelFromSlug(slug),
      author: 'Loading',
      category: 'Product',
      price: '',
      isPlaceholder: true,
    };
  }

  function buildTabUrl(slug) {
    if (isFilterTabSlug(slug)) {
      return buildFilterUrl(getFilterCategoryFromSlug(slug));
    }
    return buildDetailUrl(slug);
  }

  function getTargetSlugFromUrl(urlLike) {
    try {
      const target = new URL(urlLike, window.location.href);
      return String(target.searchParams.get('product') || '').trim();
    } catch {
      return '';
    }
  }

  function navigateDetailWithoutReload(urlLike) {
    const currentPage = getCurrentPageName();
    const target = new URL(urlLike, window.location.href);
    const targetPage = target.pathname.split('/').filter(Boolean).pop() || 'files.html';
    const targetSlug = getTargetSlugFromUrl(target.href);

    if (!targetSlug) return false;

    if (currentPage === 'product-detail.html' && targetPage === 'product-detail.html') {
      if (window.ProductDetailPage && typeof window.ProductDetailPage.navigateToSlug === 'function') {
        return window.ProductDetailPage.navigateToSlug(targetSlug, { url: target.href });
      }
    }

    if (currentPage === 'my-post-detail.html' && targetPage === 'my-post-detail.html') {
      if (window.MyPostDetailPage && typeof window.MyPostDetailPage.navigateToSlug === 'function') {
        return window.MyPostDetailPage.navigateToSlug(targetSlug, { url: target.href });
      }
    }

    return false;
  }

  function navigateTo(url) {
    if (navigateDetailWithoutReload(url)) {
      return;
    }

    if (window.MainShellRouter && typeof window.MainShellRouter.navigate === 'function') {
      if (window.MainShellRouter.isShellPageUrl && window.MainShellRouter.isShellPageUrl(url)) {
        window.MainShellRouter.navigate(url);
        return;
      }
    }

    window.location.href = url;
  }

  function renderTab(product, isActive) {
    return `
      <div class="top-pane-tab${isActive ? ' is-active' : ''}" data-product-slug="${product.slug}">
        <svg class="tab-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.00004 5.33329H4.00671M6.66671 5.33329H6.67337M9.33337 5.33329H9.34004M2.66671 2.66663H13.3334C14.0698 2.66663 14.6667 3.26358 14.6667 3.99996V12C14.6667 12.7363 14.0698 13.3333 13.3334 13.3333H2.66671C1.93033 13.3333 1.33337 12.7363 1.33337 12V3.99996C1.33337 3.26358 1.93033 2.66663 2.66671 2.66663Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>${product.title}</span>
        <button class="tab-close" type="button" aria-label="Close tab">
          <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
        </button>
        <div class="tab-hover-card" aria-hidden="true">
          <div class="tab-hover-card-inner">
            <img class="tab-hover-preview" src="ASSET/Images/top-pane-hover-preview.png" alt="" />
            <div class="tab-hover-meta">
              <div>
                <div class="tab-hover-title">${product.title}</div>
                <div class="tab-hover-subtitle">By ${product.author} • ${product.category}</div>
              </div>
              <div class="tab-hover-price">${product.price}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function getOpenedProducts() {
    return getOpenedProductSlugs()
      .map((slug) => findTabBySlug(slug))
      .filter((product, index, all) => product && all.findIndex((item) => item.slug === product.slug) === index);
  }

  function syncBodyTopPaneState() {
    const hasVisibleTopPane = Array.from(document.querySelectorAll('.top-pane'))
      .some((pane) => !pane.classList.contains('top-pane--hidden'));
    document.body.classList.toggle('top-pane-hidden', !hasVisibleTopPane);
  }

  function syncTopPaneVisibilityFromWrapper(tabsWrapper) {
    if (!tabsWrapper) return;

    const topPane = tabsWrapper.closest('.top-pane');
    if (!topPane) return;

    const isMobileViewport = window.innerWidth <= MOBILE_TOP_PANE_BREAKPOINT;
    const hasProductTabs = Boolean(tabsWrapper.querySelector('.top-pane-tab[data-product-slug]'));
    const shouldHideTopPane = !hasProductTabs && !isMobileViewport;

    topPane.hidden = false;
    topPane.classList.toggle('top-pane--hidden', shouldHideTopPane);

    if (shouldHideTopPane) {
      document.body.classList.remove('mobile-top-pane-open');
    }

    syncBodyTopPaneState();
  }

  function getUrlActiveSlug() {
    try {
      const params = new URLSearchParams(window.location.search);
      const reqProduct = params.get('product');
      const reqCategory = params.get('category');
      const path = window.location.pathname.toLowerCase();

      if (reqProduct) return reqProduct;

      if (path.includes('filter-template.html') || path.includes('mobile-template.html') || path.includes('web-template.html')) {
        const cat = reqCategory || (path.includes('mobile-template') ? 'mobile' : (path.includes('web-template') ? 'web' : 'free-paid'));
        return buildFilterTabSlug(cat);
      }
    } catch {}
    return null;
  }

  function resolveActiveSlug(activeSlug, runtime, enableDefaultProductActive, openedProducts) {
    if (activeSlug !== undefined && activeSlug !== null) {
      return activeSlug;
    }
    if (runtime && runtime.activeSlug) {
      return runtime.activeSlug;
    }
    const urlSlug = getUrlActiveSlug();
    if (urlSlug) {
      return urlSlug;
    }
    if (enableDefaultProductActive && Array.isArray(openedProducts) && openedProducts.length) {
      return openedProducts[openedProducts.length - 1].slug;
    }
    return null;
  }

  function renderTabs(containerId, activeSlug, forceHomeActive, disableHomeAutoActive, enableDefaultProductActive) {
    const root = document.getElementById(containerId);
    if (!root) {
      return { activeResolved: null, openedProducts: [] };
    }

    const tabsWrapper = root.closest('.top-pane-tabs');
    const runtime = tabsWrapper ? tabsWrapper.__productTopPaneRuntime : null;

    const openedProducts = getOpenedProducts();
    const activeResolved = resolveActiveSlug(activeSlug, runtime, enableDefaultProductActive, openedProducts);

    if (runtime) {
      runtime.activeSlug = activeResolved;
    }

    root.innerHTML = openedProducts
      .map((product) => renderTab(product, product.slug === activeResolved))
      .join('');

    const homeTab = tabsWrapper ? tabsWrapper.querySelector('.top-pane-home-tab') : null;
    if (homeTab) {
      homeTab.classList.toggle('is-active', !activeResolved && (forceHomeActive || !disableHomeAutoActive));
    }

    syncTopPaneVisibilityFromWrapper(tabsWrapper);

    return { activeResolved, openedProducts };
  }

  function applyActiveState(containerId, activeSlug, forceHomeActive, disableHomeAutoActive, enableDefaultProductActive) {
    const root = document.getElementById(containerId);
    if (!root) return { activeResolved: null, openedProducts: [] };

    const tabsWrapper = root.closest('.top-pane-tabs');
    const runtime = tabsWrapper ? tabsWrapper.__productTopPaneRuntime : null;

    const openedProducts = getOpenedProducts();
    const activeResolved = resolveActiveSlug(activeSlug, runtime, enableDefaultProductActive, openedProducts);

    if (runtime) {
      runtime.activeSlug = activeResolved;
    }

    root.querySelectorAll('.top-pane-tab[data-product-slug]').forEach((tabNode) => {
      const slug = tabNode.getAttribute('data-product-slug') || '';
      tabNode.classList.toggle('is-active', slug === activeResolved);
    });

    const homeTab = tabsWrapper ? tabsWrapper.querySelector('.top-pane-home-tab') : null;
    if (homeTab) {
      homeTab.classList.toggle('is-active', !activeResolved && (forceHomeActive || !disableHomeAutoActive));
    }

    syncTopPaneVisibilityFromWrapper(tabsWrapper);

    return { activeResolved, openedProducts };
  }

  function hasTabForSlug(containerId, slug) {
    if (!slug) return false;
    const root = document.getElementById(containerId);
    if (!root) return false;

    return Array.from(root.querySelectorAll('.top-pane-tab[data-product-slug]'))
      .some((tabNode) => (tabNode.getAttribute('data-product-slug') || '') === slug);
  }

  function bindTopPaneClick(containerId, activeSlug, forceHomeActive, disableHomeAutoActive, enableDefaultProductActive) {
    const root = document.getElementById(containerId);
    if (!root) return;

    const tabsWrapper = root.closest('.top-pane-tabs');
    if (!tabsWrapper) return;

    const alreadyBound = tabsWrapper.dataset.productTopPaneBound === 'true';
    let initialState;

    if (alreadyBound) {
      if (hasTabForSlug(containerId, activeSlug)) {
        initialState = applyActiveState(
          containerId,
          activeSlug,
          forceHomeActive,
          disableHomeAutoActive,
          enableDefaultProductActive
        );
      } else {
        initialState = renderTabs(containerId, activeSlug, forceHomeActive, disableHomeAutoActive, enableDefaultProductActive);
      }
    } else {
      initialState = renderTabs(containerId, activeSlug, forceHomeActive, disableHomeAutoActive, enableDefaultProductActive);
    }

    tabsWrapper.__productTopPaneRuntime = {
      activeSlug,
      forceHomeActive,
      disableHomeAutoActive,
      enableDefaultProductActive,
      containerId,
      state: initialState,
    };

    if (alreadyBound) return;
    tabsWrapper.dataset.productTopPaneBound = 'true';

    tabsWrapper.addEventListener('click', (event) => {
      const runtime = tabsWrapper.__productTopPaneRuntime || {};
      const runtimeContainerId = runtime.containerId || containerId;
      const runtimeActiveSlug = Object.prototype.hasOwnProperty.call(runtime, 'activeSlug') ? runtime.activeSlug : activeSlug;
      const runtimeForceHomeActive = Object.prototype.hasOwnProperty.call(runtime, 'forceHomeActive') ? runtime.forceHomeActive : forceHomeActive;
      const runtimeDisableHomeAutoActive = Object.prototype.hasOwnProperty.call(runtime, 'disableHomeAutoActive') ? runtime.disableHomeAutoActive : disableHomeAutoActive;
      const runtimeEnableDefaultProductActive = Object.prototype.hasOwnProperty.call(runtime, 'enableDefaultProductActive') ? runtime.enableDefaultProductActive : enableDefaultProductActive;
      const runtimeState = runtime.state || { activeResolved: null };

      const closeButton = event.target.closest('.tab-close');
      if (closeButton) {
        const tabNode = closeButton.closest('.top-pane-tab');
        const closeSlug = tabNode ? tabNode.dataset.productSlug : '';
        if (!closeSlug || !tabNode) return;

        event.preventDefault();
        event.stopPropagation();

        const remainingSlugs = removeOpenedProductSlug(closeSlug);
        const isActiveDetailTab = (
          (!!runtimeActiveSlug && closeSlug === runtimeActiveSlug)
          || (!!runtimeState.activeResolved && closeSlug === runtimeState.activeResolved)
          || tabNode.classList.contains('is-active')
        );

        tabNode.classList.add('is-closing');

        if (isActiveDetailTab) {
          const fallbackSlug = remainingSlugs[remainingSlugs.length - 1];

          window.setTimeout(() => {
            runtime.state = renderTabs(
              runtimeContainerId,
              fallbackSlug || null,
              runtimeForceHomeActive,
              runtimeDisableHomeAutoActive,
              runtimeEnableDefaultProductActive
            );

            navigateTo(fallbackSlug ? buildTabUrl(fallbackSlug) : 'files.html');
          }, 220);
          return;
        }

        window.setTimeout(() => {
          runtime.state = renderTabs(
            runtimeContainerId,
            runtimeActiveSlug || runtimeState.activeResolved,
            runtimeForceHomeActive,
            runtimeDisableHomeAutoActive,
            runtimeEnableDefaultProductActive
          );
        }, 260);
        return;
      }

      const tabNode = event.target.closest('.top-pane-tab');
      if (!tabNode) return;

      const slug = tabNode.dataset.productSlug;
      if (!slug) return;

      event.preventDefault();

      if (tabsWrapper.__productTopPaneRuntime) {
        tabsWrapper.__productTopPaneRuntime.activeSlug = slug;
      }

      rememberOpenedProductSlug(slug, { skipRefresh: true });

      // Instantly highlight active tab in UI on click
      tabsWrapper.querySelectorAll('.top-pane-tab').forEach((t) => {
        t.classList.toggle('is-active', t.getAttribute('data-product-slug') === slug);
      });
      const homeTab = tabsWrapper.querySelector('.top-pane-home-tab');
      if (homeTab) homeTab.classList.remove('is-active');

      // Force layout recalculation to fix WebKit hover state invalidation bug
      void tabsWrapper.offsetHeight;

      const targetUrl = buildTabUrl(slug);
      
      // Yield to the browser to paint the active state before heavy navigation
      setTimeout(() => {
        navigateTo(targetUrl);
      }, 0);
    });
  }

  function bindTopPaneAdd() {
    const addButton = document.querySelector('.top-pane-add');
    if (!addButton || addButton.dataset.productTopPaneAddBound === 'true') return;
    addButton.dataset.productTopPaneAddBound = 'true';
    addButton.addEventListener('click', () => {
      navigateTo('files.html');
    });
  }

  function bindMobileSidebarMenu() {
    const menuButtons = Array.from(document.querySelectorAll('.top-pane-mobile-menu'));
    if (!menuButtons.length) return;

    const topPane = document.querySelector('.top-pane');
    if (!topPane) return;

    let shell = document.getElementById('mobile-top-pane-shell');
    let panel = shell ? shell.querySelector('.top-pane-mobile-panel') : null;

    function escapeMobileText(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function caretIconMarkup() {
      return '<span class="top-pane-mobile-community-caret" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.40292 12.9517C8.20312 13.2236 7.79688 13.2236 7.59708 12.9517L2.52278 6.04607C2.28014 5.71586 2.51593 5.25 2.9257 5.25L13.0743 5.25C13.4841 5.25 13.7199 5.71586 13.4772 6.04607L8.40292 12.9517Z" fill="currentColor"/></svg></span>';
    }

    function renderMobileLinkRow(options) {
      const item = options || {};
      return `
            <a class="top-pane-mobile-community-item top-pane-mobile-community-row" href="${item.href || '#'}">
              <span class="top-pane-mobile-community-label">${escapeMobileText(item.label || '')}</span>
            </a>`;
    }

    function renderMobileGroupRow(options) {
      const item = options || {};
      const children = Array.isArray(item.children) ? item.children : [];
      const groupId = escapeMobileText(item.id || `group-${Math.random().toString(36).slice(2)}`);

      const childRows = children.map((child) => {
        if (child.type === 'theme-option') {
          return `
            <button class="top-pane-mobile-community-subrow" type="button" data-mobile-theme-option="${escapeMobileText(child.theme || 'dark')}">
              ${escapeMobileText(child.label || '')}
            </button>`;
        }

        if (child.type === 'layout-option') {
          return `
            <button class="top-pane-mobile-community-subrow" type="button" data-mobile-layout-option="${escapeMobileText(child.mode || 'classic')}">
              ${escapeMobileText(child.label || '')}
            </button>`;
        }

        return `
            <a class="top-pane-mobile-community-subrow" href="${child.href || '#'}">
              ${escapeMobileText(child.label || '')}
            </a>`;
      }).join('');

      return `
            <div class="top-pane-mobile-community-group" data-mobile-group="${groupId}">
              <button
                class="top-pane-mobile-community-item top-pane-mobile-community-row top-pane-mobile-community-group-trigger"
                type="button"
                data-mobile-group-toggle="${groupId}"
                aria-expanded="false"
              >
                <span class="top-pane-mobile-community-label">${escapeMobileText(item.label || '')}</span>
                ${caretIconMarkup()}
              </button>
              <div class="top-pane-mobile-community-submenu" data-mobile-group-submenu="${groupId}" hidden>
                <div class="top-pane-mobile-community-submenu-inner">
                  ${childRows}
                </div>
              </div>
            </div>`;
    }

    function renderMobileActionRow(options) {
      const item = options || {};
      return `
            <button class="top-pane-mobile-community-item top-pane-mobile-community-row" type="button" data-mobile-action="${escapeMobileText(item.action || '')}">
              <span class="top-pane-mobile-community-label">${escapeMobileText(item.label || '')}</span>
            </button>`;
    }

    function renderMobilePanel() {
      const authService = window.FirebaseAuthService;
      const currentUser = authService && typeof authService.getCurrentUser === 'function'
        ? authService.getCurrentUser()
        : null;
      const hasUser = Boolean(currentUser);
      const currentUserEmail = currentUser && currentUser.email
        ? String(currentUser.email).trim().toLowerCase()
        : '';
      const canAccessAdminConsole = currentUserEmail === SITE_SUPER_ADMIN_EMAIL;
      const authAction = hasUser ? 'logout' : 'login';
      const authLabel = hasUser ? 'Log out' : 'Login';

      const menuRows = [
        renderMobileLinkRow({ href: 'files.html', label: 'Home' }),
        renderMobileGroupRow({
          id: 'design-templates',
          label: 'Design Templates',
          children: [
            { href: 'mobile-template.html', label: 'Mobile Templates' },
            { href: 'web-template.html', label: 'Web Templates' },
          ],
        }),
        renderMobileGroupRow({
          id: 'design-posts',
          label: 'Design Posts',
          children: [
            { href: 'my-post.html?category=mobile-posts', label: 'Mobile Posts' },
            { href: 'my-post.html?category=web-posts', label: 'Web Posts' },
            { href: 'my-post.html', label: 'Mobile & Web Posts' },
          ],
        }),
        renderMobileLinkRow({ href: 'about-me.html', label: 'About Me' }),
        renderMobileGroupRow({
          id: 'change-theme',
          label: 'Change Theme',
          children: [
            { type: 'theme-option', theme: 'light', label: 'Light' },
            { type: 'theme-option', theme: 'dark', label: 'Dark' },
            { type: 'theme-option', theme: 'system', label: 'System' },
          ],
        }),
        renderMobileGroupRow({
          id: 'settings',
          label: 'Settings',
          children: [
            { type: 'layout-option', mode: 'classic', label: 'Classic' },
            { type: 'layout-option', mode: 'float', label: 'Float' },
          ],
        }),
        renderMobileLinkRow({ href: 'saved-templates.html', label: 'Saved Templates' }),
        renderMobileLinkRow({ href: '/updates/', label: 'Release Updates' }),
      ];

      if (canAccessAdminConsole) {
        menuRows.push(
          renderMobileGroupRow({
            id: 'admin-console',
            label: 'Admin Console',
            children: [
              { href: '/ADMIN-PAGE/admin.html', label: 'Manage Products' },
              { href: '/updates/admin.html', label: 'Manage Releases' },
            ],
          })
        );
      }

      menuRows.push(renderMobileActionRow({ action: authAction, label: authLabel }));
      const rows = menuRows.join('');

      panel.innerHTML = `
        <div class="top-pane-mobile-panel-header">
          <!-- <span class="top-pane-mobile-panel-brand" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_89_5567)">
                <path d="M20.3125 0H5.6875C2.54638 0 0 2.54638 0 5.6875V20.3125C0 23.4536 2.54638 26 5.6875 26H20.3125C23.4536 26 26 23.4536 26 20.3125V5.6875C26 2.54638 23.4536 0 20.3125 0Z" fill="#5C4AE4"/>
                <path d="M10.7143 10.4286L10.1714 9.25711L9.00001 8.71427L10.1714 8.1714L10.7143 7L11.2572 8.1714L12.4286 8.71427L11.2572 9.25711L10.7143 10.4286ZM17.2857 17L16.7429 15.8286L15.5714 15.2857L16.7429 14.7428L17.2857 13.5714L17.8286 14.7428L19 15.2857L17.8286 15.8286L17.2857 17ZM8.77142 18.8286L7.17144 17.2285C7.05715 17.1143 7 16.9762 7 16.8143C7 16.6524 7.05715 16.5143 7.17144 16.4L13.5429 10.0286C13.6571 9.91427 13.7952 9.85713 13.9571 9.85713C14.119 9.85713 14.2572 9.91427 14.3714 10.0286L15.9714 11.6285C16.0857 11.7428 16.1429 11.8809 16.1429 12.0428C16.1429 12.2047 16.0857 12.3429 15.9714 12.4571L9.59999 18.8286C9.48573 18.9429 9.34761 19 9.1857 19C9.0238 19 8.88571 18.9429 8.77142 18.8286ZM9.2 17.6286L13.2857 13.5143L12.4857 12.7143L8.37143 16.8L9.2 17.6286Z" fill="white"/>
                <path opacity="0.95" d="M17.5691 8.82759L18.1568 10.0959L18.7446 8.82759L20.0128 8.23982L18.7446 7.65206L18.1568 6.38379L17.5691 7.65206L16.3008 8.23982L17.5691 8.82759Z" fill="white"/>
                <path opacity="0.34" d="M19.8997 12.1267L20.1054 12.5706L20.3111 12.1267L20.755 11.921L20.3111 11.7153L20.1054 11.2714L19.8997 11.7153L19.4558 11.921L19.8997 12.1267Z" fill="white"/>
              </g>
              <defs>
                <clipPath id="clip0_89_5567">
                  <rect width="26" height="26" rx="13" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </span> -->
          <button class="top-pane-mobile-panel-close" type="button" data-mobile-panel-close="true" aria-label="Close mobile menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <nav class="top-pane-mobile-community-list" aria-label="Mobile menu">
          ${rows}
        </nav>`;
    }

    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'top-pane-mobile-shell';
      shell.id = 'mobile-top-pane-shell';
      shell.hidden = true;
      shell.innerHTML = '<div class="top-pane-mobile-backdrop"></div>';
      document.body.append(shell);
    }

    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'top-pane-mobile-panel';
      panel.id = 'mobile-top-pane-panel';
      panel.hidden = true;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', 'Mobile menu');
      shell.append(panel);
    }

    renderMobilePanel();

    if (panel.dataset.mobileCloseBound !== 'true') {
      panel.dataset.mobileCloseBound = 'true';
      panel.addEventListener('click', (event) => {
        if (!event.target.closest('[data-mobile-panel-close="true"]')) return;
        event.preventDefault();
        event.stopPropagation();
        setMobileMenuOpen(false);
      });
    }

    if (panel.dataset.mobileActionsBound !== 'true') {
      panel.dataset.mobileActionsBound = 'true';

      function expandMobileSubmenu(groupTrigger, submenu) {
        groupTrigger.setAttribute('aria-expanded', 'true');
        submenu.hidden = false;
        window.requestAnimationFrame(() => {
          submenu.classList.add('is-open');
        });
      }

      function collapseMobileSubmenu(groupTrigger, submenu) {
        groupTrigger.setAttribute('aria-expanded', 'false');
        submenu.classList.remove('is-open');

        const onEnd = (event) => {
          if (event.propertyName !== 'grid-template-rows') return;
          if (groupTrigger.getAttribute('aria-expanded') === 'true') return;
          submenu.hidden = true;
          submenu.removeEventListener('transitionend', onEnd);
        };

        submenu.addEventListener('transitionend', onEnd);
      }

      panel.addEventListener('click', async (event) => {
        const groupTrigger = event.target.closest('[data-mobile-group-toggle]');
        if (groupTrigger) {
          event.preventDefault();
          event.stopPropagation();

          const groupId = groupTrigger.getAttribute('data-mobile-group-toggle');
          const submenu = panel.querySelector(`[data-mobile-group-submenu="${groupId}"]`);
          if (!submenu) return;

          const isExpanded = groupTrigger.getAttribute('aria-expanded') === 'true';
          if (isExpanded) {
            collapseMobileSubmenu(groupTrigger, submenu);
          } else {
            expandMobileSubmenu(groupTrigger, submenu);
          }
          return;
        }

        const themeOption = event.target.closest('[data-mobile-theme-option]');
        if (themeOption) {
          event.preventDefault();
          event.stopPropagation();
          const theme = String(themeOption.getAttribute('data-mobile-theme-option') || '').trim();
          if (theme && window.ThemeManager && typeof window.ThemeManager.setTheme === 'function') {
            window.ThemeManager.setTheme(theme);
          }
          setMobileMenuOpen(false);
          return;
        }

        const layoutOption = event.target.closest('[data-mobile-layout-option]');
        if (layoutOption) {
          event.preventDefault();
          event.stopPropagation();
          const mode = String(layoutOption.getAttribute('data-mobile-layout-option') || '').trim();
          if (mode && window.FloatNav && typeof window.FloatNav.setMode === 'function') {
            window.FloatNav.setMode(mode);
          }
          setMobileMenuOpen(false);
          return;
        }

        const actionBtn = event.target.closest('[data-mobile-action]');
        if (!actionBtn) return;

        event.preventDefault();
        event.stopPropagation();
        const action = String(actionBtn.getAttribute('data-mobile-action') || '').trim();
        if (action !== 'login' && action !== 'logout') return;

        const authService = window.FirebaseAuthService;
        if (!authService) {
          setMobileMenuOpen(false);
          return;
        }

        try {
          if (action === 'logout') {
            if (typeof authService.logout === 'function') {
              await authService.logout();
            }
          } else if (typeof authService.loginWithGoogle === 'function') {
            await authService.loginWithGoogle({ method: 'popup' });
          }
        } catch (error) {
          window.alert(error && error.message ? error.message : 'Authentication failed. Please try again.');
        }

        setMobileMenuOpen(false);
      });
    }

    function setMobileMenuOpen(isOpen) {
      if (isOpen) {
        renderMobilePanel();
      }
      shell.hidden = !isOpen;
      panel.hidden = !isOpen;
      document.body.classList.toggle('mobile-top-pane-open', isOpen);
      menuButtons.forEach((button) => {
        button.classList.toggle('is-open', isOpen);
        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    menuButtons.forEach((button) => {
      if (button.dataset.mobileSidebarBound === 'true') return;

      button.dataset.mobileSidebarBound = 'true';
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-expanded', 'false');

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMobileMenuOpen(panel.hidden);
      });
    });

    if (window.__mobileSidebarGlobalBound) return;
    window.__mobileSidebarGlobalBound = true;

    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('mobile-top-pane-open')) return;
      if (event.target.closest('.top-pane-mobile-panel a')) {
        setMobileMenuOpen(false);
      }
    });

    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('mobile-top-pane-open')) return;
      if (event.target.closest('.top-pane-mobile-menu')) return;
      if (event.target.closest('.top-pane-mobile-panel')) return;
      setMobileMenuOpen(false);
    });

    shell.addEventListener('click', (event) => {
      if (!document.body.classList.contains('mobile-top-pane-open')) return;
      if (event.target.closest('.top-pane-mobile-panel')) return;
      setMobileMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('mobile-top-pane-open')) {
        setMobileMenuOpen(false);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > MOBILE_TOP_PANE_BREAKPOINT && document.body.classList.contains('mobile-top-pane-open')) {
        setMobileMenuOpen(false);
      }

      Array.from(document.querySelectorAll('.top-pane-tabs')).forEach((tabsWrapper) => {
        syncTopPaneVisibilityFromWrapper(tabsWrapper);
      });
    });
  }

  function init(options) {
    const {
      containerId,
      activeSlug = null,
      forceHomeActive = false,
      disableHomeAutoActive = false,
      enableDefaultProductActive = true,
    } = options || {};
    if (!containerId) return;

    if (activeSlug) {
      rememberOpenedProductSlug(activeSlug);
    }

    let initialized = false;
    function doInit() {
      if (initialized) return;
      initialized = true;
      bindTopPaneClick(containerId, activeSlug, forceHomeActive, disableHomeAutoActive, enableDefaultProductActive);
      bindTopPaneAdd();
      bindMobileSidebarMenu();
    }

    document.addEventListener('app:layoutReady', doInit, { once: true });

    // Safety fallback in case a page forgets to dispatch
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(doInit, 1000));
    } else {
      setTimeout(doInit, 1000);
    }
  }

  function refreshAll() {
    const wrappers = Array.from(document.querySelectorAll('.top-pane-tabs'));

    wrappers.forEach((tabsWrapper) => {
      const runtime = tabsWrapper.__productTopPaneRuntime;
      if (!runtime || !runtime.containerId) return;

      const runtimeContainerId = runtime.containerId;
      const runtimeActiveSlug = Object.prototype.hasOwnProperty.call(runtime, 'activeSlug') ? runtime.activeSlug : null;
      const runtimeForceHomeActive = Boolean(runtime.forceHomeActive);
      const runtimeDisableHomeAutoActive = Boolean(runtime.disableHomeAutoActive);
      const runtimeEnableDefaultProductActive = Object.prototype.hasOwnProperty.call(runtime, 'enableDefaultProductActive')
        ? Boolean(runtime.enableDefaultProductActive)
        : true;

      runtime.state = renderTabs(
        runtimeContainerId,
        runtimeActiveSlug,
        runtimeForceHomeActive,
        runtimeDisableHomeAutoActive,
        runtimeEnableDefaultProductActive
      );
    });

    syncBodyTopPaneState();

    bindMobileSidebarMenu();
  }

  window.ProductTopPaneTabs = {
    init,
    refreshAll,
    getOpenedProductSlugs,
    setOpenedProductSlugs,
    rememberOpenedProductSlug,
    buildFilterTabSlug,
  };

  document.addEventListener('products:updated', () => {
    refreshAll();
  });

  window.addEventListener('pageshow', (event) => {
    if (event && event.persisted) {
      refreshAll();
    }
  });
})();