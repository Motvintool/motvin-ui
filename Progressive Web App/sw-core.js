const SW_VERSION = '0.2.0';
const CORE_CACHE = `motvin-pwa-core-${SW_VERSION}`;
const RUNTIME_CACHE = `motvin-pwa-runtime-${SW_VERSION}`;
const NO_CACHE_PATH_PREFIXES = ['/api', '/api/'];

const CORE_ASSETS = [
  '/',
  '/files.html',
  '/Progressive%20Web%20App/manifest.json',
  '/Progressive%20Web%20App/branding/logo-install.svg',
  '/Progressive%20Web%20App/branding/icon-192.png',
  '/Progressive%20Web%20App/branding/icon-512.png'
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

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request, { cache: 'no-store' });
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        runtimeCache.put('/files.html', networkResponse.clone());
        return networkResponse;
      } catch {
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        const coreCache = await caches.open(CORE_CACHE);
        return (await runtimeCache.match('/files.html')) || (await coreCache.match('/files.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const coreCache = await caches.open(CORE_CACHE);
    const runtimeCache = await caches.open(RUNTIME_CACHE);

    const cached = await coreCache.match(request) || await runtimeCache.match(request);

    try {
      const fresh = await fetch(request);
      if (fresh && fresh.status === 200) {
        runtimeCache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});
