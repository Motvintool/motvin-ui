/**
 * API Loader - Handles loading icons from API based on filters
 */

(function () {
  'use strict';

  /**
   * Load icons from API based on current state (filters, search, pagination)
   * @returns {Promise<{icons: Array, total: number}>}
   */
  window.loadIconsFromAPI = async function () {
    const q = state.query.trim();
    const page = state.page || 1;
    const limit = 60;
    const offset = (page - 1) * limit;

    try {
      // Get active filters
      const activeSourceFilters = Array.from(state.sourceFilter || []);
      const activeStyleFilters = Array.from(state.styleFilter || []);
      const activeCategoryFilters = Array.from(state.categoryFilter || []);
      const activeLicenseFilters = Array.from(state.licenseFilter || []);

      // ALWAYS use search API (works with empty query now for cross-collection browsing)
      console.log(`[API Loader] ${q ? `Searching for "${q}"` : 'Loading icons across all collections'}...`);

      const result = await window.iconsAPI.searchIcons(q, {  // q can be empty
        limit,
        offset,
        collection: activeSourceFilters.join(','),
        style: activeStyleFilters.join(','),
        category: activeCategoryFilters.join(','),
        license: activeLicenseFilters.join(',')
      });

      return {
        icons: result.results || [],
        total: result.total || 0
      };

    } catch (error) {
      console.error('[API Loader] Failed to load icons:', error);
      return {
        icons: [],
        total: 0
      };
    }
  };

  /**
   * Populate REAL_ICONS and ICONS from API result
   */
  window.populateIconsFromAPI = async function () {
    const result = await window.loadIconsFromAPI();

    console.log(`[API Loader] Loaded ${result.icons.length} icons (total: ${result.total})`);

    // Get source names from stats
    const collections = window.ICON_STATS?.collections || [];
    const getCollectionName = (id) => {
      const c = collections.find(col => col.id === id);
      return c ? c.name : id;
    };

    // Populate REAL_ICONS
    window.REAL_ICONS = result.icons.map(icon => {
      const sourceId = icon.source || icon.collection;
      const collection = collections.find(c => c.id === sourceId);

      return {
        ...icon,
        source: sourceId,
        sourceName: collection ? collection.name : (icon.sourceName || icon.collectionName || sourceId),
        svg: icon.svg || '', // SVG loaded via URL or provided by API
        // Ensure required fields exist
        id: icon.id || `${sourceId}_${icon.name}`,
        name: icon.name,
        tags: icon.tags || [],
        style: icon.style || 'outline',
        viewBox: icon.viewBox || '0 0 24 24',
        category: icon.category || 'UI'
      };
    });

    // Recreate ICONS array
    if (typeof window.recreateIcons === 'function') {
      window.recreateIcons();
    }

    return result.total;
  };

})();
