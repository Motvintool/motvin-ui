/**
 * Stats Bridge — loads illustration statistics before main app initialization.
 */

(function () {
  'use strict';

  window.ILLUSTRATION_STATS = null;
  // Preserve any static data already loaded (e.g. from real_illustrations_data.js)
  if (!window.REAL_ILLUSTRATIONS) window.REAL_ILLUSTRATIONS = [];

  let statsResolve, statsReject;
  window.ILLUSTRATION_STATS_LOADED = new Promise((resolve, reject) => {
    statsResolve = resolve;
    statsReject  = reject;
  });

  window.getIllustrationFilterCounts = function (type) {
    if (!window.ILLUSTRATION_STATS) return {};
    switch (type) {
      case 'source':
        return (window.ILLUSTRATION_STATS.collections || []).reduce((acc, c) => {
          acc[c.id] = c.total;
          return acc;
        }, {});
      case 'style':    return window.ILLUSTRATION_STATS.byStyle    || {};
      case 'license':  return window.ILLUSTRATION_STATS.byLicense  || {};
      case 'category': return window.ILLUSTRATION_STATS.byCategory || {};
      default:         return {};
    }
  };

  function loadInitialIllustrations() {
    // Rebuild ICONS + update filter counts; DOMContentLoaded in illustrations.js drives renderGrid
    if (typeof window.recreateIllustrations === 'function') window.recreateIllustrations();
  }

  function loadStats() {
    console.log('[Stats Bridge] Loading illustration statistics...');
    const startTime = performance.now();

    window.illustrationsAPI.getStats()
      .then(stats => {
        stats.total = stats.total || (stats.collections || []).reduce((s, c) => s + (c.total || 0), 0);
        window.ILLUSTRATION_STATS = stats;

        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`[Stats Bridge] ✓ Loaded in ${loadTime}ms — ${stats.total.toLocaleString()} illustrations`);

        if (!window.SOURCES || window.SOURCES.length === 0) {
          window.SOURCES = (stats.collections || []).map(c => ({
            id: c.id,
            name: c.name,
            total: c.total,
            styles: c.styles,
            license: 'Mixed',
            licenseUrl: '',
            author: '',
          }));
        }

        statsResolve(stats);
        loadInitialIllustrations();
      })
      .catch(err => {
        console.error('[Stats Bridge] ✗ Failed to load illustration stats:', err);
        window.ILLUSTRATION_STATS = {
          total: 0,
          totalCollections: 0,
          collections: [],
          byStyle: {},
          byLicense: {},
          byCategory: {},
          error: true,
        };
        statsReject(err);
      });
  }

  if (window.illustrationsAPI) {
    loadStats();
  } else {
    console.error('[Stats Bridge] illustrationsAPI not available — load api-client-illustrations.js first');
  }

})();
