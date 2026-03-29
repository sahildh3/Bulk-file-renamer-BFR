/**
 * BFR — Bulk File Renamer | Service Worker
 * @version 2.1.0
 *
 * Strategy:
 *   - Install: pre-cache every static asset so the app works 100% offline.
 *   - Activate: delete any old cache versions (bump CACHE_NAME to force update).
 *   - Fetch: cache-first for same-origin requests; pass-through for cross-origin.
 *
 * To release a new version that forces clients to update:
 *   Change CACHE_NAME from 'bfr-v2' to 'bfr-v3' (or higher).
 */

const CACHE_NAME = 'bfr-v2';

/**
 * Complete list of assets to pre-cache on install.
 * Paths must exactly match the deployed directory structure:
 *   /             → index.html, manifest.json, sw.js
 *   /css/         → styles.css
 *   /js/          → script.js
 *   /js/vendor/   → jszip.min.js
 *   /icons/       → icon.svg
 */
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/script.js',
  './js/vendor/jszip.min.js',
  './icons/icon.svg',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap'
];

// ── Install: pre-cache all static assets ──────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => console.warn('[BFR SW] Pre-cache failed:', err))
  );
});

// ── Activate: purge stale caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => {
              console.log('[BFR SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => clients.claim())
  );
});

// ── Fetch: cache-first for same-origin, pass-through otherwise ─
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Only cache-intercept same-origin requests
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin &&
      !event.request.url.startsWith('https://fonts.googleapis.com') &&
      !event.request.url.startsWith('https://fonts.gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        // Return cached immediately, but refresh cache in background
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached); // Network failed → serve stale

        return cached || networkFetch;
      })
    )
  );
});
