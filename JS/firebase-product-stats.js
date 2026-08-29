// firebase-product-stats.js: Product likes and visit counts backed by Firebase Firestore.
(function initFirebaseProductStatsService() {
  const SDK_VERSION = '10.12.5';
  const GUEST_LIKES_STORAGE_KEY = 'guestLikedProductSlugs';

  let firestoreSdk = null;
  let db = null;
  let readyPromise = null;

  const statsCache = new Map();
  const viewedInSession = new Set();

  function getConfig() {
    return window.FIREBASE_CONFIG || {};
  }

  function getStatsCollectionName() {
    const config = getConfig();
    return String(config.productStatsCollection || 'productStats').trim() || 'productStats';
  }

  function hasFirebaseConfig() {
    const config = getConfig();
    return Boolean(config.apiKey && config.projectId);
  }

  function asCount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
  }

  function normalizeStats(value) {
    const input = value && typeof value === 'object' ? value : {};
    const guestLikesCount = asCount(input.guestLikesCount);
    const baseLikesCount = Object.prototype.hasOwnProperty.call(input, 'backendLikesCount')
      ? asCount(input.backendLikesCount)
      : asCount(input.likesCount);
    const effectiveLikesCount = baseLikesCount + guestLikesCount;

    return {
      likesCount: effectiveLikesCount,
      viewsCount: asCount(input.viewsCount),
      guestLikesCount,
      backendLikesCount: baseLikesCount,
      likedByCurrentUser: Boolean(input.likedByCurrentUser),
    };
  }

  function getGuestLikedSlugs() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(GUEST_LIKES_STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .map((slug) => String(slug || '').trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function setGuestLikedSlugs(slugs) {
    const unique = [];
    (Array.isArray(slugs) ? slugs : []).forEach((slug) => {
      const key = String(slug || '').trim();
      if (!key || unique.includes(key)) return;
      unique.push(key);
    });
    window.localStorage.setItem(GUEST_LIKES_STORAGE_KEY, JSON.stringify(unique));
  }

  function isGuestLiked(slug) {
    const key = String(slug || '').trim();
    if (!key) return false;
    return getGuestLikedSlugs().includes(key);
  }

  function setGuestLiked(slug, liked) {
    const key = String(slug || '').trim();
    if (!key) return;

    const slugs = getGuestLikedSlugs();
    const has = slugs.includes(key);

    if (liked && !has) {
      slugs.push(key);
      setGuestLikedSlugs(slugs);
      return;
    }

    if (!liked && has) {
      setGuestLikedSlugs(slugs.filter((item) => item !== key));
    }
  }

  function toDisplayStats(slug, rawStats) {
    const normalized = normalizeStats(rawStats);
    const key = String(slug || '').trim();
    const guestLiked = isGuestLiked(key);

    return normalizeStats({
      likesCount: normalized.backendLikesCount,
      viewsCount: normalized.viewsCount,
      guestLikesCount: normalized.guestLikesCount,
      likedByCurrentUser: normalized.likedByCurrentUser || guestLiked,
    });
  }

  function formatCount(value) {
    const n = asCount(value);
    if (n >= 1000000) {
      const compact = (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1);
      return `${compact.replace(/\.0$/, '')}M`;
    }

    if (n >= 1000) {
      const compact = (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1);
      return `${compact.replace(/\.0$/, '')}K`;
    }

    return String(n);
  }

  function mergeProductWithStats(product, stats) {
    const base = product && typeof product === 'object' ? product : {};
    const normalized = normalizeStats(stats);

    return {
      ...base,
      likes: normalized.likesCount,
      views: normalized.viewsCount,
      likeCount: formatCount(normalized.likesCount),
      trendCount: formatCount(normalized.viewsCount),
      likedByCurrentUser: normalized.likedByCurrentUser,
    };
  }

  function getCachedStats(slug) {
    const key = String(slug || '').trim();
    if (!key) return normalizeStats(null);
    return toDisplayStats(key, statsCache.get(key));
  }

  function setCachedStats(slug, stats) {
    const key = String(slug || '').trim();
    if (!key) return normalizeStats(stats);

    const normalized = normalizeStats(stats);
    statsCache.set(key, normalized);
    return toDisplayStats(key, normalized);
  }

  function emitStatsUpdated(slug, stats) {
    document.dispatchEvent(new CustomEvent('product-stats:updated', {
      detail: {
        slug: String(slug || '').trim(),
        stats: normalizeStats(stats),
      },
    }));
  }

  function publishStatsUpdate(slug, stats) {
    const normalized = setCachedStats(slug, stats);

    if (window.ProductDataSource && typeof window.ProductDataSource.applyStatsUpdate === 'function') {
      window.ProductDataSource.applyStatsUpdate(slug, normalized);
    }

    emitStatsUpdated(slug, normalized);
    return normalized;
  }

  async function ensureReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
      if (!hasFirebaseConfig()) {
        return null;
      }

      const config = getConfig();
      const [{ initializeApp, getApps, getApp }, loadedFirestoreSdk] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);

      firestoreSdk = loadedFirestoreSdk;
      const app = getApps().length ? getApp() : initializeApp(config);
      db = firestoreSdk.getFirestore(app);
      return db;
    })().catch((error) => {
      console.warn('ProductStatsService: Firebase init failed.', error);
      return null;
    });

    return readyPromise;
  }

  function getStatsDocRef(slug) {
    return firestoreSdk.doc(db, getStatsCollectionName(), String(slug || '').trim());
  }

  function getLikeDocRef(slug, uid) {
    return firestoreSdk.doc(db, getStatsCollectionName(), String(slug || '').trim(), 'likes', String(uid || '').trim());
  }

  function getCurrentUser() {
    const authService = window.FirebaseAuthService;
    if (!authService || typeof authService.getCurrentUser !== 'function') return null;
    return authService.getCurrentUser();
  }

  async function fetchStatsForSlugs(slugs) {
    const uniqueSlugs = Array.from(new Set((Array.isArray(slugs) ? slugs : [])
      .map((slug) => String(slug || '').trim())
      .filter(Boolean)));

    if (!uniqueSlugs.length) {
      return {};
    }

    const dbInstance = await ensureReady();
    if (!dbInstance || !firestoreSdk) {
      const fallback = {};
      uniqueSlugs.forEach((slug) => {
        fallback[slug] = getCachedStats(slug);
      });
      return fallback;
    }

    const results = {};
    const missing = new Set(uniqueSlugs);

    const chunkSize = 30;
    for (let i = 0; i < uniqueSlugs.length; i += chunkSize) {
      const chunk = uniqueSlugs.slice(i, i + chunkSize);
      const statsQuery = firestoreSdk.query(
        firestoreSdk.collection(dbInstance, getStatsCollectionName()),
        firestoreSdk.where(firestoreSdk.documentId(), 'in', chunk)
      );
      const snapshot = await firestoreSdk.getDocs(statsQuery);
      snapshot.forEach((docSnap) => {
        const slug = docSnap.id;
        const data = docSnap.data() || {};
        const normalized = normalizeStats({
          likesCount: data.likesCount,
          viewsCount: data.viewsCount,
          guestLikesCount: data.guestLikesCount,
          likedByCurrentUser: false,
        });

        results[slug] = normalized;
        setCachedStats(slug, normalized);
        missing.delete(slug);
      });
    }

    missing.forEach((slug) => {
      const fallback = getCachedStats(slug);
      results[slug] = fallback;
      setCachedStats(slug, fallback);
    });

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.uid) {
      await Promise.all(uniqueSlugs.map(async (slug) => {
        try {
          const likeDoc = await firestoreSdk.getDoc(getLikeDocRef(slug, currentUser.uid));
          const liked = likeDoc.exists();
          const current = results[slug] || getCachedStats(slug);
          const next = {
            likesCount: current.backendLikesCount,
            viewsCount: current.viewsCount,
            guestLikesCount: current.guestLikesCount,
            likedByCurrentUser: liked,
          };
          results[slug] = next;
          setCachedStats(slug, next);
        } catch {
          // Ignore per-like lookup failures.
        }
      }));
    }

    uniqueSlugs.forEach((slug) => {
      results[slug] = toDisplayStats(slug, results[slug] || getCachedStats(slug));
      setCachedStats(slug, results[slug]);
    });

    return results;
  }

  async function hydrateProducts(products) {
    const source = Array.isArray(products) ? products : [];
    if (!source.length) return [];

    const slugs = source.map((product) => product && product.slug).filter(Boolean);

    let statsBySlug = {};
    try {
      statsBySlug = await fetchStatsForSlugs(slugs);
    } catch (error) {
      console.warn('ProductStatsService: failed to fetch stats map.', error);
    }

    return source.map((product) => {
      const slug = String(product && product.slug || '').trim();
      return mergeProductWithStats(product, statsBySlug[slug] || getCachedStats(slug));
    });
  }

  async function trackVisit(slug) {
    const key = String(slug || '').trim();
    if (!key) return getCachedStats(key);

    if (viewedInSession.has(key)) {
      return getCachedStats(key);
    }
    viewedInSession.add(key);

    const dbInstance = await ensureReady();
    if (!dbInstance || !firestoreSdk) {
      return getCachedStats(key);
    }

    let nextStats = null;

    await firestoreSdk.runTransaction(dbInstance, async (transaction) => {
      const statsRef = getStatsDocRef(key);
      const statsSnap = await transaction.get(statsRef);
      const data = statsSnap.exists() ? statsSnap.data() : {};

      const likesCount = asCount(data.likesCount);
      const viewsCount = asCount(data.viewsCount) + 1;
      const guestLikesCount = asCount(data.guestLikesCount);

      transaction.set(statsRef, {
        slug: key,
        likesCount,
        guestLikesCount,
        viewsCount,
        updatedAt: firestoreSdk.serverTimestamp(),
      }, { merge: true });

      nextStats = normalizeStats({
        likesCount,
        viewsCount,
        guestLikesCount,
        likedByCurrentUser: getCachedStats(key).likedByCurrentUser,
      });
    });

    return publishStatsUpdate(key, nextStats || getCachedStats(key));
  }

  async function toggleLike(slug) {
    const key = String(slug || '').trim();
    if (!key) {
      throw new Error('Invalid product slug.');
    }

    const user = getCurrentUser();
    if (!user || !user.uid) {
      const currentlyGuestLiked = isGuestLiked(key);
      const dbInstance = await ensureReady();

      if (!dbInstance || !firestoreSdk) {
        throw new Error('Firebase is not configured.');
      }

      let guestLikeResult = null;

      await firestoreSdk.runTransaction(dbInstance, async (transaction) => {
        const statsRef = getStatsDocRef(key);
        const statsSnap = await transaction.get(statsRef);
        const data = statsSnap.exists() ? statsSnap.data() : {};

        const likesCount = asCount(data.likesCount);
        const viewsCount = asCount(data.viewsCount);
        const currentGuestLikes = asCount(data.guestLikesCount);

        if (currentlyGuestLiked) {
          const guestLikesCount = Math.max(0, currentGuestLikes - 1);
          transaction.set(statsRef, {
            slug: key,
            likesCount,
            guestLikesCount,
            viewsCount,
            updatedAt: firestoreSdk.serverTimestamp(),
          }, { merge: true });

          guestLikeResult = normalizeStats({
            likesCount,
            guestLikesCount,
            viewsCount,
            likedByCurrentUser: false,
          });
          return;
        }

        const guestLikesCount = currentGuestLikes + 1;
        transaction.set(statsRef, {
          slug: key,
          likesCount,
          guestLikesCount,
          viewsCount,
          updatedAt: firestoreSdk.serverTimestamp(),
        }, { merge: true });

        guestLikeResult = normalizeStats({
          likesCount,
          guestLikesCount,
          viewsCount,
          likedByCurrentUser: true,
        });
      });

      setGuestLiked(key, !currentlyGuestLiked);
      return {
        liked: !currentlyGuestLiked,
        stats: publishStatsUpdate(key, guestLikeResult || getCachedStats(key)),
        isGuestAction: true,
      };
    }

    const dbInstance = await ensureReady();
    if (!dbInstance || !firestoreSdk) {
      throw new Error('Firebase is not configured.');
    }

    let result = null;

    await firestoreSdk.runTransaction(dbInstance, async (transaction) => {
      const statsRef = getStatsDocRef(key);
      const likeRef = getLikeDocRef(key, user.uid);

      const [statsSnap, likeSnap] = await Promise.all([
        transaction.get(statsRef),
        transaction.get(likeRef),
      ]);

      const data = statsSnap.exists() ? statsSnap.data() : {};
      const currentLikes = asCount(data.likesCount);
      const currentViews = asCount(data.viewsCount);
      const currentGuestLikes = asCount(data.guestLikesCount);
      const hasGuestLike = isGuestLiked(key);

      if (!likeSnap.exists() && hasGuestLike) {
        const nextGuestLikes = Math.max(0, currentGuestLikes - 1);
        transaction.set(statsRef, {
          slug: key,
          likesCount: currentLikes,
          guestLikesCount: nextGuestLikes,
          viewsCount: currentViews,
          updatedAt: firestoreSdk.serverTimestamp(),
        }, { merge: true });

        setGuestLiked(key, false);
        result = {
          liked: false,
          stats: normalizeStats({
            likesCount: currentLikes,
            viewsCount: currentViews,
            guestLikesCount: nextGuestLikes,
            likedByCurrentUser: false,
          }),
        };
        return;
      }

      if (likeSnap.exists()) {
        const likesCount = Math.max(0, currentLikes - 1);
        transaction.delete(likeRef);
        transaction.set(statsRef, {
          slug: key,
          likesCount,
          guestLikesCount: currentGuestLikes,
          viewsCount: currentViews,
          updatedAt: firestoreSdk.serverTimestamp(),
        }, { merge: true });

        result = {
          liked: false,
          stats: normalizeStats({
            likesCount,
            viewsCount: currentViews,
            guestLikesCount: currentGuestLikes,
            likedByCurrentUser: false,
          }),
        };
        return;
      }

      const likesCount = currentLikes + 1;
      transaction.set(likeRef, {
        uid: user.uid,
        createdAt: firestoreSdk.serverTimestamp(),
      });
      transaction.set(statsRef, {
        slug: key,
        likesCount,
        guestLikesCount: currentGuestLikes,
        viewsCount: currentViews,
        updatedAt: firestoreSdk.serverTimestamp(),
      }, { merge: true });

      result = {
        liked: true,
        stats: normalizeStats({
          likesCount,
          viewsCount: currentViews,
          guestLikesCount: currentGuestLikes,
          likedByCurrentUser: true,
        }),
      };
    });

    const normalized = publishStatsUpdate(key, result ? result.stats : getCachedStats(key));
    return {
      liked: Boolean(result && result.liked),
      stats: normalized,
    };
  }

  window.ProductStatsService = {
    init: ensureReady,
    hydrateProducts,
    fetchStatsForSlugs,
    getStats(slug) {
      return getCachedStats(slug);
    },
    formatCount,
    trackVisit,
    toggleLike,
  };

  ensureReady();
})();
