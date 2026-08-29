// my-post-detail.js: Scripts only for my-post-detail.html.
(function initMyPostDetailPage() {
  const SAVED_STORAGE_KEY = 'savedProductSlugs';

  let hydratedProducts = [];
  let pendingSoftNav = null;
  let softNavLoadPromise = null;
  let activeProductSlug = '';
  let toastTimerId = null;

  function getRequestedSlug() {
    const detailParams = new URLSearchParams(window.location.search);
    return String(detailParams.get('product') || '').trim();
  }

  function normalizeType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'design-post' || normalized === 'design-posts') return 'design-post';
    return 'template';
  }

  function detailValue(product, key, fallback) {
    const value = product && product[key];
    if (value == null || value === '') return fallback;
    return value;
  }

  function asArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function getProducts() {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function getSavedProductSlugs() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function setSavedProductSlugs(slugs) {
    const unique = [];
    (Array.isArray(slugs) ? slugs : []).forEach((slug) => {
      const key = String(slug || '').trim();
      if (!key || unique.includes(key)) return;
      unique.push(key);
    });
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(unique));
  }

  function isSavedProduct(slug) {
    const key = String(slug || '').trim();
    if (!key) return false;
    return getSavedProductSlugs().includes(key);
  }

  function setSavedProduct(slug, saved) {
    const key = String(slug || '').trim();
    if (!key) return false;

    const current = getSavedProductSlugs();
    const has = current.includes(key);

    if (saved && !has) {
      current.push(key);
      setSavedProductSlugs(current);
      return true;
    }

    if (!saved && has) {
      setSavedProductSlugs(current.filter((item) => item !== key));
      return false;
    }

    return has;
  }

  function updateDetailSaveMenuState(saved) {
    const saveButton = document.getElementById('detail-more-save');
    if (!saveButton) return;

    const iconNode = saveButton.querySelector('.detail-more-menu-icon img');
    const labelNode = saveButton.querySelector('.detail-more-menu-item-main span:last-child');
    const isSaved = Boolean(saved);

    if (iconNode) {
      iconNode.src = isSaved
        ? 'ASSET/Icons/detail-more-saved.svg'
        : 'ASSET/Icons/detail-more-save.svg';
    }

    if (labelNode) {
      labelNode.textContent = isSaved ? 'Saved' : 'Save';
    }
  }

  function showDetailToast(saved) {
    let toast = document.getElementById('detail-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'detail-toast';
      toast.className = 'detail-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.innerHTML = `
        <span class="detail-toast-content">
          <img class="detail-toast-icon" src="ASSET/Icons/detail-more-save.svg" alt="" />
          <span class="detail-toast-text"></span>
        </span>`;
      document.body.appendChild(toast);
    }

    const isSaved = Boolean(saved);
    const iconNode = toast.querySelector('.detail-toast-icon');
    const textNode = toast.querySelector('.detail-toast-text');

    if (iconNode) {
      iconNode.src = isSaved
        ? 'ASSET/Icons/detail-more-saved.svg'
        : 'ASSET/Icons/detail-toast-removed.svg';
    }

    if (textNode) {
      textNode.textContent = isSaved ? 'Saved to your collection' : 'Removed from saved';
    }

    // Restart motion when toast is triggered repeatedly while already visible.
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');

    if (toastTimerId) {
      window.clearTimeout(toastTimerId);
    }

    toastTimerId = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1400);
  }

  function normalizeCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function formatCount(value) {
    if (window.ProductStatsService && typeof window.ProductStatsService.formatCount === 'function') {
      return window.ProductStatsService.formatCount(value);
    }
    return String(normalizeCount(value));
  }

  function applyStatsToLocalProduct(slug, stats) {
    const key = String(slug || '').trim();
    if (!key || !stats) return;

    hydratedProducts = hydratedProducts.map((product) => {
      if (!product || product.slug !== key) return product;

      const likesCount = normalizeCount(stats.likesCount);
      const viewsCount = normalizeCount(stats.viewsCount);

      return {
        ...product,
        likes: likesCount,
        views: viewsCount,
        likeCount: formatCount(likesCount),
        trendCount: formatCount(viewsCount),
        likedByCurrentUser: Boolean(stats.likedByCurrentUser),
      };
    });
  }

  function updateDetailStatNodes(stats) {
    if (!stats) return;

    const likeNode = document.getElementById('detail-meta-like-count');
    const visitNode = document.getElementById('detail-meta-visit-count');
    const likeIcon = document.getElementById('detail-meta-like-icon');

    const likesCount = normalizeCount(stats.likesCount);
    const viewsCount = normalizeCount(stats.viewsCount);
    const likedByCurrentUser = Boolean(stats.likedByCurrentUser);

    if (likeNode) likeNode.textContent = formatCount(likesCount);
    if (visitNode) visitNode.textContent = `${formatCount(viewsCount)} users`;
    if (likeIcon) {
      likeIcon.src = likedByCurrentUser
        ? 'ASSET/Icons/product-card-stat-like-active.svg'
        : 'ASSET/Icons/product-card-stat-like.svg';
    }

    updateDetailMoreLikeMenuState(likedByCurrentUser);
  }

  function updateDetailMoreLikeMenuState(likedByCurrentUser) {
    const detailLikeButton = document.getElementById('detail-more-like');
    if (!detailLikeButton) return;

    const iconNode = detailLikeButton.querySelector('.detail-more-menu-icon img');
    const labelNode = detailLikeButton.querySelector('.detail-more-menu-item-main span:last-child');
    const liked = Boolean(likedByCurrentUser);

    if (iconNode) {
      iconNode.src = liked
        ? 'ASSET/Icons/detail-more-unlike.svg'
        : 'ASSET/Icons/product-card-stat-like.svg';
    }

    if (labelNode) {
      labelNode.textContent = liked ? 'Unlike' : 'Like';
    }
  }

  function queueSoftNavigation(slug, options) {
    if (!(window.ProductDataSource && typeof window.ProductDataSource.loadProducts === 'function')) {
      return false;
    }

    pendingSoftNav = {
      slug: String(slug || '').trim(),
      options: options || {},
    };

    if (softNavLoadPromise) {
      return true;
    }

    softNavLoadPromise = window.ProductDataSource.loadProducts()
      .catch(() => {})
      .finally(() => {
        const latestProducts = getProducts();
        hydratedProducts = latestProducts;

        if (window.ProductDataSource && typeof window.ProductDataSource.getSource === 'function') {
          document.body.dataset.productSource = window.ProductDataSource.getSource();
        }

        const nextNav = pendingSoftNav;
        pendingSoftNav = null;
        softNavLoadPromise = null;

        if (!latestProducts.length || !nextNav || !nextNav.slug) return;
        renderBySlug(nextNav.slug, nextNav.options);
      });

    return true;
  }

  function findActiveProduct(products) {
    const slug = getRequestedSlug();
    if (!slug) return null;

    const direct = products.find((product) => product.slug === slug);
    if (!direct) return null;
    if (normalizeType(direct.productType) !== 'design-post') return null;
    return direct;
  }

  function renderFeature(feature) {
    return `<li>${feature}</li>`;
  }

  function renderTag(tag) {
    const normalizedTag = String(tag || '').trim().replace(/^#+\s*/, '');
    return `<span>#${normalizedTag}</span>`;
  }

  function renderProductCard(product) {
    return `
      <a class="detail-similar-card" href="my-post-detail.html?product=${encodeURIComponent(product.slug)}">
        <article class="detail-similar-card-section">
          <div class="detail-similar-card-image-wrap">
            <img class="detail-similar-card-image" src="${product.image}" alt="${product.title}" />
          </div>
          <div class="detail-similar-card-content">
            <div class="detail-similar-card-title-wrap">
              <h4 class="detail-similar-card-title">${product.title}</h4>
              <p class="detail-similar-card-meta">By ${product.author} • ${product.category}</p>
            </div>
          </div>
        </article>
      </a>`;
  }

  function buildHeroGalleryImages(product) {
    const gallery = asArray(product.gallery);
    const fallback = product.image || 'ASSET/Images/product-screenshot.png';
    const images = gallery.length ? gallery.slice(0, 3) : [fallback];

    while (images.length < 3) {
      images.push(images[images.length - 1] || fallback);
    }

    return images.slice(0, 3);
  }

  function initHeroGallery(product) {
    const track = document.getElementById('detail-hero-image-track');
    const thumbnails = document.getElementById('detail-hero-thumbnails');
    if (!track || !thumbnails) return;

    const images = buildHeroGalleryImages(product);
    track.innerHTML = images
      .map((src, index) => `
        <div class="detail-hero-image-slide">
          <img src="${src}" alt="${product.title} preview ${index + 1}" />
        </div>`)
      .join('');

    thumbnails.innerHTML = images
      .map((src, index) => `
        <button class="detail-hero-thumb${index === 0 ? ' is-active' : ''}" type="button" data-gallery-index="${index}" aria-label="Show preview ${index + 1}">
          <img src="${src}" alt="" />
        </button>`)
      .join('');

    function setActive(index) {
      const bounded = Math.max(0, Math.min(images.length - 1, index));
      track.style.transform = `translateX(-${bounded * 100}%)`;
      thumbnails.querySelectorAll('.detail-hero-thumb').forEach((thumb, thumbIndex) => {
        const isActive = thumbIndex === bounded;
        thumb.classList.toggle('is-active', isActive);
        thumb.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    thumbnails.onclick = (event) => {
      const trigger = event.target.closest('.detail-hero-thumb');
      if (!trigger) return;
      setActive(Number(trigger.dataset.galleryIndex || 0));
    };

    setActive(0);
  }

  function renderRelatedPosts(activeProduct, products) {
    const relatedTemplatesGrid = document.getElementById('related-templates-grid');
    const similarCount = document.getElementById('detail-similar-count');
    if (!relatedTemplatesGrid) return;

    const related = products
      .filter((product) => product.slug !== activeProduct.slug)
      .filter((product) => normalizeType(product.productType) === 'design-post')
      .slice(0, 3);

    relatedTemplatesGrid.innerHTML = related.map(renderProductCard).join('');

    if (similarCount) {
      similarCount.textContent = String(related.length);
    }
  }

  function renderProduct(activeProduct, products) {
    activeProductSlug = String(activeProduct.slug || '').trim();

    document.title = `${detailValue(activeProduct, 'detailPageTitle', activeProduct.title)} - Siren.uix Marketplace`;

    document.getElementById('detail-frame-title').textContent = detailValue(activeProduct, 'detailPageTitle', activeProduct.title);
    document.getElementById('detail-frame-subtitle').textContent = detailValue(activeProduct, 'detailPageSubtitle', activeProduct.summary || activeProduct.description || '');
    document.getElementById('detail-breadcrumb-category').textContent = activeProduct.category;
    document.getElementById('detail-breadcrumb-title').textContent = detailValue(activeProduct, 'detailPageTitle', activeProduct.title);
    document.getElementById('detail-creator-name').textContent = activeProduct.author;
    document.getElementById('detail-headline').textContent = detailValue(activeProduct, 'detailHeadline', activeProduct.title);

    const detailMetaLine = detailValue(activeProduct, 'detailMeta', activeProduct.category).split('•').map((part) => part.trim());
    const detailMetaCategory = detailMetaLine[0] || activeProduct.category;
    const detailMetaLikes = formatCount(activeProduct.likes || 0);
    const detailMetaUsers = `${formatCount(activeProduct.views || 0)} users`;
    const likeIconSrc = activeProduct.likedByCurrentUser
      ? 'ASSET/Icons/product-card-stat-like-active.svg'
      : 'ASSET/Icons/product-card-stat-like.svg';
    document.getElementById('detail-meta-line').innerHTML = `
      <span class="detail-meta-category">${detailMetaCategory}</span>
      <span class="detail-meta-dot" aria-hidden="true">•</span>
      <span class="detail-meta-stats">
        <span class="detail-meta-stat">
          <img id="detail-meta-like-icon" src="${likeIconSrc}" alt="" />
          <span id="detail-meta-like-count">${detailMetaLikes}</span>
        </span>
        <span class="detail-meta-stat">
          <img src="ASSET/Icons/product-card-stat-trend.svg" alt="" />
          <span id="detail-meta-visit-count">${detailMetaUsers}</span>
        </span>
      </span>`;

    document.getElementById('detail-buy-text').textContent = 'Visit Post';
    document.getElementById('detail-preview-text').textContent = 'Preview';
    document.getElementById('detail-preview-link').href = detailValue(activeProduct, 'previewLink', '#');
    document.getElementById('detail-learn-more-link').href = detailValue(activeProduct, 'learnMoreLink', detailValue(activeProduct, 'previewLink', '#'));

    initHeroGallery(activeProduct);

    document.getElementById('detail-about-intro').textContent = detailValue(activeProduct, 'detailAboutIntro', activeProduct.description || '');
    document.getElementById('detail-feature-heading').textContent = detailValue(activeProduct, 'detailFeatureHeading', "What's Inside:");

    const features = asArray(detailValue(activeProduct, 'detailFeatures', activeProduct.includes || activeProduct.detailTags));
    document.getElementById('detail-feature-list').innerHTML = features.map(renderFeature).join('');

    const detailAboutOutroNode = document.getElementById('detail-about-outro');
    if (detailAboutOutroNode) {
      detailAboutOutroNode.textContent = detailValue(activeProduct, 'detailAboutOutro', activeProduct.description || '');
    }
    document.getElementById('detail-category-pill-text').textContent = activeProduct.category;

    const tags = asArray(detailValue(activeProduct, 'tags', activeProduct.tags || activeProduct.detailTags));
    document.getElementById('detail-tag-cloud').innerHTML = tags.map(renderTag).join('');

    document.getElementById('detail-source-link').href = detailValue(activeProduct, 'sourceLink', detailValue(activeProduct, 'previewLink', '#'));
    document.getElementById('detail-last-updated').textContent = detailValue(activeProduct, 'detailLastUpdated', '');
    document.getElementById('detail-license-link').textContent = detailValue(activeProduct, 'detailLicense', '');

    updateDetailMoreLikeMenuState(Boolean(activeProduct.likedByCurrentUser));
    updateDetailSaveMenuState(isSavedProduct(activeProductSlug));

    renderRelatedPosts(activeProduct, products);

    document.body.removeAttribute('data-detail-loading');

    if (window.ProductStatsService && typeof window.ProductStatsService.trackVisit === 'function') {
      window.ProductStatsService.trackVisit(activeProductSlug).catch(() => {
        // Keep page resilient if stats write fails.
      });
    }

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.init({
        containerId: 'detail-top-pane-product-tabs',
        activeSlug: activeProduct.slug,
      });
    }
  }

  function bindDetailLinks() {
    const detailSeeAllLink = document.querySelector('.detail-see-all-link');
    if (detailSeeAllLink) {
      detailSeeAllLink.addEventListener('click', () => {
        if (!window.ProductTopPaneTabs) return;
        const filterTabSlug = window.ProductTopPaneTabs.buildFilterTabSlug
          ? window.ProductTopPaneTabs.buildFilterTabSlug('free-paid')
          : 'filter:free-paid';
        window.ProductTopPaneTabs.rememberOpenedProductSlug(filterTabSlug);
      });
    }

    const detailBackLink = document.querySelector('.detail-back-link');
    if (detailBackLink) {
      detailBackLink.addEventListener('click', (event) => {
        event.preventDefault();

        const currentSlug = getRequestedSlug();
        if (currentSlug && window.ProductTopPaneTabs) {
          window.ProductTopPaneTabs.rememberOpenedProductSlug(currentSlug, { skipRefresh: true });
        }

        window.location.href = '/my-post';
      });
    }

    const detailMoreWrap = document.querySelector('.detail-more-wrap');
    const detailMoreToggle = document.getElementById('detail-more-link');
    const detailMoreMenu = document.getElementById('detail-more-menu');

    if (detailMoreWrap && detailMoreToggle && detailMoreMenu) {
      const closeDetailMoreMenu = () => {
        detailMoreMenu.hidden = true;
        detailMoreToggle.setAttribute('aria-expanded', 'false');
      };

      detailMoreToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const shouldOpen = detailMoreMenu.hidden;
        closeDetailMoreMenu();

        if (shouldOpen) {
          detailMoreMenu.hidden = false;
          detailMoreToggle.setAttribute('aria-expanded', 'true');
        }
      });

      detailMoreMenu.querySelectorAll('.detail-more-menu-item').forEach((item) => {
        item.addEventListener('click', () => {
          closeDetailMoreMenu();
        });
      });

      const detailLikeButton = document.getElementById('detail-more-like');
      if (detailLikeButton && detailLikeButton.dataset.likeBound !== 'true') {
        detailLikeButton.dataset.likeBound = 'true';
        detailLikeButton.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (detailLikeButton.dataset.likeBusy === 'true') return;
          detailLikeButton.dataset.likeBusy = 'true';

          try {
            const slug = activeProductSlug || getRequestedSlug();
            const statsService = window.ProductStatsService;
            if (!slug || !statsService || typeof statsService.toggleLike !== 'function') {
              throw new Error('Like service unavailable.');
            }

            const result = await statsService.toggleLike(slug);
            if (result && result.stats) {
              applyStatsToLocalProduct(slug, result.stats);
              updateDetailStatNodes(result.stats);
            }
          } catch (error) {
            window.alert(error && error.message ? error.message : 'Unable to update like right now.');
          } finally {
            detailLikeButton.dataset.likeBusy = 'false';
          }
        });
      }

      const detailSaveButton = document.getElementById('detail-more-save');
      if (detailSaveButton && detailSaveButton.dataset.saveBound !== 'true') {
        detailSaveButton.dataset.saveBound = 'true';
        detailSaveButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const slug = activeProductSlug || getRequestedSlug();
          if (!slug) return;

          const nextSaved = setSavedProduct(slug, !isSavedProduct(slug));
          updateDetailSaveMenuState(nextSaved);
          showDetailToast(nextSaved);
        });
      }

      document.addEventListener('click', (event) => {
        if (!event.target.closest('.detail-more-wrap')) {
          closeDetailMoreMenu();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeDetailMoreMenu();
        }
      });
    }
  }

  function renderBySlug(slug, options) {
    const opts = options || {};
    const products = hydratedProducts.length ? hydratedProducts : getProducts();
    if (!products.length) {
      document.body.setAttribute('data-detail-loading', '');
      return queueSoftNavigation(slug, opts);
    }

    const normalizedSlug = String(slug || '').trim();
    if (!normalizedSlug) {
      document.body.removeAttribute('data-detail-loading');
      return false;
    }

    const activeProduct = products.find((product) => product.slug === normalizedSlug && normalizeType(product.productType) === 'design-post') || null;

    if (!activeProduct) {
      document.body.removeAttribute('data-detail-loading');
      return false;
    }

    if (opts.updateHistory !== false) {
      const nextUrl = opts.url || `my-post-detail.html?product=${encodeURIComponent(activeProduct.slug)}`;
      if (nextUrl !== window.location.href) {
        window.history.pushState({ product: activeProduct.slug }, '', nextUrl);
      }
    }

    renderProduct(activeProduct, products);
    return true;
  }

  async function bootstrap() {
    bindDetailLinks();

    const requestedSlug = getRequestedSlug();
    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.init({
        containerId: 'detail-top-pane-product-tabs',
        activeSlug: requestedSlug || null,
      });
    }

    let products = getProducts();
    hydratedProducts = products;
    const activeProduct = findActiveProduct(products);

    if (activeProduct) {
      renderProduct(activeProduct, products);
    } else {
      document.body.setAttribute('data-detail-loading', '');
    }

    if (window.ProductDataSource && typeof window.ProductDataSource.loadProducts === 'function') {
      window.ProductDataSource.loadProducts().then(() => {
        const freshProducts = getProducts();
        hydratedProducts = freshProducts;
        const freshActive = findActiveProduct(freshProducts);
        if (freshActive) {
          renderProduct(freshActive, freshProducts);
        } else if (!activeProduct) {
          document.body.removeAttribute('data-detail-loading');
          document.title = 'Post Not Found - Siren.uix Marketplace';
          const ft = document.getElementById('detail-frame-title');
          if (ft) ft.textContent = 'Post not found';
          const fs = document.getElementById('detail-frame-subtitle');
          if (fs) fs.textContent = 'No live post was found for this page.';
        }
      }).catch(() => {
        document.body.removeAttribute('data-detail-loading');
      });
    } else if (!activeProduct) {
      document.body.removeAttribute('data-detail-loading');
      document.title = 'Post Not Found - Siren.uix Marketplace';
      const ft = document.getElementById('detail-frame-title');
      if (ft) ft.textContent = 'Post not found';
      const fs = document.getElementById('detail-frame-subtitle');
      if (fs) fs.textContent = 'No live post was found for this page.';
    }

    if (window.ProductDataSource && typeof window.ProductDataSource.getSource === 'function') {
      document.body.dataset.productSource = window.ProductDataSource.getSource();
    }

    document.dispatchEvent(new CustomEvent('app:layoutReady'));
  }

  window.MyPostDetailPage = {
    navigateToSlug(slug, options) {
      return renderBySlug(slug, options);
    },
  };

  document.addEventListener('product-stats:updated', (event) => {
    const detail = event && event.detail ? event.detail : {};
    const slug = String(detail.slug || '').trim();
    if (!slug || !detail.stats) return;
    if (slug !== activeProductSlug) return;

    applyStatsToLocalProduct(slug, detail.stats);
    updateDetailStatNodes(detail.stats);
  });

  window.addEventListener('popstate', () => {
    renderBySlug(getRequestedSlug(), { updateHistory: false });
  });

  bootstrap();

  window.PageModules = window.PageModules || {};
  window.PageModules['my-post-detail.html'] = bootstrap;
})();