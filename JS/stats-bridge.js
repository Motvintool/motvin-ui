/**
 * Stats Bridge - Loads icon statistics before main app initialization
 * Provides global stats data to avoid loading all 300K+ icons
 */

(function () {
  "use strict";

  // Global stats object (populated by API call)
  window.ICON_STATS = null;

  // Initialize empty REAL_ICONS array (will be populated by API calls)
  window.REAL_ICONS = [];

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
    if (!window.ICON_STATS) {
      console.warn("Stats not loaded yet");
      return {};
    }

    switch (type) {
      case "source":
        // Convert collections array to {id: total} object
        return window.ICON_STATS.collections.reduce((acc, collection) => {
          acc[collection.id] = collection.total;
          return acc;
        }, {});

      case "style":
        return window.ICON_STATS.byStyle || {};

      case "license":
        return window.ICON_STATS.byLicense || {};

      case "category":
        return window.ICON_STATS.byCategory || {};

      default:
        return {};
    }
  };

  /**
   * Load initial icons - will be handled by renderGrid() now
   */
  function loadInitialIcons(stats) {
    console.log(`[Stats Bridge] Initial icons will be loaded by renderGrid()`);

    // Initialize empty REAL_ICONS
    window.REAL_ICONS = [];

    // Recreate ICONS array
    if (typeof window.recreateIcons === "function") {
      window.recreateIcons();
    }

    // Only trigger a render if the grid hasn't already loaded icons in parallel
    // (parallel pre-load fires at same time as stats call)
    const grid = document.querySelector("#icon-grid");
    const alreadyLoaded = grid && grid.querySelector(".mi-card:not([style*='skeleton'])");
    if (!alreadyLoaded && typeof renderGrid === "function") {
      console.log("[Stats Bridge] Triggering fallback renderGrid() after stats");
      renderGrid();
    }
  }

  /**
   * Load stats immediately
   */
  function loadStats() {
    console.log("[Stats Bridge] Loading icon statistics...");
    const startTime = performance.now();

    window.iconsAPI
      .getStats()
      .then((stats) => {
        window.ICON_STATS = stats;
        const loadTime = (performance.now() - startTime).toFixed(0);

        console.log(`[Stats Bridge] ✓ Loaded in ${loadTime}ms`);
        console.log(
          `[Stats Bridge] Total icons: ${stats.total.toLocaleString()}`,
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
        window.ICON_STATS = {
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

  // Load stats and initial icons in PARALLEL — don't wait for stats before showing icons
  if (window.iconsAPI) {
    // Fire both at the same time
    loadStats();

    // Kick off the grid render immediately without waiting for stats
    // The grid only needs icons; stats are only needed for filter sidebar counts
    if (typeof renderGrid === "function") {
      console.log("[Stats Bridge] Pre-loading grid in parallel with stats...");
      renderGrid();
    }
  } else {
    console.error(
      "[Stats Bridge] iconsAPI not available - load api-client.js first",
    );
  }
})();
