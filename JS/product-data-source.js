(function initProductDataSource() {
  let cachedProducts = null;
  let inflightPromise = null;
  let cacheSource = 'fallback';
  let refreshTimerId = null;

  function normalizeProductTypeValue(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replaceAll('&', 'and')
      .replace(/[^a-z0-9]+/g, '-');

    if (!normalized) return '';

    if (
      normalized === 'design-post' ||
      normalized === 'design-posts' ||
      normalized === 'designpost' ||
      normalized === 'post' ||
      normalized === 'posts' ||
      normalized === 'blog' ||
      normalized === 'blog-post' ||
      normalized === 'article' ||
      normalized === 'articles'
    ) {
      return 'design-post';
    }

    if (
      normalized === 'template' ||
      normalized === 'templates' ||
      normalized === 'ui-template' ||
      normalized === 'ui-templates'
    ) {
      return 'template';
    }

    return '';
  }

  function firstNonEmptyValue(raw, keys) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(keys)) return '';

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const value = raw[key];
      if (value == null) continue;

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
    }

    return '';
  }

  function normalizeStringArray(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function normalizePrice(raw) {
    if (!raw || typeof raw !== 'object') return '$0';

    const explicit = firstNonEmptyValue(raw, ['price', 'amount', 'cost', 'templatePrice']);
    if (explicit) {
      const normalizedExplicit = explicit.toLowerCase();
      if (normalizedExplicit === 'free') return 'Free';
      if (/^\$/.test(explicit)) return explicit;

      const numericExplicit = Number(explicit.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(numericExplicit)) {
        if (numericExplicit === 0) return 'Free';
        return `$${numericExplicit}`;
      }
      return explicit;
    }

    if (raw.isFree === true || raw.free === true) {
      return 'Free';
    }

    return '$0';
  }

  function normalizeTimestamp(raw) {
    const ts = firstNonEmptyValue(raw, ['updatedAt', 'createdAt', 'timestamp', 'publishedAt']);
    if (!ts) return 0;

    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return parsed;

    const numeric = Number(ts);
    if (Number.isFinite(numeric)) return numeric;

    return 0;
  }

  function resolveProductType(raw) {
    const explicitType = normalizeProductTypeValue(
      raw && (raw.productType || raw.type || raw.contentType || raw.cardType || raw.kind)
    );
    if (explicitType) return explicitType;

    const haystack = [
      raw && raw.category,
      raw && raw.title,
      raw && raw.summary,
      raw && raw.description,
      raw && Array.isArray(raw.tags) ? raw.tags.join(' ') : '',
      raw && Array.isArray(raw.detailTags) ? raw.detailTags.join(' ') : '',
    ]
      .join(' ')
      .toLowerCase();

    if (/design[\s-]*post|blog[\s-]*post|article|case study|showcase/.test(haystack)) {
      return 'design-post';
    }

    if (/template|templates|ui kit|uikit|dashboard|landing/.test(haystack)) {
      return 'template';
    }

    return 'template';
  }

  function parseFirestoreValue(value) {
    if (!value || typeof value !== 'object') return null;

    if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return Boolean(value.booleanValue);
    if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;

    if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
      const values = value.arrayValue && Array.isArray(value.arrayValue.values)
        ? value.arrayValue.values
        : [];
      return values.map(parseFirestoreValue);
    }

    if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
      const fields = value.mapValue && value.mapValue.fields ? value.mapValue.fields : {};
      const parsed = {};
      Object.keys(fields).forEach((key) => {
        parsed[key] = parseFirestoreValue(fields[key]);
      });
      return parsed;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
    return null;
  }

  function parseFirestoreDocument(doc) {
    if (!doc || !doc.fields) return null;

    const parsed = {};
    Object.keys(doc.fields).forEach((key) => {
      parsed[key] = parseFirestoreValue(doc.fields[key]);
    });

    if (!parsed.slug && typeof doc.name === 'string') {
      const chunks = doc.name.split('/');
      parsed.slug = chunks[chunks.length - 1] || `product-${Date.now()}`;
    }

    return parsed;
  }

  function normalizeProduct(raw, index) {
    if (!raw || typeof raw !== 'object') return null;

    const fallbackSlug = `product-${index + 1}`;
    const slug = String(raw.slug || raw.id || fallbackSlug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallbackSlug;

    const title = firstNonEmptyValue(raw, ['title', 'name', 'productTitle']) || 'Untitled Template';
    const author = firstNonEmptyValue(raw, ['author', 'creator', 'createdBy']) || 'Siren.uix';
    const category = firstNonEmptyValue(raw, ['category', 'categoryLabel', 'templateCategory']) || 'Templates';
    const image = firstNonEmptyValue(raw, ['image', 'imageUrl', 'thumbnail', 'thumbnailUrl', 'coverImage']) || 'ASSET/Images/product-screenshot.png';
    const summary = firstNonEmptyValue(raw, ['summary', 'excerpt', 'shortDescription']);
    const description = firstNonEmptyValue(raw, ['description', 'details', 'longDescription']);
    const tags = normalizeStringArray(raw.tags || raw.keywords);
    const detailTags = normalizeStringArray(raw.detailTags || raw.metaTags);

    const updatedTs = normalizeTimestamp(raw);
    const updatedAt = raw.updatedAt || raw.createdAt || (updatedTs ? new Date(updatedTs).toISOString() : '');

    return {
      ...raw,
      slug,
      productType: resolveProductType(raw),
      title,
      author,
      category,
      price: normalizePrice(raw),
      image,
      summary,
      description,
      tags,
      detailTags,
      updatedAt,
      _updatedTimestamp: updatedTs,
    };
  }

  function hasFirebaseConfig() {
    const config = window.FIREBASE_CONFIG || {};
    return Boolean(config.apiKey && config.projectId);
  }

  async function fetchProductsFromFirestore() {
    const config = window.FIREBASE_CONFIG || {};
    const collection = config.productsCollection || 'products';
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}?key=${encodeURIComponent(config.apiKey)}`;

    const headers = {};
    if (config.authToken) {
      headers.Authorization = `Bearer ${config.authToken}`;
    }

    const response = await fetch(endpoint, {
      credentials: 'omit',
      headers,
    });
    if (!response.ok) {
      throw new Error(`Firebase fetch failed: ${response.status}`);
    }

    const payload = await response.json();
    const docs = Array.isArray(payload.documents) ? payload.documents : [];

    return docs
      .map(parseFirestoreDocument)
      .map(normalizeProduct)
      .filter(Boolean)
      .sort((a, b) => (b._updatedTimestamp || 0) - (a._updatedTimestamp || 0));
  }

  function publishProducts(products, source) {
    window.PRODUCTS = Array.isArray(products) ? products.slice() : [];
    cachedProducts = window.PRODUCTS.slice();
    cacheSource = source || 'fallback';

    document.dispatchEvent(new CustomEvent('products:updated', {
      detail: { products: window.PRODUCTS.slice() },
    }));

    document.dispatchEvent(new CustomEvent('products:source-changed', {
      detail: { source: cacheSource },
    }));

    return window.PRODUCTS.slice();
  }

  function applyStatsPatchToProduct(product, stats) {
    const base = product && typeof product === 'object' ? product : {};
    const input = stats && typeof stats === 'object' ? stats : {};
    const likesCount = Number.isFinite(Number(input.likesCount)) ? Math.max(0, Math.floor(Number(input.likesCount))) : 0;
    const viewsCount = Number.isFinite(Number(input.viewsCount)) ? Math.max(0, Math.floor(Number(input.viewsCount))) : 0;

    const format = window.ProductStatsService && typeof window.ProductStatsService.formatCount === 'function'
      ? window.ProductStatsService.formatCount
      : (value) => String(value);

    return {
      ...base,
      likes: likesCount,
      views: viewsCount,
      likeCount: format(likesCount),
      trendCount: format(viewsCount),
      likedByCurrentUser: Boolean(input.likedByCurrentUser),
    };
  }

  function applyStatsUpdate(slug, stats) {
    const key = String(slug || '').trim();
    if (!key) return;

    const nextProducts = (Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []).map((product) => {
      if (!product || product.slug !== key) return product;
      return applyStatsPatchToProduct(product, stats);
    });

    if (!nextProducts.length) return;

    publishProducts(nextProducts, cacheSource);
  }

  function getProductsByType(type) {
    const normalizedType = normalizeProductTypeValue(type) || 'template';
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];

    return products.filter((product) => resolveProductType(product) === normalizedType);
  }

  // ─── Lightweight data comparison ─────────────────────────────────

  function buildDataFingerprint(products) {
    if (!Array.isArray(products) || !products.length) return '';
    // Fast fingerprint: count + first/last slug + first/last updatedAt
    var first = products[0];
    var last = products[products.length - 1];
    return products.length + ':' +
      (first.slug || '') + '~' + (first.updatedAt || '') + '|' +
      (last.slug || '') + '~' + (last.updatedAt || '');
  }

  // ─── Background Firebase fetch (no skeleton) ─────────────────────

  let backgroundRefreshPromise = null;

  async function fetchAndCacheFromFirebase() {
    if (!hasFirebaseConfig()) return;

    try {
      const products = await fetchProductsFromFirestore();
      if (!products.length) {
        return;
      }

      let finalProducts = products;
      if (window.ProductStatsService && typeof window.ProductStatsService.hydrateProducts === 'function') {
        finalProducts = await window.ProductStatsService.hydrateProducts(products);
      }

      // Only publish + write cache if data actually changed
      const currentFingerprint = buildDataFingerprint(cachedProducts);
      const freshFingerprint = buildDataFingerprint(finalProducts);

      if (currentFingerprint !== freshFingerprint) {
        publishProducts(finalProducts, 'firebase');
        // Fire-and-forget cache write — don't block the render
        if (window.ProductCache && typeof window.ProductCache.setAll === 'function') {
          window.ProductCache.setAll(finalProducts).catch(function () {});
        }
      } else {
        // Data is the same — just update the source tag silently
        cacheSource = 'firebase';
        document.dispatchEvent(new CustomEvent('products:source-changed', {
          detail: { source: 'firebase' },
        }));
      }
    } catch (error) {
      console.warn('ProductDataSource: background refresh failed.', error);
    }
  }

  function backgroundRefresh() {
    if (backgroundRefreshPromise) return backgroundRefreshPromise;

    backgroundRefreshPromise = fetchAndCacheFromFirebase().finally(() => {
      backgroundRefreshPromise = null;
    });

    return backgroundRefreshPromise;
  }

  // ─── Synchronous pre-seeding from ProductCache ──────────────────────

  if (window.ProductCache && typeof window.ProductCache.getAllSync === 'function') {
    const syncProducts = window.ProductCache.getAllSync();
    if (syncProducts && syncProducts.length) {
      cachedProducts = syncProducts;
      cacheSource = 'cache';
    }
  }

  // ─── Main loadProducts (Firebase sync on refresh, cache on navigation) ────

  async function loadProducts(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);

    // If forceRefresh is false, return stored browser storage data immediately
    if (!forceRefresh) {
      if (cachedProducts && cachedProducts.length) {
        publishProducts(cachedProducts, cacheSource || 'cache');
        return cachedProducts.slice();
      }

      if (window.ProductCache && typeof window.ProductCache.getAllSync === 'function') {
        const syncProducts = window.ProductCache.getAllSync();
        if (syncProducts && syncProducts.length) {
          cachedProducts = syncProducts;
          publishProducts(syncProducts, 'cache');
          return syncProducts.slice();
        }
      }
    }

    if (inflightPromise) return inflightPromise;

    inflightPromise = (async () => {
      try {
        document.dispatchEvent(new CustomEvent('products:syncing'));

        if (hasFirebaseConfig()) {
          try {
            const products = await fetchProductsFromFirestore();
            if (products.length) {
              let finalProducts = products;
              if (window.ProductStatsService && typeof window.ProductStatsService.hydrateProducts === 'function') {
                finalProducts = await window.ProductStatsService.hydrateProducts(products);
              }

              // Save to cache for offline / stored browser storage
              if (window.ProductCache && typeof window.ProductCache.setAll === 'function') {
                window.ProductCache.setAll(finalProducts).catch(() => {});
              }

              return publishProducts(finalProducts, 'firebase');
            }
          } catch (error) {
            console.warn('ProductDataSource: Firebase fetch failed during loadProducts.', error);
          }
        }

        // Fallback to cached data if offline or Firebase unreachable
        if (window.ProductCache && typeof window.ProductCache.getAll === 'function') {
          try {
            const fallbackProducts = await window.ProductCache.getAll();
            if (fallbackProducts && fallbackProducts.length) {
              return publishProducts(fallbackProducts, 'cache-offline');
            }
          } catch (_) {}
        }

        if (cachedProducts && cachedProducts.length) {
          return publishProducts(cachedProducts, 'cache');
        }

        return publishProducts([], 'firebase-empty');
      } finally {
        inflightPromise = null;
      }
    })();

    return inflightPromise;
  }

  // ─── Cache invalidation (for admin panel) ──────────────────────────

  function invalidateCache(slug) {
    if (!window.ProductCache || typeof window.ProductCache.invalidate !== 'function') {
      return Promise.resolve();
    }

    return window.ProductCache.invalidate(slug || undefined).then(() => {
      cachedProducts = null;
      return loadProducts({ forceRefresh: true });
    });
  }

  // ─── Cross-tab cache listeners ─────────────────────────────────────

  document.addEventListener('productcache:invalidated', (event) => {
    const detail = event && event.detail ? event.detail : {};
    if (window.ProductCache && typeof window.ProductCache.getAllSync === 'function') {
      const syncProducts = window.ProductCache.getAllSync();
      if (syncProducts && syncProducts.length) {
        publishProducts(syncProducts, 'admin-sync');
        return;
      }
    }
    cachedProducts = null;
    loadProducts({ forceRefresh: true });
  });

  document.addEventListener('productcache:updated', (event) => {
    const detail = event && event.detail ? event.detail : {};
    if (window.ProductCache && typeof window.ProductCache.getAllSync === 'function') {
      const syncProducts = window.ProductCache.getAllSync();
      if (syncProducts && syncProducts.length) {
        publishProducts(syncProducts, 'admin-sync');
        return;
      }
    }
  });

  // ─── Auto-refresh timer ────────────────────────────────────────────

  function startAutoRefresh() {
    const config = window.FIREBASE_CONFIG || {};
    const intervalMs = Number(config.refreshIntervalMs || 0);

    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return;
    }

    if (refreshTimerId) {
      window.clearInterval(refreshTimerId);
      refreshTimerId = null;
    }

    refreshTimerId = window.setInterval(() => {
      loadProducts({ forceRefresh: true });
    }, intervalMs);
  }

  function getSource() {
    return cacheSource;
  }

  startAutoRefresh();

  window.ProductDataSource = {
    hasFirebaseConfig,
    loadProducts,
    getProductsByType,
    getSource,
    normalizeProductType: normalizeProductTypeValue,
    applyStatsUpdate,
    invalidateCache,
  };
})();
