(function registerMyPostPageModule() {
  const PAGE_NAME = 'my-post.html';
  const FILTER_TEMPLATE_PAGE = 'filter-template.html';
  const INITIAL_GRID_SKELETON_MS = 260;

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function buildPostSearchHaystack(product) {
    return [
      product.title,
      product.category,
      product.summary,
      product.description,
      (product.tags || []).join(' '),
      (product.detailTags || []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
  }

  function hasMobileSignals(product) {
    return /mobile|android|ios|app|phone/.test(buildPostSearchHaystack(product));
  }

  function hasWebSignals(product) {
    return /web|website|landing|dashboard|site|saas/.test(buildPostSearchHaystack(product));
  }

  function getPostCategoryKey(product) {
    const mobile = hasMobileSignals(product);
    const web = hasWebSignals(product);

    if (mobile && web) return 'mobile-web-posts';
    if (mobile) return 'mobile-posts';
    if (web) return 'web-posts';
    return 'mobile-web-posts';
  }

  function getPostCategoryLabel(product) {
    const key = getPostCategoryKey(product);
    if (key === 'mobile-posts') return 'Mobile Posts';
    if (key === 'web-posts') return 'Web Posts';
    return 'Mobile & Web';
  }

  function productCard(product, options = {}) {
    const hiddenFilterGroups = Array.isArray(options.hiddenFilterGroups)
      ? options.hiddenFilterGroups.filter(Boolean)
      : [];
    const hiddenFilterAttr = hiddenFilterGroups.length
      ? ` data-hidden-filter-groups="${hiddenFilterGroups.join(' ')}"`
      : '';

    if (window.ProductCard && typeof window.ProductCard.designPost === 'function') {
      return window.ProductCard.designPost(product, {
        hiddenFilterGroups,
        categoryLabel: getPostCategoryLabel(product),
      });
    }

    return `
      <a class="product-card product-card--design-post" data-product-slug="${product.slug}"${hiddenFilterAttr} href="my-post-detail.html?product=${encodeURIComponent(product.slug)}">
        <div class="product-img-wrap"><img src="${product.image || 'ASSET/Images/slide1.png'}" alt="${product.title}" /></div>
        <div class="product-info">
          <div class="product-meta">
            <span class="product-name">${product.title}</span>
            <div class="product-author"><span>By ${product.author}</span><span>•</span><span>${getPostCategoryLabel(product)}</span></div>
          </div>
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

  function getPostProducts() {
    if (window.ProductDataSource && typeof window.ProductDataSource.getProductsByType === 'function') {
      return window.ProductDataSource.getProductsByType('design-post');
    }
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function getFeaturedPostsPool() {
    const products = getPostProducts();
    return products.slice();
  }

  function getAllPostsPool() {
    return getPostProducts().slice(0, 12);
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
      { pattern: /mobile|android|ios|app/i, label: 'Mobile Posts' },
      { pattern: /web|website|landing|dashboard/i, label: 'Web Posts' },
      { pattern: /finance|bank|payment|wallet/i, label: 'Finance Posts' },
      { pattern: /medical|health|doctor|clinic/i, label: 'Medical Posts' },
    ];

    mappedCollections.forEach((entry) => {
      if (entry.pattern.test(query)) {
        addChip(entry.label);
      }
    });

    products.forEach((product) => {
      addChip(getPostCategoryLabel(product));
    });

    if (!chips.length) {
      addChip('Posts');
    }

    return chips.slice(0, 4);
  }

  function searchMatches(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return getPostProducts().filter((product) => {
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

  function initMyPostPage() {
    if (getCurrentPageName() !== PAGE_NAME) return;

    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
    }

    const controller = new AbortController();
    const { signal } = controller;

    const freeTemplatesGrid = document.getElementById('free-templates-grid');
    const recentTemplatesGrid = document.getElementById('recent-templates-grid');
    const postsFeaturedRoot = document.querySelector('[data-posts-featured-root]');
    const postsAllRoot = document.querySelector('[data-posts-all-root]');
    const postsFeaturedFilterButton = document.querySelector('[data-filter="posts-featured"]');
    const postsAllFilterButton = document.querySelector('[data-filter="posts-all"]');
    const postsFeaturedLabel = document.querySelector('[data-posts-featured-label]');
    const postsAllLabel = document.querySelector('[data-posts-all-label]');
    const postsFeaturedDropdown = document.querySelector('[data-posts-featured-dropdown]');
    const postsAllDropdown = document.querySelector('[data-posts-all-dropdown]');
    const postsFeaturedOptions = Array.from(document.querySelectorAll('[data-posts-featured-option]'));
    const postsAllOptions = Array.from(document.querySelectorAll('[data-posts-all-option]'));
    const postsFeaturedCountNodes = Array.from(document.querySelectorAll('[data-posts-featured-count]'));
    const postsAllCountNodes = Array.from(document.querySelectorAll('[data-posts-all-count]'));
    const postsPrimarySectionIcon = document.getElementById('posts-primary-section-icon');
    const postsPrimarySectionTitle = document.getElementById('posts-primary-section-title');
    const postsPrimarySectionCount = document.getElementById('posts-primary-section-count');
    const postsPrimarySeeAllLink = document.getElementById('posts-primary-see-all-link');
    const postsSecondarySectionTitle = document.getElementById('posts-secondary-section-title');
    const postsSecondarySectionCount = document.getElementById('posts-secondary-section-count');
    const postsSecondarySeeAllLink = document.getElementById('posts-secondary-see-all-link');
    const searchInput = document.getElementById('template-search-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    const searchSurface = document.querySelector('.search-input-btn');

    let activeSuggestionIndex = -1;
    let currentSuggestions = [];
    let selectedFeaturedCategory = 'mobile-web-posts';
    let selectedAllPostsCategory = 'all-posts';
    let isPostsLoading = !!(
      window.ProductDataSource &&
      typeof window.ProductDataSource.loadProducts === 'function'
    );
    const initialLoadingStartedAt = Date.now();
    let hasFinalizedInitialLoading = !isPostsLoading;

    const FEATURED_CATEGORY_CONFIG = {
      'mobile-posts': {
        label: 'Mobile Posts',
        title: 'Mobile Posts',
        icon: 'ASSET/Icons/filter-free-paid-icon.svg',
      },
      'web-posts': {
        label: 'Web Posts',
        title: 'Web Posts',
        icon: 'ASSET/Icons/dropdown-free-icon.svg',
      },
      'mobile-web-posts': {
        label: 'Mobile & Web',
        title: 'Mobile & Web',
        icon: 'ASSET/Icons/dropdown-paid-icon.svg',
      },
    };

    const ALL_POSTS_CATEGORY_CONFIG = {
      'all-posts': {
        label: 'All Posts',
        title: 'Mobile & Web Posts',
        icon: 'ASSET/Icons/dropdown-paid-icon.svg',
      },
      trending: {
        label: 'Trending',
        title: 'Trending Mobile & Web Posts',
        icon: 'ASSET/Icons/dropdown-trending-icon.svg',
      },
      popular: {
        label: 'Popular',
        title: 'Popular Mobile & Web Posts',
        icon: 'ASSET/Icons/dropdown-popular-icon.svg',
      },
    };

    function normalizeFeaturedPostsCategory(value) {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replaceAll('&', 'and')
        .replace(/[^a-z0-9-]+/g, '-');

      if (normalized === 'mobile-posts') return 'mobile-posts';
      if (normalized === 'web-posts') return 'web-posts';
      if (normalized === 'mobile-web-posts' || normalized === 'mobile-and-web-posts') return 'mobile-web-posts';
      return 'mobile-web-posts';
    }

    function getInitialFeaturedPostsCategoryFromUrl() {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const category = params.get('category');
        return normalizeFeaturedPostsCategory(category);
      } catch {
        return 'mobile-web-posts';
      }
    }

    selectedFeaturedCategory = getInitialFeaturedPostsCategoryFromUrl();

    function normalizeAllPostsCategory(value) {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-');

      if (normalized === 'trending') return 'trending';
      if (normalized === 'popular') return 'popular';
      return 'all-posts';
    }

    function getFeaturedPostsByCategory(category) {
      const featuredPostsPool = getFeaturedPostsPool();
      const normalized = normalizeFeaturedPostsCategory(category);
      if (normalized === 'mobile-posts') {
        return featuredPostsPool.filter((product) => getPostCategoryKey(product) === 'mobile-posts');
      }
      if (normalized === 'web-posts') {
        return featuredPostsPool.filter((product) => getPostCategoryKey(product) === 'web-posts');
      }
      const mobileAndWebPosts = featuredPostsPool.filter((product) => getPostCategoryKey(product) === 'mobile-web-posts');
      return mobileAndWebPosts.length ? mobileAndWebPosts : featuredPostsPool;
    }

    function getAllPostsFilterGroups(product) {
      const allPostsPool = getAllPostsPool();
      const groups = ['all-posts'];
      const poolIndex = allPostsPool.findIndex((item) => item.slug === product.slug);
      const stableIndex = poolIndex >= 0 ? poolIndex : 0;

      if (isTrendingPost(product, stableIndex)) {
        groups.push('trending');
      }

      if (isPopularPost(product)) {
        groups.push('popular');
      }

      return groups;
    }

    function isPopularPost(product) {
      const tags = Array.isArray(product.tags) ? product.tags : [];
      const detailTags = Array.isArray(product.detailTags) ? product.detailTags : [];
      const mergedTags = tags.concat(detailTags).join(' ').toLowerCase();
      return mergedTags.includes('popular');
    }

    function isTrendingPost(product, index) {
      const tags = Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : '';
      const categoryText = String(product.category || '').toLowerCase();
      if (/trend|fintech|dashboard|travel|health|app/.test(tags + ' ' + categoryText)) {
        return true;
      }
      return index % 2 === 0;
    }

    function getAllPostsByCategory(category) {
      const allPostsPool = getAllPostsPool();
      const normalized = normalizeAllPostsCategory(category);
      if (normalized === 'all-posts') {
        return allPostsPool.slice(0, 4);
      }

      const filtered = allPostsPool.filter((product) => getAllPostsFilterGroups(product).includes(normalized));
      if (normalized === 'popular' && !filtered.length) {
        return allPostsPool.slice(0, 2);
      }

      return filtered.slice(0, 4);
    }

    const postsCountNodes = [
      postsPrimarySectionCount,
      postsSecondarySectionCount,
      ...postsFeaturedCountNodes,
      ...postsAllCountNodes,
    ].filter(Boolean);

    function setPostsCountLoadingState(isLoading) {
      postsCountNodes.forEach((node) => {
        node.classList.toggle('count-skeleton', isLoading);
        if (isLoading) {
          node.textContent = '';
          node.setAttribute('aria-busy', 'true');
        } else {
          node.removeAttribute('aria-busy');
        }
      });
    }

    function updatePostsDropdownCounts() {
      if (isPostsLoading) return;

      const featuredCounts = {
        'mobile-posts': getFeaturedPostsByCategory('mobile-posts').length,
        'web-posts': getFeaturedPostsByCategory('web-posts').length,
        'mobile-web-posts': getFeaturedPostsByCategory('mobile-web-posts').length,
      };

      postsFeaturedCountNodes.forEach((node) => {
        const category = node.getAttribute('data-posts-featured-count');
        node.textContent = String(featuredCounts[category] || 0);
      });

      const allCounts = {
        'all-posts': getAllPostsByCategory('all-posts').length,
        trending: getAllPostsByCategory('trending').length,
        popular: getAllPostsByCategory('popular').length,
      };

      postsAllCountNodes.forEach((node) => {
        const category = node.getAttribute('data-posts-all-count');
        node.textContent = String(allCounts[category] || 0);
      });
    }

    function openPostsFeaturedDropdown() {
      if (!postsFeaturedFilterButton || !postsFeaturedDropdown) return;
      postsFeaturedDropdown.hidden = false;
      postsFeaturedFilterButton.classList.add('is-open');
      postsFeaturedFilterButton.setAttribute('aria-expanded', 'true');
    }

    function closePostsFeaturedDropdown() {
      if (!postsFeaturedFilterButton || !postsFeaturedDropdown) return;
      postsFeaturedDropdown.hidden = true;
      postsFeaturedFilterButton.classList.remove('is-open');
      postsFeaturedFilterButton.setAttribute('aria-expanded', 'false');
    }

    function openPostsAllDropdown() {
      if (!postsAllFilterButton || !postsAllDropdown) return;
      postsAllDropdown.hidden = false;
      postsAllFilterButton.classList.add('is-open');
      postsAllFilterButton.setAttribute('aria-expanded', 'true');
    }

    function closePostsAllDropdown() {
      if (!postsAllFilterButton || !postsAllDropdown) return;
      postsAllDropdown.hidden = true;
      postsAllFilterButton.classList.remove('is-open');
      postsAllFilterButton.setAttribute('aria-expanded', 'false');
    }

    function setActiveFeaturedPostsOption(category) {
      postsFeaturedOptions.forEach((option) => {
        const isActive = normalizeFeaturedPostsCategory(option.getAttribute('data-posts-featured-option')) === category;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function setActiveAllPostsOption(category) {
      postsAllOptions.forEach((option) => {
        const isActive = normalizeAllPostsCategory(option.getAttribute('data-posts-all-option')) === category;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function applyFeaturedPostsCategory(category) {
      const normalized = normalizeFeaturedPostsCategory(category);
      const config = FEATURED_CATEGORY_CONFIG[normalized] || FEATURED_CATEGORY_CONFIG['mobile-web-posts'];
      const templates = getFeaturedPostsByCategory(normalized);

      selectedFeaturedCategory = normalized;

      if (postsFeaturedLabel) {
        postsFeaturedLabel.textContent = config.label;
      }

      if (postsPrimarySectionTitle) {
        postsPrimarySectionTitle.textContent = config.title;
      }

      if (postsPrimarySectionIcon) {
        postsPrimarySectionIcon.src = config.icon;
      }

      if (postsPrimarySectionCount) {
        postsPrimarySectionCount.textContent = isPostsLoading ? '' : String(templates.length);
        postsPrimarySectionCount.classList.toggle('count-skeleton', isPostsLoading);
      }

      if (postsPrimarySeeAllLink) {
        const linkCategory = 'free-paid';
        postsPrimarySeeAllLink.setAttribute('data-template-category', linkCategory);
        postsPrimarySeeAllLink.setAttribute('href', buildFilterTemplateUrl(linkCategory));
      }

      if (freeTemplatesGrid) {
        if (templates.length) {
          freeTemplatesGrid.innerHTML = templates.map(productCard).join('');
        } else {
          const emptyCopyByCategory = {
            'mobile-posts': 'No mobile posts available right now.',
            'web-posts': 'No web posts available right now.',
            'mobile-web-posts': 'No mobile or web posts available right now.',
          };

          const emptyCopy = emptyCopyByCategory[normalized] || emptyCopyByCategory['mobile-web-posts'];
          freeTemplatesGrid.innerHTML = `
            <div class="product-grid-empty" role="status" aria-live="polite">
              <p class="product-grid-empty-title">No Posts Found</p>
              <p class="product-grid-empty-copy">${emptyCopy}</p>
            </div>`;
        }
      }

      setActiveFeaturedPostsOption(normalized);
    }

    function applyAllPostsCategory(category) {
      const normalized = normalizeAllPostsCategory(category);
      const config = ALL_POSTS_CATEGORY_CONFIG[normalized] || ALL_POSTS_CATEGORY_CONFIG['all-posts'];
      const templates = getAllPostsByCategory(normalized);

      selectedAllPostsCategory = normalized;

      if (postsAllLabel) {
        postsAllLabel.textContent = config.label;
      }

      if (postsPrimarySectionTitle) {
        postsPrimarySectionTitle.textContent = config.title;
      }

      if (postsPrimarySectionIcon) {
        postsPrimarySectionIcon.src = config.icon;
      }

      if (postsPrimarySectionCount) {
        postsPrimarySectionCount.textContent = isPostsLoading ? '' : String(templates.length);
        postsPrimarySectionCount.classList.toggle('count-skeleton', isPostsLoading);
      }

      if (postsPrimarySeeAllLink) {
        const linkCategory = normalized === 'all-posts' ? 'free-paid' : 'recent';
        postsPrimarySeeAllLink.setAttribute('data-template-category', linkCategory);
        postsPrimarySeeAllLink.setAttribute('href', buildFilterTemplateUrl(linkCategory));
      }

      if (freeTemplatesGrid) {
        if (templates.length) {
          freeTemplatesGrid.innerHTML = templates
            .map((product) => productCard(product, { hiddenFilterGroups: getAllPostsFilterGroups(product) }))
            .join('');
        } else {
          freeTemplatesGrid.innerHTML = `
            <div class="product-grid-empty" role="status" aria-live="polite">
              <p class="product-grid-empty-title">No Posts Found</p>
              <p class="product-grid-empty-copy">No posts available in this section right now.</p>
            </div>`;
        }
      }

      setActiveAllPostsOption(normalized);
    }

    function applyRecentPostsSection() {
      const templates = getAllPostsByCategory('all-posts');

      if (postsSecondarySectionTitle) {
        postsSecondarySectionTitle.textContent = 'Recent Posts';
      }

      if (postsSecondarySectionCount) {
        postsSecondarySectionCount.textContent = isPostsLoading ? '' : String(templates.length);
        postsSecondarySectionCount.classList.toggle('count-skeleton', isPostsLoading);
      }

      if (postsSecondarySeeAllLink) {
        postsSecondarySeeAllLink.setAttribute('data-template-category', 'recent');
        postsSecondarySeeAllLink.setAttribute('href', buildFilterTemplateUrl('recent'));
      }

      if (recentTemplatesGrid) {
        if (templates.length) {
          recentTemplatesGrid.innerHTML = templates
            .map((product) => productCard(product, { hiddenFilterGroups: ['all-posts'] }))
            .join('');
        } else {
          recentTemplatesGrid.innerHTML = `
            <div class="product-grid-empty" role="status" aria-live="polite">
              <p class="product-grid-empty-title">No Posts Found</p>
              <p class="product-grid-empty-copy">No recent posts available right now.</p>
            </div>`;
        }
      }
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
      window.location.href = `my-post-detail.html?product=${encodeURIComponent(slug)}`;
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
          <a class="search-suggestion" href="my-post-detail.html?product=${encodeURIComponent(product.slug)}" data-product-slug="${product.slug}" data-index="${index}">
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
        : '<p class="search-suggestions-empty">No matching posts found.</p>';

      searchSuggestions.hidden = false;
      searchSuggestions.innerHTML = `
        <div class="search-suggestions-panel">
          <section class="search-suggestions-section">
            <div class="search-suggestions-section-title">Explore related post collections</div>
            <div class="search-collection-tags">${chips}</div>
          </section>
          <section class="search-suggestions-section">
            <div class="search-suggestions-section-title">Posts</div>
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
      if (isPostsLoading) return;

      applyFeaturedPostsCategory(selectedFeaturedCategory);
      applyAllPostsCategory(selectedAllPostsCategory);
      applyRecentPostsSection();
    }

    function rehydratePostsFromSource() {
      setPostsCountLoadingState(false);
      updatePostsDropdownCounts();
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
        isPostsLoading = false;
        if (window.ProductDataSource && typeof window.ProductDataSource.getSource === 'function') {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }
        rehydratePostsFromSource();
        document.dispatchEvent(new CustomEvent('app:layoutReady'));
      }, remaining);
    }

    const isFirstBoot = !window.__motvin_spa_booted;
    window.__motvin_spa_booted = true;

    const hasCache = Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
    isPostsLoading = isFirstBoot || !hasCache;

    setPostsCountLoadingState(isPostsLoading);
    updatePostsDropdownCounts();

    if (isPostsLoading) {
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

        if (isPostsLoading) {
          finalizeInitialLoading();
          return;
        }

        if (window.ProductDataSource.getSource) {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }
        rehydratePostsFromSource();
      }, { signal });
    } else {
      isPostsLoading = false;
      setPostsCountLoadingState(false);
      renderProductGrids();
    }

    if (postsFeaturedFilterButton && postsFeaturedDropdown) {
      postsFeaturedFilterButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (event.target.closest('[data-posts-featured-option]')) {
          return;
        }

        if (postsFeaturedDropdown.hidden) {
          closePostsAllDropdown();
          openPostsFeaturedDropdown();
        } else {
          closePostsFeaturedDropdown();
        }
      }, { signal });
    }

    if (postsAllFilterButton && postsAllDropdown) {
      postsAllFilterButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (event.target.closest('[data-posts-all-option]')) {
          return;
        }

        if (postsAllDropdown.hidden) {
          closePostsFeaturedDropdown();
          openPostsAllDropdown();
        } else {
          closePostsAllDropdown();
        }
      }, { signal });
    }

    postsFeaturedOptions.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const category = normalizeFeaturedPostsCategory(option.getAttribute('data-posts-featured-option'));
        applyFeaturedPostsCategory(category);
        closePostsFeaturedDropdown();
      }, { signal });
    });

    postsAllOptions.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const category = normalizeAllPostsCategory(option.getAttribute('data-posts-all-option'));
        applyAllPostsCategory(category);
        closePostsAllDropdown();
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

      const insidePostsFeaturedDropdown = postsFeaturedFilterButton && postsFeaturedFilterButton.contains(event.target);
      const insidePostsFeaturedRoot = postsFeaturedRoot && postsFeaturedRoot.contains(event.target);
      if (!insidePostsFeaturedDropdown && !insidePostsFeaturedRoot) {
        closePostsFeaturedDropdown();
      }

      const insidePostsAllDropdown = postsAllFilterButton && postsAllFilterButton.contains(event.target);
      const insidePostsAllRoot = postsAllRoot && postsAllRoot.contains(event.target);
      if (!insidePostsAllDropdown && !insidePostsAllRoot) {
        closePostsAllDropdown();
      }

      const clickedCard = event.target.closest('.product-card');
      if (!clickedCard) return;

      const slug = clickedCard.dataset.productSlug;
      if (window.ProductTopPaneTabs) {
        window.ProductTopPaneTabs.rememberOpenedProductSlug(slug, { skipRefresh: true });
      }

       event.preventDefault();
       if (slug) {
         window.location.href = `my-post-detail.html?product=${encodeURIComponent(slug)}`;
       }
    }, { signal });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePostsFeaturedDropdown();
        closePostsAllDropdown();
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
  window.PageModules[PAGE_NAME] = initMyPostPage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMyPostPage, { once: true });
  } else {
    initMyPostPage();
  }
})();

