/**
 * API Loader - Handles loading icons from API based on filters
 */

(function () {
  "use strict";

  /**
   * Load icons from API based on current state (filters, search, pagination)
   * @returns {Promise<{icons: Array, total: number}>}
   */
  window.loadIconsFromAPI = async function () {
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
        `[API Loader] ${q ? `Searching for "${q}"` : "Loading icons across all collections"}...`,
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
          return { icons: [], total: 0 };
        }
        apiOptions.ids = savedIds.join(",");
      }

      const result = await window.iconsAPI.searchIcons(q, apiOptions);
      if (result && result.aborted) return { aborted: true };

      // If no results and no active filters/query, the index may still be building — retry
      const hasFilters = activeSourceFilters.length || activeStyleFilters.length ||
                         activeCategoryFilters.length || activeLicenseFilters.length;
      if (!q && !hasFilters && result.total === 0 && !apiOptions.ids) {
        window._iconIndexRetryCount = (window._iconIndexRetryCount || 0) + 1;
        if (window._iconIndexRetryCount <= 10) {
          const delay = Math.min(2000 * window._iconIndexRetryCount, 15000);
          console.log(`[API Loader] Index still building, retrying in ${delay}ms (attempt ${window._iconIndexRetryCount})...`);
          await new Promise(r => setTimeout(r, delay));
          return window.loadIconsFromAPI();
        }
      } else {
        window._iconIndexRetryCount = 0; // reset on successful load
      }

      return { icons: result.results || [], total: result.total || 0 };
    } catch (error) {
      console.error("[API Loader] Failed to load icons:", error);
      return {
        icons: [],
        total: 0,
      };
    }
  };

  /**
   * Populate REAL_ICONS and ICONS from API result
   */
  window.populateIconsFromAPI = async function () {
    const result = await window.loadIconsFromAPI();

    if (result && result.aborted) return -1;

    console.log(
      `[API Loader] Loaded ${result.icons.length} icons (total: ${result.total})`,
    );

    // Get source names from stats
    const collections = window.ICON_STATS?.collections || [];
    const getCollectionName = (id) => {
      const c = collections.find((col) => col.id === id);
      return c ? c.name : id;
    };

    // Populate REAL_ICONS
    window.REAL_ICONS = result.icons.map((icon) => {
      const sourceId = icon.source || icon.collection;
      const collection = collections.find((c) => c.id === sourceId);

      return {
        ...icon,
        source: sourceId,
        sourceName: collection
          ? collection.name
          : icon.sourceName || icon.collectionName || sourceId,
        svg: icon.svg || "", // SVG loaded via URL or provided by API
        // Ensure required fields exist
        id: icon.id || `${sourceId}_${icon.name}`,
        name: icon.name,
        tags: icon.tags || [],
        style: icon.style || "outline",
        viewBox: icon.viewBox || "0 0 24 24",
        category: icon.category || "UI",
      };
    });

    // Recreate ICONS array
    if (typeof window.recreateIcons === "function") {
      window.recreateIcons();
    }

    return result.total;
  };
})();
