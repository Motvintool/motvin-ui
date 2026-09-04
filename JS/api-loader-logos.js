/**
 * API Loader - Handles loading logos from API based on filters
 */

(function () {
  "use strict";

  /**
   * Load logos from API based on current state (filters, search, pagination)
   * @returns {Promise<{logos: Array, total: number}>}
   */
  window.loadLogosFromAPI = async function () {
    const q = state.query.trim();
    const page = state.page || 1;
    const limit = 40;
    const offset = (page - 1) * limit;

    try {
      // Get active filters
      const activeSourceFilters = Array.from(state.sourceFilter || []);
      const activeStyleFilters = Array.from(state.styleFilter || []);
      const activeCategoryFilters = Array.from(state.categoryFilter || []);
      const activeLicenseFilters = Array.from(state.licenseFilter || []);

      // ALWAYS use search API (works with empty query now for cross-collection browsing)
      console.log(
        `[API Loader] ${q ? `Searching for "${q}"` : "Loading logos across all collections"}...`,
      );

      const apiOptions = {
        limit,
        offset,
        collection: activeSourceFilters.join(","),
        style: activeStyleFilters.join(","),
        category: activeCategoryFilters.join(","),
        license: activeLicenseFilters.join(","),
      };

      if (state.showSaved) {
        let savedIds = [];
        if (state.folders) {
          if (state.activeFolderId) {
            const folder = state.folders.find(
              (f) => f.id === state.activeFolderId,
            );
            if (folder) savedIds = folder.iconIds;
          } else {
            savedIds = state.folders.flatMap((f) => f.iconIds);
            savedIds = [...new Set(savedIds)];
          }
        }

        // If they want to see saved items but haven't saved any, return empty immediately
        if (savedIds.length === 0) {
          return { logos: [], total: 0 };
        }
        apiOptions.ids = savedIds.join(",");
      }

      const result = await window.logosAPI.searchLogos(q, apiOptions);

      return {
        logos: result.results || [],
        total: result.total || 0,
      };
    } catch (error) {
      console.error("[API Loader] Failed to load logos:", error);
      return {
        logos: [],
        total: 0,
      };
    }
  };

  /**
   * Populate REAL_LOGOS and LOGOS from API result
   */
  window.populateLogosFromAPI = async function () {
    const result = await window.loadLogosFromAPI();

    console.log(
      `[API Loader] Loaded ${result.logos.length} logos (total: ${result.total})`,
    );

    // Get source names from stats
    const collections = window.LOGO_STATS?.collections || [];
    const getCollectionName = (id) => {
      const c = collections.find((col) => col.id === id);
      return c ? c.name : id;
    };

    // Populate REAL_LOGOS
    window.REAL_LOGOS = result.logos.map((logo) => {
      const sourceId = logo.source || logo.collection;
      const collection = collections.find((c) => c.id === sourceId);

      return {
        ...logo,
        source: sourceId,
        sourceName: collection
          ? collection.name
          : logo.sourceName || logo.collectionName || sourceId,
        svg: logo.svg || "", // SVG loaded via URL or provided by API
        // Ensure required fields exist
        id: logo.id || `${sourceId}_${logo.name}`,
        name: logo.name,
        tags: logo.tags || [],
        style: logo.style || "outline",
        viewBox: logo.viewBox || "0 0 24 24",
        category: logo.category || "UI",
      };
    });

    // Recreate LOGOS array
    if (typeof window.recreateLogos === "function") {
      window.recreateLogos();
    }

    return result.total;
  };
})();
