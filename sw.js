/* HydroLogic Service Worker — offline-first cache */
const CACHE = 'hydrologic-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/db.js',
  './js/stations.js',
  './js/auth.js',
  './js/sync.js',
  './js/discharge.js',
  './js/gwl.js',
  './js/dashboard.js',
  './js/report.js',
  './js/app.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/supabase.js',
  './assets/logo.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.ico',
  './assets/icons/logo-full-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Fetch fresh copies (bypass HTTP cache) so we never cache stale assets.
      .then((c) => Promise.all(ASSETS.map((u) =>
        fetch(new Request(u, { cache: 'reload' })).then((res) => c.put(u, res)).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for app shell; network falls back to cache when offline.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // Let cross-origin requests (e.g. Supabase API) go straight to the network —
  // don't try to serve/replace them from cache.
  if (new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // Cache new same-origin GETs opportunistically.
          if (res && res.status === 200 && new URL(request.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
