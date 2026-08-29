(function registerWebTemplatePageModule() {
  const PAGE_NAME = 'web-template.html';
  const GRID_SKELETON_COUNT = 8;
  const INITIAL_GRID_SKELETON_MS = 260;
  let currentWebPrimaryCategory = 'free-paid';

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function templateCard(product) {
    if (window.ProductCard && typeof window.ProductCard.template === 'function') {
      return window.ProductCard.template(product, { categoryLabel: 'Web Templates' });
    }

    return `
      <a class="product-card product-card--template" data-product-slug="${product.slug}" href="product-detail.html?product=${encodeURIComponent(product.slug)}">
        <div class="product-img-wrap"><img src="${product.image}" alt="${product.title}" /></div>
        <div class="product-info">
          <div class="product-meta">
            <span class="product-name">${product.title}</span>
            <div class="product-author"><span>By ${product.author}</span><span>•</span><span>Web Templates</span></div>
          </div>
          <span class="product-price">${product.price}</span>
        </div>
      </a>`;
  }

  const WEB_CONFIG = {
    pageTitle: 'Discover All Web Templates',
    subtitle: 'Explore website templates, components, and web UI patterns from marketplace creators.',
    headerSubtitle: 'Browse website-ready UI templates crafted for product teams and web creators.',
    primaryFilterLabel: 'Web Templates',
    secondaryFilterLabel: 'All Templates',
    sectionTitle: 'Web Templates',
    icon: 'ASSET/Icons/filter-all-templates-icon.svg',
    emptyMessage: 'No web templates are available right now.',
  };

  function isWebTemplate(product) {
    const haystack = [
      product.title,
      product.category,
      product.summary,
      product.description,
      (product.tags || []).join(' '),
      (product.detailTags || []).join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return /web|website|landing|dashboard|site|saas/.test(haystack);
  }

  function getTemplateProducts() {
    if (window.ProductDataSource && typeof window.ProductDataSource.getProductsByType === 'function') {
      return window.ProductDataSource.getProductsByType('template');
    }
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function getWebTemplates() {
    return getTemplateProducts().filter((product) => isWebTemplate(product));
  }

  function isPopularTemplate(product) {
    const tags = Array.isArray(product.tags) ? product.tags : [];
    const detailTags = Array.isArray(product.detailTags) ? product.detailTags : [];
    const merged = tags.concat(detailTags).join(' ').toLowerCase();
    return merged.includes('popular');
  }

  function isTrendingTemplate(product, index) {
    const tags = Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : '';
    const categoryText = String(product.category || '').toLowerCase();
    if (/trend|dashboard|travel|health|finance|web|website|landing|saas/.test(tags + ' ' + categoryText)) {
      return true;
    }
    return index % 2 === 0;
  }

  function normalizeSecondaryCategory(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');

    if (normalized === 'trending') return 'trending';
    if (normalized === 'popular') return 'popular';
    return 'all-templates';
  }

  function normalizePrimaryCategory(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replaceAll('&', 'and')
      .replace(/[^a-z0-9-]+/g, '-');

    if (normalized === 'free') return 'free';
    if (normalized === 'paid') return 'paid';
    return 'free-paid';
  }

  function isFreeTemplate(product) {
    const price = String(product.price || '').trim().toLowerCase();
    if (!price) return false;

    if (price.includes('free')) return true;

    const numeric = Number(price.replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) && numeric === 0;
  }

  function getWebTemplatesByPrimaryCategory(category) {
    const selected = normalizePrimaryCategory(category);
    const pool = getWebTemplates();

    if (selected === 'free') {
      return pool.filter((product) => isFreeTemplate(product));
    }

    if (selected === 'paid') {
      return pool.filter((product) => !isFreeTemplate(product));
    }

    return pool;
  }

  function getWebTemplatesByCategory(category) {
    const selected = normalizeSecondaryCategory(category);
    const pool = getWebTemplatesByPrimaryCategory(currentWebPrimaryCategory);

    if (selected === 'trending') {
      return pool.filter((product, index) => isTrendingTemplate(product, index));
    }

    if (selected === 'popular') {
      const popularTemplates = pool.filter((product) => isPopularTemplate(product));
      if (popularTemplates.length) return popularTemplates;
      return pool.slice(0, 2);
    }

    return pool;
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

    if (isLoading) {
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

  function initWebTemplatePage() {
    if (getCurrentPageName() !== PAGE_NAME) return;

    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
    }

    const controller = new AbortController();
    const { signal } = controller;

    const activeFilterTabSlug = window.ProductTopPaneTabs && typeof window.ProductTopPaneTabs.buildFilterTabSlug === 'function'
      ? window.ProductTopPaneTabs.buildFilterTabSlug('web')
      : 'filter:web';

    const webFreePaidRoot = document.querySelector('[data-web-free-paid-root]');
    const webFreePaidFilterButton = document.querySelector('[data-filter="web-free-paid"]');
    const webFreePaidLabel = document.querySelector('[data-web-free-paid-label]');
    const webFreePaidDropdown = document.querySelector('[data-web-free-paid-dropdown]');
    const webPrimaryOptions = Array.from(document.querySelectorAll('[data-web-primary-option]'));
    const webPrimaryCountNodes = Array.from(document.querySelectorAll('[data-web-primary-count]'));
    const webAllRoot = document.querySelector('[data-web-all-root]');
    const webAllFilterButton = document.querySelector('[data-filter="web-all-templates"]');
    const webAllDropdown = document.querySelector('[data-web-all-dropdown]');
    const webAllOptions = Array.from(document.querySelectorAll('[data-web-all-option]'));
    const webAllCountNodes = Array.from(document.querySelectorAll('[data-web-all-count]'));
    const filterSearchInput = document.getElementById('template-search-input');
    const secondaryLabel = document.getElementById('filter-secondary-label');

    const secondaryCategoryLabelMap = {
      'all-templates': 'All Templates',
      trending: 'Trending',
      popular: 'Popular',
    };

    const primaryCategoryLabelMap = {
      'free-paid': 'Free & Paid',
      free: 'Free Templates',
      paid: 'Paid Templates',
    };

    let selectedPrimaryCategory = 'free-paid';
    let selectedSecondaryCategory = 'all-templates';
    const isFirstBoot = !window.__motvin_spa_booted;
    const hasCache = Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
    let isTemplatesLoading = isFirstBoot || !hasCache;
    const initialLoadingStartedAt = Date.now();
    let hasFinalizedInitialLoading = false;



    function openWebAllDropdown() {
      if (!webAllFilterButton || !webAllDropdown) return;
      webAllDropdown.hidden = false;
      webAllFilterButton.classList.add('is-open');
      webAllFilterButton.setAttribute('aria-expanded', 'true');
    }

    function openWebFreePaidDropdown() {
      if (!webFreePaidFilterButton || !webFreePaidDropdown) return;
      webFreePaidDropdown.hidden = false;
      webFreePaidFilterButton.classList.add('is-open');
      webFreePaidFilterButton.setAttribute('aria-expanded', 'true');
    }

    function closeWebAllDropdown() {
      if (!webAllFilterButton || !webAllDropdown) return;
      webAllDropdown.hidden = true;
      webAllFilterButton.classList.remove('is-open');
      webAllFilterButton.setAttribute('aria-expanded', 'false');
    }

    function closeWebFreePaidDropdown() {
      if (!webFreePaidFilterButton || !webFreePaidDropdown) return;
      webFreePaidDropdown.hidden = true;
      webFreePaidFilterButton.classList.remove('is-open');
      webFreePaidFilterButton.setAttribute('aria-expanded', 'false');
    }

    function setActivePrimaryOption(category) {
      webPrimaryOptions.forEach((option) => {
        const isActive = normalizePrimaryCategory(option.getAttribute('data-web-primary-option')) === category;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function setActiveSecondaryOption(category) {
      webAllOptions.forEach((option) => {
        const isActive = normalizeSecondaryCategory(option.getAttribute('data-web-all-option')) === category;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function updateSecondaryCounts() {
      const counts = {
        'all-templates': getWebTemplatesByCategory('all-templates').length,
        trending: getWebTemplatesByCategory('trending').length,
        popular: getWebTemplatesByCategory('popular').length,
      };

      webAllCountNodes.forEach((node) => {
        const category = normalizeSecondaryCategory(node.getAttribute('data-web-all-count'));
        node.textContent = String(counts[category] || 0);
      });
    }

    function updatePrimaryCounts() {
      const counts = {
        'free-paid': getWebTemplatesByPrimaryCategory('free-paid').length,
        free: getWebTemplatesByPrimaryCategory('free').length,
        paid: getWebTemplatesByPrimaryCategory('paid').length,
      };

      webPrimaryCountNodes.forEach((node) => {
        const category = normalizePrimaryCategory(node.getAttribute('data-web-primary-count'));
        node.textContent = String(counts[category] || 0);
      });
    }

    function renderWebState(searchQuery) {
      const query = String(searchQuery || '').trim();

      const config = WEB_CONFIG;
      const templates = getWebTemplatesByCategory(selectedSecondaryCategory)
        .filter((product) => matchesSearch(product, query));
      const isWholePageEmpty = getWebTemplates().length === 0;

      const pageTitle = document.getElementById('filter-page-title');
      const detailFrameTitle = document.getElementById('detail-frame-title');
      const detailFrameSubtitle = document.getElementById('detail-frame-subtitle');
      const pageSubtitle = document.getElementById('filter-page-subtitle');
      const primaryLabel = document.getElementById('filter-primary-label');
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
      if (primaryLabel) primaryLabel.textContent = primaryCategoryLabelMap[selectedPrimaryCategory] || config.primaryFilterLabel;
      if (webFreePaidLabel) webFreePaidLabel.textContent = primaryCategoryLabelMap[selectedPrimaryCategory] || 'Free & Paid';
      if (secondaryLabel) secondaryLabel.textContent = secondaryCategoryLabelMap[selectedSecondaryCategory] || config.secondaryFilterLabel;
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
        query,
        resultCount: templates.length,
        isWholePageEmpty,
        isLoading: isTemplatesLoading,
      });

      document.title = `${config.pageTitle} - Siren.uix Marketplace`;
    }

    function rehydrateWebTemplates() {
      currentWebPrimaryCategory = selectedPrimaryCategory;
      updatePrimaryCounts();
      updateSecondaryCounts();
      setActivePrimaryOption(selectedPrimaryCategory);
      setActiveSecondaryOption(selectedSecondaryCategory);

      renderWebState(filterSearchInput ? filterSearchInput.value : '');
    }

    rehydrateWebTemplates();

    if (window.ProductDataSource && typeof window.ProductDataSource.loadProducts === 'function') {
      const finalizeInitialLoading = () => {
        if (hasFinalizedInitialLoading) return;
        hasFinalizedInitialLoading = true;

        const elapsed = Date.now() - initialLoadingStartedAt;
        const remaining = Math.max(300, INITIAL_GRID_SKELETON_MS - elapsed);

        window.setTimeout(() => {
          if (signal.aborted) return;
          isTemplatesLoading = false;
          if (window.ProductDataSource.getSource) {
            document.body.dataset.productSource = window.ProductDataSource.getSource();
          }
          rehydrateWebTemplates();
          document.dispatchEvent(new CustomEvent('app:layoutReady'));
        }, remaining);
      };

      const handleProductsUpdate = () => {
        if (signal.aborted) return;
        if (isTemplatesLoading) {
          finalizeInitialLoading();
          return;
        }
        if (window.ProductDataSource.getSource) {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }
        rehydrateWebTemplates();
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
      rehydrateWebTemplates();
    }

    if (webFreePaidFilterButton && webFreePaidDropdown) {
      webFreePaidFilterButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (event.target.closest('[data-web-primary-option]')) {
          return;
        }

        if (webFreePaidDropdown.hidden) {
          closeWebAllDropdown();
          openWebFreePaidDropdown();
        } else {
          closeWebFreePaidDropdown();
        }
      }, { signal });
    }

    if (webAllFilterButton && webAllDropdown) {
      webAllFilterButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (event.target.closest('[data-web-all-option]')) {
          return;
        }

        if (webAllDropdown.hidden) {
          closeWebFreePaidDropdown();
          openWebAllDropdown();
        } else {
          closeWebAllDropdown();
        }
      }, { signal });
    }

    webPrimaryOptions.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        selectedPrimaryCategory = normalizePrimaryCategory(option.getAttribute('data-web-primary-option'));
        rehydrateWebTemplates();
        closeWebFreePaidDropdown();
      }, { signal });
    });

    webAllOptions.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        selectedSecondaryCategory = normalizeSecondaryCategory(option.getAttribute('data-web-all-option'));
        setActiveSecondaryOption(selectedSecondaryCategory);
        renderWebState(filterSearchInput ? filterSearchInput.value : '');
        closeWebAllDropdown();
      }, { signal });
    });

    if (filterSearchInput) {
      filterSearchInput.addEventListener('input', () => {
        renderWebState(filterSearchInput.value);
      }, { signal });
    }

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.rememberOpenedProductSlug(activeFilterTabSlug);
    }

    document.addEventListener('click', (event) => {
      const insideWebFreePaidDropdown = webFreePaidFilterButton && webFreePaidFilterButton.contains(event.target);
      const insideWebFreePaidRoot = webFreePaidRoot && webFreePaidRoot.contains(event.target);
      if (!insideWebFreePaidDropdown && !insideWebFreePaidRoot) {
        closeWebFreePaidDropdown();
      }

      const insideWebAllDropdown = webAllFilterButton && webAllFilterButton.contains(event.target);
      const insideWebAllRoot = webAllRoot && webAllRoot.contains(event.target);
      if (!insideWebAllDropdown && !insideWebAllRoot) {
        closeWebAllDropdown();
      }

      const clickedCard = event.target.closest('.product-card');
      if (!clickedCard) return;

      const slug = clickedCard.dataset.productSlug;
      if (window.ProductTopPaneTabs) {
        window.ProductTopPaneTabs.rememberOpenedProductSlug(slug, { skipRefresh: true });
      }
    }, { signal });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeWebFreePaidDropdown();
        closeWebAllDropdown();
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
  window.PageModules[PAGE_NAME] = initWebTemplatePage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebTemplatePage, { once: true });
  } else {
    initWebTemplatePage();
  }
})();
