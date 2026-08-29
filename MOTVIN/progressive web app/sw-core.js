const SW_VERSION = 'v1.0.11';
const CORE_CACHE = `code2design-core-${SW_VERSION}`;
const RUNTIME_CACHE = `code2design-runtime-${SW_VERSION}`;
const NO_CACHE_PATH_PREFIXES = ['/updates', '/updates/', '/api', '/api/'];
const NETWORK_FIRST_DESTINATIONS = new Set(['script', 'style', 'worker', 'font', 'manifest']);

const CORE_ASSETS = [
  '/',
  '/files.html',
  '/progressive%20web%20app/manifest.json',
  '/progressive%20web%20app/branding/icon-192.png',
  '/progressive%20web%20app/branding/icon-512.png',
  '/progressive%20web%20app/branding/logo-install.svg',
  '/assets/icon/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => ![CORE_CACHE, RUNTIME_CACHE].includes(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const shouldBypassCache = NO_CACHE_PATH_PREFIXES.some((prefix) =>
    url.pathname === prefix || url.pathname.startsWith(prefix)
  );

  if (shouldBypassCache) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put('/files.html', networkResponse.clone());
        return networkResponse;
      } catch {
        const cache = await caches.open(CORE_CACHE);
        const cached = await cache.match('/files.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const coreCache = await caches.open(CORE_CACHE);
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const cached = await coreCache.match(request) || await runtimeCache.match(request);
    const destination = request.destination || '';

    // JS/CSS and similar assets should prefer network so deployments are visible quickly.
    if (NETWORK_FIRST_DESTINATIONS.has(destination)) {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200) {
          runtimeCache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    }

    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        runtimeCache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
