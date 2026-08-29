(function () {
  'use strict';

  const PAGE_NAME = 'saved-templates.html';
  const SAVED_STORAGE_KEY = 'savedProductSlugs';

  /* ── Helpers ─────────────────────────────────────────────── */

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function getSavedSlugs() {
    try {
      const raw = window.localStorage.getItem(SAVED_STORAGE_KEY) || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function getProductType(product) {
    if (window.ProductDataSource && typeof window.ProductDataSource.normalizeProductType === 'function') {
      return window.ProductDataSource.normalizeProductType(product.type) || 'template';
    }
    const raw = String(product.type || '').trim().toLowerCase();
    if (raw === 'design-post' || raw === 'design_post' || raw === 'post') return 'design-post';
    return 'template';
  }

  function renderCard(product) {
    const type = getProductType(product);
    if (type === 'design-post' && window.ProductCard && typeof window.ProductCard.designPost === 'function') {
      return window.ProductCard.designPost(product);
    }
    if (window.ProductCard && typeof window.ProductCard.template === 'function') {
      return window.ProductCard.template(product);
    }
    return '';
  }

  /* ── DOM helpers ─────────────────────────────────────────── */

  function showLoading(visible) {
    const el = document.getElementById('saved-loading-state');
    if (el) {
      el.hidden = !visible;
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
  }

  function showEmpty(visible) {
    const el = document.getElementById('saved-empty-state');
    if (el) el.hidden = !visible;
  }

  function updatePageCount(count) {
    const el = document.getElementById('saved-templates-count');
    if (!el) return;
    el.textContent = String(count);
    el.hidden = count === 0;
  }

  /* ── Update profile menu count badge (all pages) ─────────── */

  function updateMenuCountBadges(count) {
    document.querySelectorAll('[data-saved-count-badge="true"]').forEach((badge) => {
      badge.textContent = String(count);
      badge.style.opacity = count > 0 ? '1' : '0';
    });
  }

  function syncSavedCount() {
    const slugs = getSavedSlugs();
    updateMenuCountBadges(slugs.length);
  }

  /* ── Render ──────────────────────────────────────────────── */

  function renderGrid(products) {
    const grid = document.getElementById('saved-templates-grid');
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = '';
      showEmpty(true);
      updatePageCount(0);
      updateMenuCountBadges(0);
      return;
    }

    grid.innerHTML = products.map(renderCard).join('');
    showEmpty(false);
    updatePageCount(products.length);
    updateMenuCountBadges(products.length);
  }

  /* ── Load & render ───────────────────────────────────────── */

  async function loadAndRender() {
    const startTime = Date.now();
    const INITIAL_GRID_SKELETON_MS = 260;
    const isFirstBoot = !window.__motvin_spa_booted;
    window.__motvin_spa_booted = true;
    const hasCache = Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
    const isSavedLoading = isFirstBoot || !hasCache;

    if (isSavedLoading) {
      showLoading(true);
      const grid = document.getElementById('saved-templates-grid');
      if (grid) grid.innerHTML = '';
    }
    showEmpty(false);

    const savedSlugs = getSavedSlugs();

    if (!savedSlugs.length) {
      showLoading(false);
      showEmpty(true);
      updatePageCount(0);
      updateMenuCountBadges(0);
      document.dispatchEvent(new CustomEvent('app:layoutReady'));
      return;
    }

    try {
      const allProducts = await window.ProductDataSource.loadProducts({ forceRefresh: isFirstBoot });
      const productList = Array.isArray(allProducts) ? allProducts : [];

      // Preserve saved order (most recently saved first from product-detail.js push logic)
      const savedProducts = savedSlugs
        .map((slug) => productList.find((p) => p && p.slug === slug))
        .filter(Boolean);

      showLoading(false);
      renderGrid(savedProducts);
    } catch {
      showLoading(false);
      showEmpty(true);
      updatePageCount(0);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = isSavedLoading ? Math.max(300, INITIAL_GRID_SKELETON_MS - elapsed) : 0;
      window.setTimeout(() => {
        showLoading(false);
        document.dispatchEvent(new CustomEvent('app:layoutReady'));
      }, remaining);
    }
  }

  /* ── Entry point for this page ───────────────────────────── */

  function initPage() {
    loadAndRender();

    // Re-render when product stats or data update
    document.addEventListener('products:updated', loadAndRender);

    // Re-render when saved list changes from another tab/window
    window.addEventListener('storage', (event) => {
      if (event.key === SAVED_STORAGE_KEY) {
        loadAndRender();
      }
    });
  }

  /* ── Badge sync runs on ALL pages ────────────────────────── */

  function initBadgeSync() {
    // Sync after sidebar/float-nav has mounted (they render profile menus)
    function trySyncBadges() {
      if (document.querySelector('[data-saved-count-badge="true"]')) {
        syncSavedCount();
      }
    }

    // Try immediately and after DOMContentLoaded
    trySyncBadges();
    document.addEventListener('DOMContentLoaded', trySyncBadges);

    // Sidebar and float-nav mount async — also sync after a short delay
    window.setTimeout(trySyncBadges, 300);

    // Keep in sync when saved list changes
    window.addEventListener('storage', (event) => {
      if (event.key === SAVED_STORAGE_KEY) {
        syncSavedCount();
      }
    });
  }

  /* ── Boot ────────────────────────────────────────────────── */

  function boot() {
    initBadgeSync();

    if (getCurrentPageName() === PAGE_NAME) {
      initPage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
