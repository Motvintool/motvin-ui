/**
 * API Client for Motvin Illustrations Backend
 */

const getAPIBaseURL = () => {
  if (window.ENV && window.ENV.API_URL) {
    return window.ENV.API_URL.replace(/\/api\/(icons|logos)$/, '/api/illustrations');
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api/illustrations';
  }
  return 'https://api.motvin.com/api/illustrations';
};

const API_BASE_URL = getAPIBaseURL();

class IllustrationsAPIClient {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.CACHE_VERSION = 'v1';
  }

  async fetch(url, cacheKey, cacheTTL = 3600000) {
    const versionedKey = `${this.CACHE_VERSION}:${cacheKey}`;
    const cached = this.cache.get(versionedKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) return cached.data;

    if (this.pendingRequests.has(versionedKey)) return this.pendingRequests.get(versionedKey);

    const promise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data.success) throw new Error(data.error || 'API request failed');
        this.cache.set(versionedKey, { data: data.data, timestamp: Date.now() });
        this.pendingRequests.delete(versionedKey);
        return data.data;
      })
      .catch(err => {
        this.pendingRequests.delete(versionedKey);
        throw err;
      });

    this.pendingRequests.set(versionedKey, promise);
    return promise;
  }

  async getStats() {
    return this.fetch(`${API_BASE_URL}/stats`, 'stats', 3600000);
  }

  async getCollections() {
    return this.fetch(`${API_BASE_URL}/collections`, 'collections', 3600000);
  }

  async searchIllustrations(query = '', options = {}) {
    const { limit = 60, offset = 0, collection = '', style = '', category = '', license = '', ids = '' } = options;

    const params = new URLSearchParams({ q: query, limit: limit.toString(), offset: offset.toString() });
    if (collection) params.append('collection', collection);
    if (style)      params.append('style', style);
    if (category)   params.append('category', category);
    if (license)    params.append('license', license);
    if (ids)        params.append('ids', ids);

    const url = `${API_BASE_URL}/search?${params}`;
    return this.fetch(url, `search:${params.toString()}`, 60000);
  }

  getIllustrationSVGUrl(collectionId, itemId) {
    return `${API_BASE_URL}/${collectionId}/${itemId}.svg`;
  }

  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

window.illustrationsAPI = new IllustrationsAPIClient();
