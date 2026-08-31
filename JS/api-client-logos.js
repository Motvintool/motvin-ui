/**
 * API Client for Motvin Logos Backend
 * Handles all communication with the NestJS backend API
 */

// API URL Configuration
// - Local development: http://localhost:3000/api/logos
// - Docker development: http://localhost:3000/api/logos (via port mapping)
// - Production: https://api.motvin.com/api/logos
const getAPIBaseURL = () => {
  // Check for environment config (injected by Docker/deployment)
  if (window.ENV && window.ENV.API_URL) {
    return window.ENV.API_URL;
  }

  const hostname = window.location.hostname;
  const port = window.location.port;

  // Local development or Docker (localhost:8080 for Docker UI)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Use same localhost but backend port 3000
    return 'http://localhost:3000/api/logos';
  }

  // Production - use separate API domain
  return 'https://api.motvin.com/api/logos';
};

const API_BASE_URL = getAPIBaseURL();

class LogosAPIClient {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.CACHE_VERSION = 'v2'; // Increment when API changes
  }

  /**
   * Generic fetch with caching and deduplication
   */
  async fetch(url, cacheKey, cacheTTL = 3600000) {
    // Add version to cache key
    const versionedKey = `${this.CACHE_VERSION}:${cacheKey}`;

    // Check cache first
    const cached = this.cache.get(versionedKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(versionedKey)) {
      return this.pendingRequests.get(versionedKey);
    }

    // Make new request
    const promise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data.success) throw new Error(data.error || 'API request failed');

        // Cache the result
        this.cache.set(versionedKey, {
          data: data.data,
          timestamp: Date.now()
        });

        this.pendingRequests.delete(versionedKey);
        return data.data;
      })
      .catch(err => {
        this.pendingRequests.delete(versionedKey);
        console.error('API Error:', err);
        throw err;
      });

    this.pendingRequests.set(versionedKey, promise);
    return promise;
  }

  /**
   * Get icon statistics (total, byStyle, byLicense, byCategory, collections)
   * Cached for 1 hour
   */
  async getStats() {
    return this.fetch(
      `${API_BASE_URL}/stats`,
      'stats',
      3600000 // 1 hour cache
    );
  }

  /**
   * Get all collections list
   */
  async getCollections() {
    return this.fetch(
      `${API_BASE_URL}/collections`,
      'collections',
      3600000 // 1 hour cache
    );
  }

  /**
   * Get icons from a specific collection with filters
   * @param {string} collectionId - Collection ID
   * @param {object} options - {limit, offset, style, category, search}
   */
  async getLogos(collectionId, options = {}) {
    const {
      limit = 60,
      offset = 0,
      style = '',
      category = '',
      search = ''
    } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (style) params.append('style', style);
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const url = `${API_BASE_URL}/collection/${collectionId}/icons?${params}`;
    const cacheKey = `icons:${collectionId}:${params.toString()}`;

    return this.fetch(url, cacheKey, 300000); // 5 min cache
  }

  /**
   * Search icons across all collections
   * @param {string} query - Search query (can be empty for browsing all)
   * @param {object} options - {limit, offset, collection, style, category}
   */
  async searchLogos(query = '', options = {}) {  // Default empty string
    const {
      limit = 60,
      offset = 0,
      collection = '',
      style = '',
      category = '',
      license = '',
      ids = ''
    } = options;

    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (collection) params.append('collection', collection);
    if (style) params.append('style', style);
    if (category) params.append('category', category);
    if (license) params.append('license', license);
    if (ids) params.append('ids', ids);

    const url = `${API_BASE_URL}/search?${params}`;
    const cacheKey = `search:${params.toString()}`;

    return this.fetch(url, cacheKey, 60000); // 1 min cache
  }

  /**
   * Get SVG URL for an icon (for CDN caching)
   * @param {string} collectionId - Collection ID
   * @param {string} iconName - Icon name
   */
  getLogoSVGUrl(collectionId, iconName) {
    return `${API_BASE_URL}/${collectionId}/${iconName}.svg`;
  }

  /**
   * Clear cache (useful for testing/debugging)
   */
  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache stats (useful for debugging)
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cachedKeys: Array.from(this.cache.keys())
    };
  }
}

// Create global instance
window.logosAPI = new LogosAPIClient();
