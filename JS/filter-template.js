(function registerFilterTemplatePageModule() {
  const PAGE_NAME = 'filter-template.html';
  const GRID_SKELETON_COUNT = 8;
  const INITIAL_GRID_SKELETON_MS = 260;

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function templateCard(product) {
    if (window.ProductCard && typeof window.ProductCard.template === 'function') {
      return window.ProductCard.template(product);
    }

    return `
      <a class="product-card product-card--template" data-product-slug="${product.slug}" href="product-detail.html?product=${encodeURIComponent(product.slug)}">
        <div class="product-img-wrap"><img src="${product.image}" alt="${product.title}" /></div>
        <div class="product-info">
          <div class="product-meta">
            <span class="product-name">${product.title}</span>
            <div class="product-author"><span>By ${product.author}</span><span>•</span><span>${product.category}</span></div>
          </div>
          <span class="product-price">${product.price}</span>
        </div>
      </a>`;
  }

  const CATEGORY_CONFIGS = {
    free: {
      pageTitle: 'Discover All Free Templates',
      subtitle: 'Discover all free templates available in the marketplace.',
      headerSubtitle: 'Browse free-ready UI resources curated for fast design starts.',
      primaryFilterLabel: 'Free Templates',
      secondaryFilterLabel: 'Price: Free',
      sectionTitle: 'Free Templates',
      icon: 'ASSET/Icons/filter-free-paid-icon.svg',
      emptyMessage: 'No free templates are available right now.',
    },
    paid: {
      pageTitle: 'Discover All Paid Templates',
      subtitle: 'Discover all paid templates available in the marketplace.',
      headerSubtitle: 'Explore premium template collections crafted for production work.',
      primaryFilterLabel: 'Paid Templates',
      secondaryFilterLabel: 'Price: Paid',
      sectionTitle: 'Paid Templates',
      icon: 'ASSET/Icons/filter-free-paid-icon.svg',
      emptyMessage: 'No paid templates are available right now.',
    },
    'free-paid': {
      pageTitle: 'Discover All Free & Paid Templates',
      subtitle: 'Discover all free and paid templates in one place.',
      headerSubtitle: 'Find both free and premium assets in one streamlined template feed.',
      primaryFilterLabel: 'Free & Paid Templates',
      secondaryFilterLabel: 'All Templates',
      sectionTitle: 'Free & Paid Templates',
      icon: 'ASSET/Icons/filter-free-paid-icon.svg',
      emptyMessage: 'No templates are available right now.',
    },
    recent: {
      pageTitle: 'Discover All Recent Templates',
      subtitle: 'Discover all recent templates added to the marketplace.',
      headerSubtitle: 'Stay updated with the newest templates recently published by creators.',
      primaryFilterLabel: 'Recent Templates',
      secondaryFilterLabel: 'Recently Added',
      sectionTitle: 'Recent Templates',
      icon: 'ASSET/Icons/filter-all-templates-icon.svg',
      emptyMessage: 'No recent templates are available right now.',
    },
  };

  function normalizeCategory(rawCategory) {
    const normalized = String(rawCategory || '')
      .trim()
      .toLowerCase()
      .replaceAll('&', 'and')
      .replace(/[^a-z0-9]+/g, '-');

    if (!normalized) return 'free-paid';
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

  function isFreeTemplate(product) {
    const price = String(product.price || '').trim().toLowerCase();
    if (!price) return false;

    if (price.includes('free')) return true;

    const numeric = Number(price.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(numeric) && numeric === 0) return true;

    return false;
  }

  function getTemplateProducts() {
    if (window.ProductDataSource && typeof window.ProductDataSource.getProductsByType === 'function') {
      return window.ProductDataSource.getProductsByType('template');
    }
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function getTemplatesForCategory(category) {
    const templateProducts = getTemplateProducts();
    if (!templateProducts.length) return [];

    switch (category) {
      case 'free':
        return templateProducts.filter((product) => isFreeTemplate(product));
      case 'paid':
        return templateProducts.filter((product) => !isFreeTemplate(product));
      case 'recent':
        return templateProducts.slice(0, 12);
      case 'free-paid':
      default:
        return templateProducts.slice();
    }
  }

  function matchesSearch(product, query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return true;

    const haystack = [
      product.title,
      product.author,
      product.category,
      product.summary,
      product.description,
      (product.tags || []).join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalized);
  }

  function buildProductCardSkeletonMarkup(count) {
    const total = Number(count) > 0 ? Number(count) : GRID_SKELETON_COUNT;
    return Array.from({ length: total }).map(() => `
      <article class="main-shell-product-card-skeleton" aria-hidden="true">
        <span class="main-shell-product-card-skeleton-media"></span>
        <span class="main-shell-product-card-skeleton-body">
          <span class="main-shell-product-card-skeleton-line main-shell-product-card-skeleton-line--title"></span>
          <span class="main-shell-product-card-skeleton-line main-shell-product-card-skeleton-line--meta"></span>
        </span>
      </article>`).join('');
  }

  function setEmptyStateVisibility(options) {
    const {
      emptyState,
      emptyStateTitle,
      emptyStateMessage,
      config,
      query,
      resultCount,
      isWholePageEmpty,
      isLoading,
    } = options;

    if (!emptyState) return;

    if (emptyStateTitle) {
      emptyStateTitle.textContent = query ? 'No Search Results' : `No ${config.primaryFilterLabel} Found`;
    }
    if (emptyStateMessage) {
      emptyStateMessage.textContent = query
        ? `No templates found for "${query}" in this category.`
        : config.emptyMessage;
    }

    if (isLoading && !query) {
      emptyState.hidden = true;
      return;
    }

    if (resultCount > 0) {
      emptyState.hidden = true;
      return;
    }

    const shouldShowSearchEmpty = Boolean(query);
    const shouldShowPageEmpty = !query && isWholePageEmpty;
    emptyState.hidden = !(shouldShowSearchEmpty || shouldShowPageEmpty);
  }

  function initFilterTemplatePage() {
    if (getCurrentPageName() !== PAGE_NAME) return;

    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
    }

    const controller = new AbortController();
    const { signal } = controller;

    const filterParams = new URLSearchParams(window.location.search);
    const selectedCategory = normalizeCategory(filterParams.get('category'));
    const activeFilterTabSlug = `filter:${selectedCategory}`;
    const filterSearchInput = document.getElementById('template-search-input');
    const isFirstBoot = !window.__motvin_spa_booted;
    const hasCache = Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
    let isTemplatesLoading = isFirstBoot || !hasCache;
    const initialLoadingStartedAt = Date.now();
    let hasFinalizedInitialLoading = false;



    if (!filterParams.get('category') || normalizeCategory(filterParams.get('category')) !== filterParams.get('category')) {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set('category', selectedCategory);
      window.history.replaceState({}, '', `${window.location.pathname}?${nextParams.toString()}`);
    }

    function applyCategoryState(category) {
      const config = CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS['free-paid'];
      const templates = getTemplatesForCategory(category);
      const isWholePageEmpty = getTemplateProducts().length === 0;

      const pageTitle = document.getElementById('filter-page-title');
      const detailFrameTitle = document.getElementById('detail-frame-title');
      const detailFrameSubtitle = document.getElementById('detail-frame-subtitle');
      const pageSubtitle = document.getElementById('filter-page-subtitle');
      const primaryLabel = document.getElementById('filter-primary-label');
      const secondaryLabel = document.getElementById('filter-secondary-label');
      const sectionIcon = document.getElementById('filter-section-icon');
      const sectionTitle = document.getElementById('filter-section-title');
      const sectionCount = document.getElementById('filter-section-count');
      const templatesGrid = document.getElementById('filter-templates-grid');
      const emptyState = document.getElementById('filter-empty-state');
      const emptyStateTitle = document.getElementById('filter-empty-title');
      const emptyStateMessage = document.getElementById('filter-empty-state-message');

      if (pageTitle) pageTitle.textContent = config.pageTitle;
      if (detailFrameTitle) detailFrameTitle.textContent = config.primaryFilterLabel;
      if (detailFrameSubtitle) detailFrameSubtitle.textContent = config.headerSubtitle || config.subtitle;
      if (pageSubtitle) pageSubtitle.textContent = config.subtitle;
      if (primaryLabel) primaryLabel.textContent = config.primaryFilterLabel;
      if (secondaryLabel) secondaryLabel.textContent = config.secondaryFilterLabel;
      if (sectionIcon) sectionIcon.src = config.icon;
      if (sectionTitle) sectionTitle.textContent = config.sectionTitle;
      if (sectionCount) {
        sectionCount.textContent = isTemplatesLoading ? '' : String(templates.length);
        sectionCount.classList.toggle('count-skeleton', isTemplatesLoading);
      }

      if (templatesGrid) {
        templatesGrid.innerHTML = isTemplatesLoading
          ? buildProductCardSkeletonMarkup(GRID_SKELETON_COUNT)
          : templates.map(templateCard).join('');
      }

      setEmptyStateVisibility({
        emptyState,
        emptyStateTitle,
        emptyStateMessage,
        config,
        query: '',
        resultCount: templates.length,
        isWholePageEmpty,
        isLoading: isTemplatesLoading,
      });

      document.title = `${config.pageTitle} - Siren.uix Marketplace`;
    }

    function applySearchState(queryValue) {
      const config = CATEGORY_CONFIGS[selectedCategory] || CATEGORY_CONFIGS['free-paid'];
      const query = String(queryValue || '').trim();
      const isWholePageEmpty = getTemplateProducts().length === 0;
      const templates = getTemplatesForCategory(selectedCategory).filter((product) => matchesSearch(product, query));

      const templatesGrid = document.getElementById('filter-templates-grid');
      const sectionCount = document.getElementById('filter-section-count');
      const emptyState = document.getElementById('filter-empty-state');
      const emptyStateTitle = document.getElementById('filter-empty-title');
      const emptyStateMessage = document.getElementById('filter-empty-state-message');

      if (templatesGrid) {
        templatesGrid.innerHTML = isTemplatesLoading
          ? buildProductCardSkeletonMarkup(GRID_SKELETON_COUNT)
          : templates.map(templateCard).join('');
      }
      if (sectionCount) {
        sectionCount.textContent = isTemplatesLoading ? '' : String(templates.length);
        sectionCount.classList.toggle('count-skeleton', isTemplatesLoading);
      }

      setEmptyStateVisibility({
        emptyState,
        emptyStateTitle,
        emptyStateMessage,
        config,
        query,
        resultCount: templates.length,
        isWholePageEmpty,
        isLoading: isTemplatesLoading,
      });
    }



    applyCategoryState(selectedCategory);

    if (window.ProductDataSource && typeof window.ProductDataSource.loadProducts === 'function') {
      const rehydrate = () => {
        if (signal.aborted) return;
        if (window.ProductDataSource.getSource) {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }
        applyCategoryState(selectedCategory);
        if (filterSearchInput && filterSearchInput.value.trim()) {
          applySearchState(filterSearchInput.value);
        }
      };

      const finalizeInitialLoading = () => {
        if (hasFinalizedInitialLoading) return;
        hasFinalizedInitialLoading = true;

        const elapsed = Date.now() - initialLoadingStartedAt;
        const remaining = Math.max(300, INITIAL_GRID_SKELETON_MS - elapsed);

        window.setTimeout(() => {
          if (signal.aborted) return;
          isTemplatesLoading = false;
          rehydrate();
          document.dispatchEvent(new CustomEvent('app:layoutReady'));
        }, remaining);
      };

      const handleProductsUpdate = () => {
        if (signal.aborted) return;
        if (isTemplatesLoading) {
          finalizeInitialLoading();
          return;
        }
        rehydrate();
      };

      document.body.dataset.productSource = window.ProductDataSource.getSource
        ? window.ProductDataSource.getSource()
        : 'fallback';

      window.ProductDataSource.loadProducts({ forceRefresh: isFirstBoot })
        .then(() => {
          if (signal.aborted) return;
          finalizeInitialLoading();
        })
        .catch(() => {
          if (signal.aborted) return;
          finalizeInitialLoading();
        });
      document.addEventListener('products:updated', handleProductsUpdate, { signal });
    } else {
      isTemplatesLoading = false;
      applyCategoryState(selectedCategory);
    }

    if (filterSearchInput) {
      filterSearchInput.addEventListener('input', () => {
        applySearchState(filterSearchInput.value);
      }, { signal });
    }

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.rememberOpenedProductSlug(activeFilterTabSlug);
    }

    document.addEventListener('click', (event) => {
      const clickedCard = event.target.closest('.product-card');
      if (!clickedCard) return;

      const slug = clickedCard.dataset.productSlug;
      if (window.ProductTopPaneTabs) {
        window.ProductTopPaneTabs.rememberOpenedProductSlug(slug, { skipRefresh: true });
      }
    }, { signal });

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.init({
        containerId: 'shell-top-pane-product-tabs',
        activeSlug: activeFilterTabSlug,
        enableDefaultProductActive: false,
      });
    }

    const cleanupPage = () => {
      controller.abort();
      if (window.__pageCleanup === cleanupPage) {
        window.__pageCleanup = null;
      }
    };
    window.__pageCleanup = cleanupPage;
  }

  window.PageModules = window.PageModules || {};
  window.PageModules[PAGE_NAME] = initFilterTemplatePage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterTemplatePage, { once: true });
  } else {
    initFilterTemplatePage();
  }
})();
