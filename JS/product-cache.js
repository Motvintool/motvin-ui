// product-cache.js: IndexedDB-backed persistent cache for product data.
// Loaded BEFORE product-data-source.js so that cached data is available
// immediately when the data source initialises.
(function initProductCache() {
  var DB_NAME = 'MotvinProductCache';
  var DB_VERSION = 1;
  var STORE_NAME = 'products';
  var META_STORE = 'meta';
  var CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes – data is stale after this

  var dbPromise = null;

  // ─── IndexedDB helpers ──────────────────────────────────────────────

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      var request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'slug' });
        }

        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function () {
        reject(request.error || new Error('IndexedDB open failed'));
      };
    });

    return dbPromise;
  }

  function withStore(storeName, mode, callback) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var result = callback(store);

        tx.oncomplete = function () {
          resolve(result);
        };

        tx.onerror = function () {
          reject(tx.error || new Error('IndexedDB transaction failed'));
        };
      });
    });
  }

  function idbGet(storeName, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.get(key);

        request.onsuccess = function () {
          resolve(request.result || null);
        };

        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  function idbGetAll(storeName) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var request = store.getAll();

        request.onsuccess = function () {
          resolve(request.result || []);
        };

        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  // ─── Meta helpers (timestamps, version) ─────────────────────────────

  function setMeta(key, value) {
    return withStore(META_STORE, 'readwrite', function (store) {
      store.put({ key: key, value: value, updatedAt: Date.now() });
    });
  }

  function getMeta(key) {
    return idbGet(META_STORE, key).then(function (record) {
      return record ? record : null;
    });
  }
  // ─── LocalStorage Synchronous Mirror ─────────────────────────────
  var LS_KEY = 'motvin_products_v1';
  var LS_TS_KEY = 'motvin_cache_ts_v1';

  function getLS() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function setLS(products) {
    try {
      if (!Array.isArray(products) || !products.length) {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_TS_KEY);
        return;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(products));
      localStorage.setItem(LS_TS_KEY, String(Date.now()));
    } catch (e) {
      // Ignore quota error or storage disabled
    }
  }

  // ─── Pre-warming & Synchronous Cache Init ────────────────────────────
  var prewarmedData = getLS();
  var prewarmPromise = null;

  // Immediately suppress skeleton loading attributes if synchronous cache is present
  if (prewarmedData && prewarmedData.length) {
    try {
      if (document.documentElement) {
        document.documentElement.classList.add('motvin-has-cache');
      }
      if (document.body) {
        document.body.removeAttribute('data-detail-loading');
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          if (document.body) document.body.removeAttribute('data-detail-loading');
        });
      }
    } catch (e) {}
  }

  function startPrewarm() {
    if (prewarmPromise) return prewarmPromise;

    prewarmPromise = idbGetAll(STORE_NAME)
      .then(function (products) {
        if (!products || !products.length) {
          if (!prewarmedData) prewarmedData = null;
          return prewarmedData;
        }
        products.sort(function (a, b) {
          return (b._updatedTimestamp || 0) - (a._updatedTimestamp || 0);
        });
        prewarmedData = products;
        setLS(products);
        return products;
      })
      .catch(function () {
        return prewarmedData;
      });

    return prewarmPromise;
  }

  // ─── Synchronous Getters ─────────────────────────────────────────────

  function hasCacheSync() {
    return Boolean(prewarmedData && prewarmedData.length);
  }

  function getAllSync() {
    return prewarmedData ? prewarmedData.slice() : null;
  }

  function getOneSync(slug) {
    var key = String(slug || '').trim();
    if (!key || !prewarmedData) return null;
    return prewarmedData.find(function (p) { return p && p.slug === key; }) || null;
  }

  // ─── Public API ─────────────────────────────────────────────────────

  function getAll() {
    if (prewarmedData) {
      return Promise.resolve(prewarmedData.slice());
    }

    if (prewarmPromise) {
      return prewarmPromise.then(function (data) {
        return data ? data.slice() : null;
      });
    }

    return startPrewarm().then(function (data) {
      return data ? data.slice() : null;
    });
  }

  function setAll(products) {
    if (!Array.isArray(products)) return Promise.resolve();

    prewarmedData = products.slice();
    setLS(products);

    return openDB()
      .then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
          var productStore = tx.objectStore(STORE_NAME);
          var metaStore = tx.objectStore(META_STORE);

          productStore.clear();

          for (var i = 0; i < products.length; i++) {
            var product = products[i];
            if (product && product.slug) {
              productStore.put(product);
            }
          }

          metaStore.put({
            key: 'cacheTimestamp',
            value: Date.now(),
            updatedAt: Date.now(),
          });

          tx.oncomplete = function () {
            resolve();
          };

          tx.onerror = function () {
            reject(tx.error || new Error('Cache write failed'));
          };
        });
      })
      .catch(function (err) {
        console.warn('ProductCache: setAll failed.', err);
      });
  }

  function getOne(slug) {
    var key = String(slug || '').trim();
    if (!key) return Promise.resolve(null);

    if (prewarmedData) {
      var found = prewarmedData.find(function (p) { return p && p.slug === key; });
      if (found) return Promise.resolve(found);
    }

    return idbGet(STORE_NAME, key).catch(function () {
      return null;
    });
  }

  function putOne(product) {
    if (!product || !product.slug) return Promise.resolve();

    if (!prewarmedData) prewarmedData = [];
    var idx = prewarmedData.findIndex(function (p) { return p && p.slug === product.slug; });
    if (idx >= 0) {
      prewarmedData[idx] = product;
    } else {
      prewarmedData.unshift(product);
    }
    setLS(prewarmedData);

    return withStore(STORE_NAME, 'readwrite', function (store) {
      store.put(product);
    }).catch(function (err) {
      console.warn('ProductCache: putOne failed.', err);
    });
  }

  function removeOne(slug) {
    var key = String(slug || '').trim();
    if (!key) return Promise.resolve();

    if (prewarmedData) {
      prewarmedData = prewarmedData.filter(function (p) { return p && p.slug !== key; });
      setLS(prewarmedData);
    }

    return withStore(STORE_NAME, 'readwrite', function (store) {
      store.delete(key);
    }).catch(function (err) {
      console.warn('ProductCache: removeOne failed.', err);
    });
  }

  function invalidate(slug) {
    if (slug) {
      return removeOne(slug);
    }

    prewarmedData = null;
    setLS(null);

    return openDB()
      .then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          tx.objectStore(META_STORE).delete('cacheTimestamp');

          tx.oncomplete = function () {
            resolve();
          };

          tx.onerror = function () {
            reject(tx.error);
          };
        });
      })
      .catch(function (err) {
        console.warn('ProductCache: invalidate failed.', err);
      });
  }

  function getTimestamp() {
    try {
      var tsStr = localStorage.getItem(LS_TS_KEY);
      if (tsStr) return Promise.resolve(parseInt(tsStr, 10) || 0);
    } catch (e) {}

    return getMeta('cacheTimestamp')
      .then(function (record) {
        return record && typeof record.value === 'number' ? record.value : 0;
      })
      .catch(function () {
        return 0;
      });
  }

  function isStale() {
    return getTimestamp().then(function (ts) {
      if (!ts) return true;
      return (Date.now() - ts) > CACHE_TTL_MS;
    });
  }

  function isAvailable() {
    return Boolean(window.indexedDB);
  }

  // ─── Cross-tab invalidation via BroadcastChannel ───────────────────

  var broadcastChannel = null;

  function initBroadcast() {
    if (typeof BroadcastChannel !== 'function') return;

    try {
      broadcastChannel = new BroadcastChannel('motvin-product-cache');

      broadcastChannel.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || !data.type) return;

        if (data.type === 'cache-invalidated') {
          if (!data.slug) {
            prewarmedData = null;
            setLS(null);
          } else if (prewarmedData) {
            prewarmedData = prewarmedData.filter(function (p) { return p && p.slug !== data.slug; });
            setLS(prewarmedData);
          }

          document.dispatchEvent(new CustomEvent('productcache:invalidated', {
            detail: { slug: data.slug || null },
          }));
        } else if (data.type === 'cache-updated') {
          if (data.product && data.product.slug) {
            putOne(data.product);
            document.dispatchEvent(new CustomEvent('productcache:updated', {
              detail: { product: data.product },
            }));
          }
        }
      });
    } catch (err) {
      // BroadcastChannel not available
    }
  }

  function broadcastInvalidation(slug) {
    if (!broadcastChannel) return;

    try {
      broadcastChannel.postMessage({
        type: 'cache-invalidated',
        slug: slug || null,
        timestamp: Date.now(),
      });
    } catch (err) {}
  }

  function broadcastUpdate(product) {
    if (!broadcastChannel || !product) return;

    try {
      broadcastChannel.postMessage({
        type: 'cache-updated',
        product: product,
        timestamp: Date.now(),
      });
    } catch (err) {}
  }

  // ─── Init ───────────────────────────────────────────────────────────

  initBroadcast();
  startPrewarm();

  // ─── Export ─────────────────────────────────────────────────────────

  window.ProductCache = {
    hasCacheSync: hasCacheSync,
    getAllSync: getAllSync,
    getOneSync: getOneSync,
    getAll: getAll,
    setAll: setAll,
    getOne: getOne,
    putOne: function (product) {
      return putOne(product).then(function () {
        broadcastUpdate(product);
      });
    },
    removeOne: function (slug) {
      return removeOne(slug).then(function () {
        broadcastInvalidation(slug);
      });
    },
    invalidate: function (slug) {
      return invalidate(slug).then(function () {
        broadcastInvalidation(slug);
      });
    },
    getTimestamp: getTimestamp,
    isStale: isStale,
    isAvailable: isAvailable,
    CACHE_TTL_MS: CACHE_TTL_MS,
  };
})();
