// main-shell-router.js: keep sidebar/top-pane mounted and replace only main content.
(function initMainShellRouter() {
  const SHELL_PAGES = new Set(['files.html', 'discover-templates.html', 'my-post.html', 'filter-template.html', 'mobile-template.html', 'web-template.html', 'saved-templates.html', 'about-me.html', 'product-detail.html', 'my-post-detail.html', 'recents.html']);
  const CARD_ONLY_SKELETON_PAGES = new Set(['files.html', 'discover-templates.html', 'my-post.html']);
  const MIN_SKELETON_VISIBLE_MS = 0;
  let navigationToken = 0;

  function hasCacheSync() {
    return Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
  }

  function getPageNameFromPath(pathname) {
    const parts = String(pathname || '').split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function getPageNameFromUrl(urlLike) {
    const target = new URL(urlLike, window.location.href);
    return getPageNameFromPath(target.pathname);
  }

  function isShellPageUrl(urlLike) {
    return SHELL_PAGES.has(getPageNameFromUrl(urlLike));
  }

  function shouldHandleAnchor(event, anchor) {
    if (!anchor) return false;
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.getAttribute('data-shell-nav') === 'off') return false;

    const target = anchor.getAttribute('target');
    if (target && target !== '_self') return false;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#')) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;

    const targetUrl = new URL(anchor.href, window.location.href);
    if (targetUrl.origin !== window.location.origin) return false;
    if (!isShellPageUrl(targetUrl.href)) return false;

    return true;
  }

  function syncPageStyles(nextDoc) {
    const head = document.head;
    const currentPageStyles = Array.from(head.querySelectorAll('link[rel="stylesheet"][data-page-style]'));
    const nextPageStyles = Array.from(nextDoc.querySelectorAll('head link[rel="stylesheet"][data-page-style]'));

    const toAbsoluteHref = (href) => {
      try {
        return new URL(href || '', window.location.href).href;
      } catch (error) {
        return String(href || '');
      }
    };

    const currentByHref = new Map();
    currentPageStyles.forEach((node) => {
      const href = toAbsoluteHref(node.getAttribute('href'));
      if (href && !currentByHref.has(href)) {
        currentByHref.set(href, node);
      }
    });

    const nextHrefSet = new Set(
      nextPageStyles
        .map((node) => toAbsoluteHref(node.getAttribute('href')))
        .filter(Boolean),
    );

    const loadPromises = nextPageStyles.map((link) => {
      const rawHref = link.getAttribute('href') || '';
      const absoluteHref = toAbsoluteHref(rawHref);

      if (!absoluteHref || currentByHref.has(absoluteHref)) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const node = document.createElement('link');
        node.rel = 'stylesheet';
        node.href = rawHref;
        node.setAttribute('data-page-style', 'true');

        node.addEventListener('load', resolve, { once: true });
        node.addEventListener('error', resolve, { once: true });

        head.appendChild(node);
      });
    });

    return Promise.all(loadPromises).then(() => {
      currentPageStyles.forEach((node) => {
        const href = toAbsoluteHref(node.getAttribute('href'));
        if (!nextHrefSet.has(href)) {
          node.remove();
        }
      });
    });
  }

  function syncSidebar(nextDoc) {
    const sidebarPlaceholder = nextDoc.querySelector('[data-sidebar-root]');
    const nextActiveKey = sidebarPlaceholder ? sidebarPlaceholder.getAttribute('data-sidebar-active') : 'discover';

    if (!window.SidebarComponent || typeof window.SidebarComponent.renderSidebar !== 'function') {
      return;
    }

    const currentSidebar = document.querySelector('.layout > .sidebar');
    if (!currentSidebar) return;

    const variant = currentSidebar.classList.contains('sidebar--tablet') ? 'tablet' : '';
    currentSidebar.outerHTML = window.SidebarComponent.renderSidebar({
      activeKey: nextActiveKey || 'discover',
      variant,
    });

    if (typeof window.SidebarComponent.bindSidebarInteractions === 'function') {
      window.SidebarComponent.bindSidebarInteractions(document);
    }
  }

  function runPageModule(pageName) {
    const modules = window.PageModules || {};
    const init = modules[pageName];
    if (typeof init === 'function') {
      init();
    }
  }

  function getGridSkeletonCardCount() {
    if (window.innerWidth <= 1000) return 3;
    if (window.innerWidth <= 1180) return 4;
    return 8;
  }

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

  function applyCardOnlySkeletonToNextMain(nextMain, pageName) {
    if (!nextMain || !CARD_ONLY_SKELETON_PAGES.has(pageName)) return false;

    const cardCount = getGridSkeletonCardCount();
    const markup = buildProductCardSkeletonMarkup(cardCount);
    const gridSelectors = ['#free-templates-grid', '#recent-templates-grid', '#recents-grid'];
    let hasSkeletonizedGrid = false;

    gridSelectors.forEach((selector) => {
      const grid = nextMain.querySelector(selector);
      if (!grid) return;

      grid.innerHTML = markup;
      hasSkeletonizedGrid = true;
    });

    return hasSkeletonizedGrid;
  }

  function buildMainSkeletonContent(pageName) {
    if (pageName === 'about-me.html') {
      return `
        <div class="main-shell-skeleton-about-intro">
          <div class="main-shell-skeleton-about-copy">
            <span class="main-shell-skeleton-block main-shell-skeleton-chip main-shell-skeleton-chip--lg"></span>
            <span class="main-shell-skeleton-block main-shell-skeleton-line main-shell-skeleton-line--lg"></span>
            <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
            <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
          </div>
          <span class="main-shell-skeleton-block main-shell-skeleton-about-photo"></span>
        </div>
        <div class="main-shell-skeleton-lines">
          <span class="main-shell-skeleton-block main-shell-skeleton-line main-shell-skeleton-line--lg"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
        </div>
        <div class="main-shell-skeleton-grid main-shell-skeleton-grid--about-tools">
          <span class="main-shell-skeleton-block main-shell-skeleton-card main-shell-skeleton-card--tool"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-card main-shell-skeleton-card--tool"></span>
        </div>`;
    }

    if (pageName === 'my-post.html') {
      return `
        <div class="main-shell-skeleton-top">
          <span class="main-shell-skeleton-block main-shell-skeleton-chip main-shell-skeleton-chip--lg"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-chip"></span>
        </div>
        <div class="main-shell-skeleton-block main-shell-skeleton-hero"></div>
        <div class="main-shell-skeleton-grid main-shell-skeleton-grid--posts">
          <span class="main-shell-skeleton-block main-shell-skeleton-card main-shell-skeleton-card--post"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-card main-shell-skeleton-card--post"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-card main-shell-skeleton-card--post"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-card main-shell-skeleton-card--post"></span>
        </div>`;
    }

    if (pageName === 'filter-template.html' || pageName === 'mobile-template.html' || pageName === 'web-template.html') {
      return `
        <div class="main-shell-skeleton-header-row">
          <span class="main-shell-skeleton-block main-shell-skeleton-line main-shell-skeleton-line--lg"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-chip"></span>
        </div>
        <div class="main-shell-skeleton-top">
          <span class="main-shell-skeleton-block main-shell-skeleton-chip"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-chip"></span>
        </div>
        <div class="main-shell-skeleton-block main-shell-skeleton-hero main-shell-skeleton-hero--filter"></div>
        <div class="main-shell-skeleton-grid main-shell-skeleton-grid--filter">
          <span class="main-shell-skeleton-block main-shell-skeleton-card"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-card"></span>
          <span class="main-shell-skeleton-block main-shell-skeleton-card"></span>
        </div>`;
    }

    return `
      <div class="main-shell-skeleton-top">
        <span class="main-shell-skeleton-block main-shell-skeleton-chip main-shell-skeleton-chip--lg"></span>
        <span class="main-shell-skeleton-block main-shell-skeleton-chip"></span>
        <span class="main-shell-skeleton-block main-shell-skeleton-chip"></span>
      </div>
      <div class="main-shell-skeleton-block main-shell-skeleton-hero"></div>
      <div class="main-shell-skeleton-grid">
        <span class="main-shell-skeleton-block main-shell-skeleton-card"></span>
        <span class="main-shell-skeleton-block main-shell-skeleton-card"></span>
        <span class="main-shell-skeleton-block main-shell-skeleton-card"></span>
      </div>
      <div class="main-shell-skeleton-lines">
        <span class="main-shell-skeleton-block main-shell-skeleton-line main-shell-skeleton-line--lg"></span>
        <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
        <span class="main-shell-skeleton-block main-shell-skeleton-line"></span>
      </div>`;
  }

  function buildMainSkeletonMarkup(pageName) {
    const variantName = String(pageName || 'files.html').replace('.html', '');
    const safeVariant = variantName.replace(/[^a-z0-9-]/gi, '').toLowerCase();

    return `
      <div class="main-shell-skeleton main-shell-skeleton--${safeVariant}" data-skeleton-page="${pageName}" aria-hidden="true">
        ${buildMainSkeletonContent(pageName)}
      </div>`;
  }

  function showMainSkeleton(pageName) {
    const main = document.querySelector('.layout .main');
    if (!main) return null;

    let overlay = main.querySelector(':scope > .main-shell-skeleton');
    if (!overlay) {
      main.insertAdjacentHTML('beforeend', buildMainSkeletonMarkup(pageName));
      overlay = main.querySelector(':scope > .main-shell-skeleton');
    } else {
      overlay.remove();
      main.insertAdjacentHTML('beforeend', buildMainSkeletonMarkup(pageName));
      overlay = main.querySelector(':scope > .main-shell-skeleton');
    }

    main.classList.add('main-shell-loading');
    main.setAttribute('aria-busy', 'true');
    return main;
  }

  function hideMainSkeleton(main) {
    if (!main || !main.isConnected) return;

    const overlay = main.querySelector(':scope > .main-shell-skeleton');
    if (overlay) {
      overlay.remove();
    }

    main.classList.remove('main-shell-loading');
    main.removeAttribute('aria-busy');
  }

  function waitForAnimationFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  function waitForMinimumSkeletonTime(startTime) {
    const elapsed = performance.now() - startTime;
    const remaining = MIN_SKELETON_VISIBLE_MS - elapsed;
    if (remaining <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.setTimeout(resolve, remaining);
    });
  }

  async function navigate(urlLike, options) {
    const opts = options || {};
    const targetUrl = new URL(urlLike, window.location.href);
    const targetPageName = getPageNameFromPath(targetUrl.pathname);
    const useCardOnlySkeleton = CARD_ONLY_SKELETON_PAGES.has(targetPageName);
    let hasSwappedMain = false;
    let loadingMain = null;

    if (targetUrl.origin !== window.location.origin) {
      window.location.href = targetUrl.href;
      return false;
    }

    if (!isShellPageUrl(targetUrl.href)) {
      window.location.href = targetUrl.href;
      return false;
    }

    if (!opts.force && targetUrl.href === window.location.href) {
      return true;
    }

    const token = ++navigationToken;

    const currentMainForOut = document.querySelector('.layout .main');
    if (currentMainForOut) {
      currentMainForOut.classList.add('main-shell-fade-out');
    }

    try {

      const fetchPromise = fetch(targetUrl.href, {
        credentials: 'same-origin',
        headers: {
          'X-Main-Shell': '1',
        },
      });
      const fadePromise = new Promise((resolve) => setTimeout(resolve, 200));

      const [response] = await Promise.all([fetchPromise, fadePromise]);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${targetUrl.href}`);
      }

      const html = await response.text();
      if (token !== navigationToken) return false;

      const nextDoc = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = nextDoc.querySelector('.layout .main');
      const currentMain = document.querySelector('.layout .main');

      if (!nextMain || !currentMain) {
        throw new Error('Missing shell main element');
      }

      if (typeof window.__pageCleanup === 'function') {
        window.__pageCleanup();
      }

      await syncPageStyles(nextDoc);
      if (token !== navigationToken) return false;

      nextMain.classList.add('main-shell-fade-in');
      currentMain.replaceWith(nextMain);
      hasSwappedMain = true;
      syncSidebar(nextDoc);
      document.title = nextDoc.title || document.title;

      if (!opts.fromPopState) {
        window.history.pushState({ shell: true }, '', targetUrl.href);
      }

      try {
        runPageModule(targetPageName);
      } catch (moduleError) {
        console.error('Shell page module init failed:', moduleError);
      }
      window.dispatchEvent(new CustomEvent('main-shell:navigated', {
        detail: {
          pageName: targetPageName,
          url: targetUrl.href,
        },
      }));

      return true;
    } catch (error) {
      if (!hasSwappedMain) {
        window.location.href = targetUrl.href;
      } else {
        console.error('Shell navigation failed after main swap:', error);
      }
      return false;
    } finally {
      // Skeletons are no longer shown during routing
    }
  }

  function bindLinkInterception() {
    if (document.body.dataset.mainShellRouterBound === 'true') return;
    document.body.dataset.mainShellRouterBound = 'true';

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') || '';
      const fullHref = anchor.href || '';

      if (rawHref.indexOf('MOTVIN/') !== -1 || fullHref.indexOf('/MOTVIN/') !== -1) {
        event.preventDefault();
        event.stopPropagation();

        const targetUrl = rawHref || fullHref;
        if (typeof window.openWorkspaceInMain === 'function') {
          window.openWorkspaceInMain(targetUrl);
        } else {
          window.location.href = targetUrl;
        }
        return;
      }

      if (!shouldHandleAnchor(event, anchor)) return;

      event.preventDefault();
      navigate(anchor.href);
    }, true);

    window.addEventListener('popstate', () => {
      const workspaceUrl = new URLSearchParams(window.location.search).get('workspace');
      if (workspaceUrl && typeof window.openWorkspaceInMain === 'function') {
        window.openWorkspaceInMain(workspaceUrl);
        return;
      }
      navigate(window.location.href, { fromPopState: true, force: true });
    });
  }

  window.MainShellRouter = {
    isShellPageUrl,
    navigate,
  };

  bindLinkInterception();
})();
