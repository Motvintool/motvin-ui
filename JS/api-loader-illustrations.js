/**
 * API Loader — loads illustrations from the backend based on active state/filters.
 */

(function () {
  'use strict';

  window.loadIllustrationsFromAPI = async function () {
    const q = state.query.trim();
    const page = state.page || 1;
    const limit = 40;
    const offset = (page - 1) * limit;

    try {
      const activeSourceFilters   = Array.from(state.sourceFilter || []);
      const activeStyleFilters    = Array.from(state.styleFilter || []);
      const activeCategoryFilters = Array.from(state.categoryFilter || []);
      const activeLicenseFilters  = Array.from(state.licenseFilter || []);

      console.log(`[API Loader] ${q ? `Searching for "${q}"` : 'Loading illustrations'}...`);

      const apiOptions = {
        limit,
        offset,
        collection: activeSourceFilters.join(','),
        style:      activeStyleFilters.join(','),
        category:   activeCategoryFilters.join(','),
        license:    activeLicenseFilters.join(','),
      };

      if (state.showSaved) {
        let savedIds = [];
        if (state.folders) {
          if (state.activeFolderId) {
            const folder = state.folders.find((f) => f.id === state.activeFolderId);
            if (folder) savedIds = folder.iconIds;
          } else {
            savedIds = state.folders.flatMap((f) => f.iconIds);
            savedIds = [...new Set(savedIds)];
          }
        }
        if (savedIds.length === 0) return { illustrations: [], total: 0 };
        apiOptions.ids = savedIds.join(',');
      }

      const result = await window.illustrationsAPI.searchIllustrations(q, apiOptions);
      if (result && result.aborted) return { aborted: true };

      // If no results and no active filters/query, the index may still be building — retry
      const hasFilters = activeSourceFilters.length || activeStyleFilters.length ||
                         activeCategoryFilters.length || activeLicenseFilters.length;
      if (!q && !hasFilters && result.total === 0 && !apiOptions.ids) {
        window._illustrationIndexRetryCount = (window._illustrationIndexRetryCount || 0) + 1;
        if (window._illustrationIndexRetryCount <= 10) {
          const delay = Math.min(2000 * window._illustrationIndexRetryCount, 15000);
          console.log(`[API Loader] Illustration index still building, retrying in ${delay}ms (attempt ${window._illustrationIndexRetryCount})...`);
          await new Promise(r => setTimeout(r, delay));
          return window.loadIllustrationsFromAPI();
        }
      } else {
        window._illustrationIndexRetryCount = 0;
      }

      return { illustrations: result.results || [], total: result.total || 0 };
    } catch (error) {
      console.error('[API Loader] Failed to load illustrations:', error);
      return { illustrations: [], total: 0 };
    }
  };

  window.populateIllustrationsFromAPI = async function () {
    const result = await window.loadIllustrationsFromAPI();

    if (result && result.aborted) return -1;

    console.log(
      `[API Loader] Loaded ${result.illustrations.length} illustrations (total: ${result.total})`,
    );

    if (result.total === 0 && result.illustrations.length === 0) {
      // No data yet — rebuild ICONS from whatever is in REAL_ILLUSTRATIONS and return
      if (typeof window.recreateIllustrations === 'function') window.recreateIllustrations();
      return 0;
    }

    const collections = window.ILLUSTRATION_STATS?.collections || [];

    window.REAL_ILLUSTRATIONS = result.illustrations.map(item => {
      const sourceId = item.source || item.collection;
      const collection = collections.find(c => c.id === sourceId);
      // Use inline svg when available; otherwise fall back to the SVG endpoint URL
      const imageUrl = item.imageUrl || (item.svg ? null : window.illustrationsAPI.getIllustrationSVGUrl(sourceId, item.id));
      return {
        ...item,
        source: sourceId,
        sourceName: collection ? collection.name : (item.sourceName || item.collectionName || sourceId),
        imageUrl,
        svg: item.svg || '',
        id: item.id || `${sourceId}_${item.name}`,
        name: item.name,
        tags: item.tags || [],
        style: item.style || 'flat',
        viewBox: item.viewBox || '0 0 500 500',
        category: item.category || 'Illustration',
      };
    });

    // Rebuild ICONS and update filter counts; renderGrid (the caller) handles the actual render
    if (typeof window.recreateIllustrations === 'function') window.recreateIllustrations();

    return result.total;
  };

})();
