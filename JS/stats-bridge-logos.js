/**
 * Stats Bridge - Loads logo statistics before main app initialization
 * Provides global stats data to avoid loading all 300K+ icons
 */

(function () {
  "use strict";

  // Global stats object (populated by API call)
  window.LOGO_STATS = null;

  // Initialize empty REAL_LOGOS array (will be populated by API calls)
  window.REAL_LOGOS = [];

  // Promise that resolves when stats are loaded
  let statsResolve, statsReject;
  window.STATS_LOADED = new Promise((resolve, reject) => {
    statsResolve = resolve;
    statsReject = reject;
  });

  /**
   * Helper function to get filter counts
   * @param {string} type - 'source' | 'style' | 'license' | 'category'
   * @returns {object} - Key-value pairs of filter values to counts
   */
  window.getFilterCounts = function (type) {
    if (!window.LOGO_STATS) {
      console.warn("Stats not loaded yet");
      return {};
    }

    switch (type) {
      case "source":
        // Convert collections array to {id: total} object
        return window.LOGO_STATS.collections.reduce((acc, collection) => {
          acc[collection.id] = collection.total;
          return acc;
        }, {});

      case "style":
        return window.LOGO_STATS.byStyle || {};

      case "license":
        return window.LOGO_STATS.byLicense || {};

      case "category":
        return window.LOGO_STATS.byCategory || {};

      default:
        return {};
    }
  };

  /**
   * Load initial icons - will be handled by renderGrid() now
   */
  function loadInitialIcons(stats) {
    console.log(`[Stats Bridge] Initial icons will be loaded by renderGrid()`);

    // Initialize empty REAL_LOGOS
    window.REAL_LOGOS = [];

    // Recreate ICONS array
    if (typeof window.recreateLogos === "function") {
      window.recreateLogos();
    }

    // Trigger render which will load icons from API
    setTimeout(() => {
      if (typeof renderGrid === "function") {
        console.log("[Stats Bridge] Triggering initial renderGrid()");
        renderGrid();
      }
    }, 100);
  }

  /**
   * Load stats immediately
   */
  function loadStats() {
    console.log("[Stats Bridge] Loading logo statistics...");
    const startTime = performance.now();

    window.logosAPI
      .getStats()
      .then((stats) => {
        // Compute total if the backend doesn't provide it at the top level
        stats.total =
          stats.total ||
          (stats.collections
            ? stats.collections.reduce((sum, c) => sum + (c.total || 0), 0)
            : 0);
        window.LOGO_STATS = stats;
        const loadTime = (performance.now() - startTime).toFixed(0);

        console.log(`[Stats Bridge] ✓ Loaded in ${loadTime}ms`);
        console.log(
          `[Stats Bridge] Total logos: ${stats.total.toLocaleString()}`,
        );
        console.log(`[Stats Bridge] Collections: ${stats.totalCollections}`);
        console.log(
          `[Stats Bridge] Styles:`,
          Object.keys(stats.byStyle).length,
        );
        console.log(
          `[Stats Bridge] Licenses:`,
          Object.keys(stats.byLicense).length,
        );
        console.log(
          `[Stats Bridge] Categories:`,
          Object.keys(stats.byCategory).length,
        );

        // Build SOURCES array from stats collections for compatibility
        if (!window.SOURCES || window.SOURCES.length === 0) {
          window.SOURCES = stats.collections.map((c) => ({
            id: c.id,
            name: c.name,
            total: c.total,
            styles: c.styles,
            license: c.license || "Unknown",
            licenseUrl: c.licenseUrl || "",
            author: "",
            marketSize: c.total,
          }));
          console.log(
            `[Stats Bridge] Built SOURCES array with ${window.SOURCES.length} collections`,
          );
        }

        statsResolve(stats);

        // Auto-load first page of icons from largest collection
        loadInitialIcons(stats);
      })
      .catch((err) => {
        console.error("[Stats Bridge] ✗ Failed to load stats:", err);

        // Provide fallback empty stats to prevent UI breakage
        window.LOGO_STATS = {
          total: 0,
          totalCollections: 0,
          collections: [],
          byStyle: {},
          byLicense: {},
          byCategory: {},
          error: true,
        };

        statsResolve(window.LOGO_STATS);
      });
  }

  // Load stats immediately when this script loads
  if (window.logosAPI) {
    loadStats();
  } else {
    console.error(
      "[Stats Bridge] logosAPI not available - load api-client.js first",
    );
  }
})();
