// Aladin Express & Driver Service Worker
const CACHE_NAME = 'aladin-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/app',
  '/driver',
  '/partner',
  '/kitchen',
  '/download',
  '/icon.svg',
  '/logo.png',
  '/driver-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Stale-while-revalidate for HTML and assets; network-first for API
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request);
      })
    );
  }
});
