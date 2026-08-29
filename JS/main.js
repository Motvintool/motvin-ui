(function registerIndexPageModule() {
  const PAGE_NAME = 'discover-templates.html';
  const FILTER_TEMPLATE_PAGE = 'filter-template.html';
  const INITIAL_GRID_SKELETON_MS = 260;

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function productCard(product) {
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function toTitleCase(value) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  function normalizeTemplateCategory(value) {
    const normalized = String(value || '')
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

  function buildFilterTemplateUrl(category) {
    return `${FILTER_TEMPLATE_PAGE}?category=${encodeURIComponent(normalizeTemplateCategory(category))}`;
  }

  function highlightMatches(text, query) {
    const safeText = escapeHtml(text);
    const terms = query
      .trim()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
      .slice(0, 4);

    if (!terms.length) {
      return safeText;
    }

    const matcher = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
    return safeText.replace(matcher, '<mark class="search-match">$1</mark>');
  }

  function collectionChips(query, products) {
    const chips = [];
    const seen = new Set();

    function addChip(label) {
      const normalized = label.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      chips.push(label.trim());
    }

    query
      .trim()
      .split(/\s+/)
      .filter((token) => token.length >= 2)
      .forEach((token) => addChip(toTitleCase(token)));

    const mappedCollections = [
      { pattern: /mobile|android|ios|app/i, label: 'Mobile Templates' },
      { pattern: /web|website|landing|dashboard/i, label: 'Website Templates' },
      { pattern: /finance|bank|payment|wallet/i, label: 'Finance Templates' },
      { pattern: /medical|health|doctor|clinic/i, label: 'Medical Templates' },
    ];

    mappedCollections.forEach((entry) => {
      if (entry.pattern.test(query)) {
        addChip(entry.label);
      }
    });

    products.forEach((product) => {
      if (product.category) {
        addChip(product.category);
      }
    });

    if (!chips.length) {
      addChip('Templates');
    }

    return chips.slice(0, 4);
  }

  function searchMatches(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return getTemplateProducts().filter((product) => {
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
    }).slice(0, 6);
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

  function showInitialGridSkeleton(grids) {
    const validGrids = grids.filter(Boolean);
    if (!validGrids.length) return false;

    const markup = buildProductCardSkeletonMarkup(getGridSkeletonCardCount());
    validGrids.forEach((grid) => {
      grid.innerHTML = markup;
    });
    return true;
  }

  function waitForInitialSkeletonDelay() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, INITIAL_GRID_SKELETON_MS);
      });
    });
  }

  function initIndexPage() {
    const curPage = getCurrentPageName();
    if (curPage !== PAGE_NAME && curPage !== 'discover-templates.html') return;

    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
    }

    const controller = new AbortController();
    const { signal } = controller;

    const freeTemplatesGrid = document.getElementById('free-templates-grid');
    const recentTemplatesGrid = document.getElementById('recent-templates-grid');
    const freePaidRoot = document.querySelector('[data-free-paid-root]');
    const allTemplatesRoot = document.querySelector('[data-all-templates-root]');
    const freePaidFilterButton = document.querySelector('[data-filter="free-paid"]');
    const allTemplatesFilterButton = document.querySelector('[data-filter="all-templates"]');
    const freePaidLabel = document.querySelector('[data-free-paid-label]');
    const allTemplatesLabel = document.querySelector('[data-all-templates-label]');
    const freePaidDropdown = document.querySelector('[data-free-paid-dropdown]');
    const allTemplatesDropdown = document.querySelector('[data-all-templates-dropdown]');
    const freePaidOptions = Array.from(document.querySelectorAll('[data-category-option]'));
    const allTemplatesOptions = Array.from(document.querySelectorAll('[data-secondary-category-option]'));
    const freePaidOptionCountNodes = Array.from(document.querySelectorAll('[data-category-count]'));
    const allTemplatesOptionCountNodes = Array.from(document.querySelectorAll('[data-secondary-category-count]'));
    const primarySectionIcon = document.getElementById('primary-section-icon');
    const primarySectionTitle = document.getElementById('primary-section-title');
    const primarySectionCount = document.getElementById('primary-section-count');
    const primarySeeAllLink = document.getElementById('primary-see-all-link');
    const secondarySectionTitle = document.getElementById('secondary-section-title');
    const secondarySectionCount = document.getElementById('secondary-section-count');
    const secondarySeeAllLink = document.getElementById('secondary-see-all-link');
    const searchInput = document.getElementById('template-search-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    const searchSurface = document.querySelector('.search-input-btn');

    let activeSuggestionIndex = -1;
    let currentSuggestions = [];
    let selectedPrimaryCategory = 'free-paid';
    let selectedAllTemplatesCategory = 'all-templates';
    let selectedSecondaryCategory = 'recent';
    let isProductsLoading = !!(
      window.ProductDataSource &&
      typeof window.ProductDataSource.loadProducts === 'function'
    );
    const initialLoadingStartedAt = Date.now();
    let hasFinalizedInitialLoading = !isProductsLoading;

    const PRIMARY_CATEGORY_CONFIG = {
      'free-paid': {
        label: 'Free & Paid',
        title: 'Free & Paid Templates',
        icon: 'ASSET/Icons/filter-free-paid-icon.svg',
      },
      free: {
        label: 'Free Templates',
        title: 'Free Templates',
        icon: 'ASSET/Icons/dropdown-free-icon.svg',
      },
      paid: {
        label: 'Paid Templates',
        title: 'Paid Templates',
        icon: 'ASSET/Icons/dropdown-paid-icon.svg',
      },
    };

    const SECONDARY_CATEGORY_CONFIG = {
      'all-templates': {
        label: 'All Templates',
        title: 'Free Templates',
        icon: 'ASSET/Icons/filter-free-paid-icon.svg',
      },
      trending: {
        label: 'Trending',
        title: 'Trending Templates',
        icon: 'ASSET/Icons/dropdown-trending-icon.svg',
      },
      popular: {
        label: 'Popular',
        title: 'Popular Templates',
        icon: 'ASSET/Icons/dropdown-popular-icon.svg',
      },
      recent: {
        title: 'Recent Templates',
      },
    };

    const countNodes = [
      primarySectionCount,
      secondarySectionCount,
      ...freePaidOptionCountNodes,
      ...allTemplatesOptionCountNodes,
    ].filter(Boolean);

    function setCountLoadingState(isLoading) {
      countNodes.forEach((node) => {
        node.classList.toggle('count-skeleton', isLoading);
        if (isLoading) {
          node.textContent = '';
          node.setAttribute('aria-busy', 'true');
        } else {
          node.removeAttribute('aria-busy');
        }
      });
    }

    function getFeaturedTemplates() {
      const products = getTemplateProducts();
      return products.slice();
    }

    function getRecentTemplatePool() {
      return getTemplateProducts().slice(0, 12);
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

    function getTemplatesByCategory(category) {
      const featuredTemplates = getFeaturedTemplates();
      const normalized = normalizeTemplateCategory(category);
      if (normalized === 'free') {
        return featuredTemplates.filter((product) => isFreeTemplate(product));
      }
      if (normalized === 'paid') {
        return featuredTemplates.filter((product) => !isFreeTemplate(product));
      }
      return featuredTemplates;
    }

    function updateDropdownCounts() {
      if (isProductsLoading) return;

      const counts = {
        'free-paid': getTemplatesByCategory('free-paid').length,
        free: getTemplatesByCategory('free').length,
        paid: getTemplatesByCategory('paid').length,
      };

      freePaidOptionCountNodes.forEach((node) => {
        const category = node.getAttribute('data-category-count');
        node.textContent = String(counts[category] || 0);
      });
    }

    function getSecondaryTemplatesByCategory() {
      const recentTemplatePool = getRecentTemplatePool();
      return recentTemplatePool.slice(0, 4);
    }

    function isPopularTemplate(product) {
      const tags = Array.isArray(product.tags) ? product.tags : [];
      const detailTags = Array.isArray(product.detailTags) ? product.detailTags : [];
      const mergedTags = tags.concat(detailTags).join(' ').toLowerCase();
      return mergedTags.includes('popular');
    }

    function isTrendingTemplate(product, index) {
      const tags = Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : '';
      const categoryText = String(product.category || '').toLowerCase();
      if (/trend|fintech|dashboard|travel|health|app/.test(tags + ' ' + categoryText)) {
        return true;
      }
      return index % 2 === 0;
    }

    function getPrimaryTemplatesBySecondaryFilter(category) {
      const featuredTemplates = getFeaturedTemplates();
      const normalized = normalizeSecondaryCategory(category);

      if (normalized === 'trending') {
        const trending = featuredTemplates.filter((product, index) => isTrendingTemplate(product, index));
        return trending.length ? trending : featuredTemplates;
      }

      if (normalized === 'popular') {
        const popular = featuredTemplates.filter((product) => isPopularTemplate(product));
        return popular.length ? popular : featuredTemplates.slice(0, Math.max(4, Math.ceil(featuredTemplates.length / 2)));
      }

      return featuredTemplates;
    }

    function updateSecondaryDropdownCounts() {
      if (isProductsLoading) return;

      const counts = {
        'all-templates': getPrimaryTemplatesBySecondaryFilter('all-templates').length,
        trending: getPrimaryTemplatesBySecondaryFilter('trending').length,
        popular: getPrimaryTemplatesBySecondaryFilter('popular').length,
      };

      allTemplatesOptionCountNodes.forEach((node) => {
        const category = node.getAttribute('data-secondary-category-count');
        node.textContent = String(counts[category] || 0);
      });
    }

    function openFreePaidDropdown() {
      if (!freePaidFilterButton || !freePaidDropdown) return;
      freePaidDropdown.hidden = false;
      freePaidFilterButton.classList.add('is-open');
      freePaidFilterButton.setAttribute('aria-expanded', 'true');
    }

    function closeFreePaidDropdown() {
      if (!freePaidFilterButton || !freePaidDropdown) return;
      freePaidDropdown.hidden = true;
      freePaidFilterButton.classList.remove('is-open');
      freePaidFilterButton.setAttribute('aria-expanded', 'false');
    }

    function openAllTemplatesDropdown() {
      if (!allTemplatesFilterButton || !allTemplatesDropdown) return;
      allTemplatesDropdown.hidden = false;
      allTemplatesFilterButton.classList.add('is-open');
      allTemplatesFilterButton.setAttribute('aria-expanded', 'true');
    }

    function closeAllTemplatesDropdown() {
      if (!allTemplatesFilterButton || !allTemplatesDropdown) return;
      allTemplatesDropdown.hidden = true;
      allTemplatesFilterButton.classList.remove('is-open');
      allTemplatesFilterButton.setAttribute('aria-expanded', 'false');
    }

    function setActiveDropdownOption(category) {
      freePaidOptions.forEach((option) => {
        const isActive = normalizeTemplateCategory(option.getAttribute('data-category-option')) === category;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function applyPrimaryCategory(category) {
      const normalized = normalizeTemplateCategory(category);
      const config = PRIMARY_CATEGORY_CONFIG[normalized] || PRIMARY_CATEGORY_CONFIG['free-paid'];
      const templates = getTemplatesByCategory(normalized);

      selectedPrimaryCategory = normalized;

      if (freePaidLabel) {
        freePaidLabel.textContent = config.label;
      }

      if (primarySectionTitle) {
        primarySectionTitle.textContent = config.title;
      }

      if (primarySectionIcon) {
        primarySectionIcon.src = config.icon;
      }

      if (primarySectionCount) {
        primarySectionCount.textContent = String(templates.length);
      }

      if (primarySeeAllLink) {
        primarySeeAllLink.setAttribute('data-template-category', normalized);
        primarySeeAllLink.setAttribute('href', buildFilterTemplateUrl(normalized));
      }

      if (freeTemplatesGrid) {
        if (templates.length) {
          freeTemplatesGrid.innerHTML = templates.map(productCard).join('');
        } else {
          const emptyCopyByCategory = {
            free: 'No free templates available right now.',
            paid: 'No paid templates available right now.',
            'free-paid': 'No templates available right now.',
          };

          const emptyCopy = emptyCopyByCategory[normalized] || emptyCopyByCategory['free-paid'];
          freeTemplatesGrid.innerHTML = `
            <div class="product-grid-empty" role="status" aria-live="polite">
              <p class="product-grid-empty-title">No Templates Found</p>
              <p class="product-grid-empty-copy">${emptyCopy}</p>
            </div>`;
        }
      }

      setActiveDropdownOption(normalized);

      selectedAllTemplatesCategory = 'all-templates';
      if (allTemplatesLabel) {
        allTemplatesLabel.textContent = SECONDARY_CATEGORY_CONFIG['all-templates'].label;
      }
      setActiveSecondaryOption('all-templates');
    }

    function setActiveSecondaryOption(category) {
      allTemplatesOptions.forEach((option) => {
        const isActive = normalizeSecondaryCategory(option.getAttribute('data-secondary-category-option')) === category;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function applySecondaryCategory() {
      const normalized = normalizeSecondaryCategory();
      const config = SECONDARY_CATEGORY_CONFIG[normalized] || SECONDARY_CATEGORY_CONFIG.recent;
      const templates = getSecondaryTemplatesByCategory();

      selectedSecondaryCategory = normalized;

      if (secondarySectionTitle) {
        secondarySectionTitle.textContent = config.title;
      }

      if (secondarySectionCount) {
        secondarySectionCount.textContent = String(templates.length);
      }

      if (secondarySeeAllLink) {
        secondarySeeAllLink.setAttribute('data-template-category', 'recent');
        secondarySeeAllLink.setAttribute('href', buildFilterTemplateUrl('recent'));
      }

      if (recentTemplatesGrid) {
        if (templates.length) {
          recentTemplatesGrid.innerHTML = templates.map(productCard).join('');
        } else {
          recentTemplatesGrid.innerHTML = `
            <div class="product-grid-empty" role="status" aria-live="polite">
              <p class="product-grid-empty-title">No Templates Found</p>
              <p class="product-grid-empty-copy">No templates available in this section right now.</p>
            </div>`;
        }
      }

      setActiveSecondaryOption(selectedAllTemplatesCategory);
    }

    function applyAllTemplatesPrimaryCategory(category) {
      const normalized = normalizeSecondaryCategory(category);
      const config = SECONDARY_CATEGORY_CONFIG[normalized] || SECONDARY_CATEGORY_CONFIG['all-templates'];
      const templates = getPrimaryTemplatesBySecondaryFilter(normalized);

      selectedAllTemplatesCategory = normalized;

      if (allTemplatesLabel) {
        allTemplatesLabel.textContent = config.label;
      }

      if (primarySectionTitle) {
        primarySectionTitle.textContent = config.title;
      }

      if (primarySectionIcon) {
        primarySectionIcon.src = config.icon;
      }

      if (primarySectionCount) {
        primarySectionCount.textContent = String(templates.length);
      }

      if (primarySeeAllLink) {
        primarySeeAllLink.setAttribute('data-template-category', normalized === 'all-templates' ? 'free-paid' : 'recent');
        primarySeeAllLink.setAttribute('href', buildFilterTemplateUrl(normalized === 'all-templates' ? 'free-paid' : 'recent'));
      }

      if (freeTemplatesGrid) {
        if (templates.length) {
          freeTemplatesGrid.innerHTML = templates.map(productCard).join('');
        } else {
          freeTemplatesGrid.innerHTML = `
            <div class="product-grid-empty" role="status" aria-live="polite">
              <p class="product-grid-empty-title">No Templates Found</p>
              <p class="product-grid-empty-copy">No templates available in this section right now.</p>
            </div>`;
        }
      }

      setActiveSecondaryOption(normalized);
    }

    function hideSuggestions() {
      if (!searchSuggestions) return;
      searchSuggestions.hidden = true;
      searchSuggestions.innerHTML = '';
      activeSuggestionIndex = -1;
      currentSuggestions = [];
    }

    function setSuggestionActive(index) {
      if (!searchSuggestions || searchSuggestions.hidden) return;

      const items = Array.from(searchSuggestions.querySelectorAll('.search-suggestion'));
      items.forEach((item, itemIndex) => {
        item.classList.toggle('is-active', itemIndex === index);
      });

      const activeItem = items[index];
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }

    function openSuggestionProduct(slug) {
      if (!slug) return;
      if (window.ProductTopPaneTabs) {
        window.ProductTopPaneTabs.rememberOpenedProductSlug(slug, { skipRefresh: true });
      }
      window.location.href = `product-detail.html?product=${encodeURIComponent(slug)}`;
    }

    function renderSuggestions(query) {
      if (!searchSuggestions) return;

      const normalizedQuery = query.trim();
      currentSuggestions = searchMatches(query);
      activeSuggestionIndex = -1;

      if (!normalizedQuery) {
        hideSuggestions();
        return;
      }

      const chips = collectionChips(normalizedQuery, currentSuggestions)
        .map((label) => `
          <button type="button" class="search-collection-chip" data-collection="${escapeHtml(label)}">
            <img src="ASSET/Icons/search-collection-icon.svg" alt="" />
            <span>${escapeHtml(label)}</span>
          </button>`)
        .join('');

      const filesMarkup = currentSuggestions.length
        ? currentSuggestions
          .map((product, index) => `
          <a class="search-suggestion" href="product-detail.html?product=${encodeURIComponent(product.slug)}" data-product-slug="${product.slug}" data-index="${index}">
            <span class="search-suggestion-main">
              <span class="search-suggestion-left">
                <span class="search-suggestion-thumb">
                  <img src="${product.image}" alt="${escapeHtml(product.title)}" />
                </span>
                <span class="search-suggestion-info">
                  <span class="search-suggestion-title">${highlightMatches(product.title, normalizedQuery)}</span>
                  <span class="search-suggestion-meta">${highlightMatches(`By ${product.author} • ${product.category}`, normalizedQuery)}</span>
                </span>
              </span>
              <span class="search-suggestion-price">${escapeHtml(product.price)}</span>
            </span>
          </a>`)
          .join('')
        : '<p class="search-suggestions-empty">No matching templates found.</p>';

      searchSuggestions.hidden = false;
      searchSuggestions.innerHTML = `
        <div class="search-suggestions-panel">
          <section class="search-suggestions-section">
            <div class="search-suggestions-section-title">Explore related collections</div>
            <div class="search-collection-tags">${chips}</div>
          </section>
          <section class="search-suggestions-section">
            <div class="search-suggestions-section-title">Files</div>
            <div class="search-suggestions-list">${filesMarkup}</div>
          </section>
        </div>`;
    }

    function bindSeeAllTemplateLinks() {
      const links = Array.from(document.querySelectorAll('[data-template-category]'));
      links.forEach((link) => {
        const initialCategory = normalizeTemplateCategory(link.getAttribute('data-template-category'));
        link.setAttribute('href', buildFilterTemplateUrl(initialCategory));
        link.addEventListener('click', () => {
          if (!window.ProductTopPaneTabs) return;
          const liveCategory = normalizeTemplateCategory(link.getAttribute('data-template-category'));
          link.setAttribute('href', buildFilterTemplateUrl(liveCategory));

          const normalized = liveCategory;
          const filterTabSlug = window.ProductTopPaneTabs.buildFilterTabSlug
            ? window.ProductTopPaneTabs.buildFilterTabSlug(normalized)
            : `filter:${normalized}`;
          window.ProductTopPaneTabs.rememberOpenedProductSlug(filterTabSlug);
        }, { signal });
      });
    }

    function renderProductGrids() {
      // Keep initial skeleton cards visible until data source finishes loading.
      if (isProductsLoading) return;

      applyPrimaryCategory(selectedPrimaryCategory);
      applyAllTemplatesPrimaryCategory(selectedAllTemplatesCategory);
      applySecondaryCategory();
    }

    function rehydrateProductsFromSource() {
      setCountLoadingState(false);
      updateDropdownCounts();
      updateSecondaryDropdownCounts();
      renderProductGrids();

      if (searchInput && searchInput.value.trim()) {
        renderSuggestions(searchInput.value);
      }
    }

    function finalizeInitialLoading() {
      if (hasFinalizedInitialLoading) return;
      hasFinalizedInitialLoading = true;

      const elapsed = Date.now() - initialLoadingStartedAt;
      const remaining = Math.max(300, INITIAL_GRID_SKELETON_MS - elapsed);

      window.setTimeout(() => {
        if (signal.aborted) return;
        isProductsLoading = false;
        if (window.ProductDataSource && typeof window.ProductDataSource.getSource === 'function') {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }
        rehydrateProductsFromSource();
        document.dispatchEvent(new CustomEvent('app:layoutReady'));
      }, remaining);
    }

    const isFirstBoot = !window.__motvin_spa_booted;
    window.__motvin_spa_booted = true;

    const hasCache = Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
    isProductsLoading = isFirstBoot || !hasCache;

    setCountLoadingState(isProductsLoading);
    updateDropdownCounts();
    updateSecondaryDropdownCounts();

    if (isProductsLoading) {
      showInitialGridSkeleton([freeTemplatesGrid, recentTemplatesGrid]);
    } else {
      renderProductGrids();
    }

    bindSeeAllTemplateLinks();

    if (window.ProductDataSource && typeof window.ProductDataSource.loadProducts === 'function') {
      document.body.dataset.productSource = window.ProductDataSource.getSource
        ? window.ProductDataSource.getSource()
        : 'fallback';

      window.ProductDataSource.loadProducts({ forceRefresh: isFirstBoot }).then(() => {
        if (signal.aborted) return;
        finalizeInitialLoading();
      }).catch(() => {
        if (signal.aborted) return;
        finalizeInitialLoading();
      });

      document.addEventListener('products:updated', () => {
        if (signal.aborted) return;
        if (isProductsLoading) {
          finalizeInitialLoading();
          return;
        }

        if (window.ProductDataSource.getSource) {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }
        rehydrateProductsFromSource();
      }, { signal });
    } else {
      isProductsLoading = false;
      setCountLoadingState(false);
      renderProductGrids();
    }

    if (freePaidFilterButton && freePaidDropdown) {
      freePaidFilterButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (event.target.closest('[data-category-option]')) {
          return;
        }

        if (freePaidDropdown.hidden) {
          closeAllTemplatesDropdown();
          openFreePaidDropdown();
        } else {
          closeFreePaidDropdown();
        }
      }, { signal });
    }

    if (allTemplatesFilterButton && allTemplatesDropdown) {
      allTemplatesFilterButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (event.target.closest('[data-secondary-category-option]')) {
          return;
        }

        if (allTemplatesDropdown.hidden) {
          closeFreePaidDropdown();
          openAllTemplatesDropdown();
        } else {
          closeAllTemplatesDropdown();
        }
      }, { signal });
    }

    freePaidOptions.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const category = normalizeTemplateCategory(option.getAttribute('data-category-option'));
        applyPrimaryCategory(category);
        closeFreePaidDropdown();
      }, { signal });
    });

    allTemplatesOptions.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const category = normalizeSecondaryCategory(option.getAttribute('data-secondary-category-option'));
        applyAllTemplatesPrimaryCategory(category);
        closeAllTemplatesDropdown();
      }, { signal });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        renderSuggestions(event.target.value || '');
      }, { signal });

      searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) {
          renderSuggestions(searchInput.value);
        }
      }, { signal });

      searchInput.addEventListener('keydown', (event) => {
        if (!searchSuggestions || searchSuggestions.hidden || !currentSuggestions.length) return;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
          setSuggestionActive(activeSuggestionIndex);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          activeSuggestionIndex = activeSuggestionIndex <= 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
          setSuggestionActive(activeSuggestionIndex);
          return;
        }

        if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
          event.preventDefault();
          openSuggestionProduct(currentSuggestions[activeSuggestionIndex].slug);
          return;
        }

        if (event.key === 'Enter' && currentSuggestions.length) {
          event.preventDefault();
          openSuggestionProduct(currentSuggestions[0].slug);
          return;
        }

        if (event.key === 'Escape') {
          hideSuggestions();
        }
      }, { signal });
    }

    if (searchSuggestions) {
      searchSuggestions.addEventListener('click', (event) => {
        const chip = event.target.closest('.search-collection-chip');
        if (chip && searchInput) {
          searchInput.value = chip.dataset.collection || '';
          renderSuggestions(searchInput.value);
          searchInput.focus();
          return;
        }

        const item = event.target.closest('.search-suggestion');
        if (!item) return;

        event.preventDefault();
        openSuggestionProduct(item.dataset.productSlug);
      }, { signal });
    }

    document.addEventListener('click', (event) => {
      const insideSearch = searchSurface && searchSurface.contains(event.target);
      if (!insideSearch) {
        hideSuggestions();
      }

      const insideFreePaidDropdown = freePaidFilterButton && freePaidFilterButton.contains(event.target);
      const insideFreePaidRoot = freePaidRoot && freePaidRoot.contains(event.target);
      if (!insideFreePaidDropdown && !insideFreePaidRoot) {
        closeFreePaidDropdown();
      }

      const insideAllTemplatesDropdown = allTemplatesFilterButton && allTemplatesFilterButton.contains(event.target);
      const insideAllTemplatesRoot = allTemplatesRoot && allTemplatesRoot.contains(event.target);
      if (!insideAllTemplatesDropdown && !insideAllTemplatesRoot) {
        closeAllTemplatesDropdown();
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
        closeFreePaidDropdown();
        closeAllTemplatesDropdown();
      }
    }, { signal });

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.init({
        containerId: 'shell-top-pane-product-tabs',
        forceHomeActive: true,
        enableDefaultProductActive: false,
      });
    }

    const cleanupPage = () => {
      controller.abort();
      hideSuggestions();
      if (window.__pageCleanup === cleanupPage) {
        window.__pageCleanup = null;
      }
    };
    window.__pageCleanup = cleanupPage;
  }

  window.PageModules = window.PageModules || {};
  window.PageModules[PAGE_NAME] = initIndexPage;
  window.PageModules['discover-templates.html'] = initIndexPage;

  function shouldRunIndexInit() {
    const p = window.location.pathname.toLowerCase();
    return p.indexOf('discover-templates') !== -1;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (shouldRunIndexInit()) {
        initIndexPage();
      }
    }, { once: true });
  } else {
    if (shouldRunIndexInit()) {
      initIndexPage();
    }
  }
})();

