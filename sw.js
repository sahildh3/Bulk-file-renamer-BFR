/**
 * BFR — Bulk File Renamer | Service Worker v3
 * Cache-first for same-origin assets; pass-through for cross-origin.
 * Bump CACHE_NAME to force clients to update cached assets.
 */
const CACHE_NAME = 'bfr-v3';

const PRECACHE = [
  './',
  './index.html',
  './sw.js',
  './manifest.json',
  './icon.svg',
];

// ── Install: pre-cache static assets ────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(err => console.warn('[BFR SW] Pre-cache failed:', err))
  );
});

// ── Activate: purge stale caches ────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for same-origin ───────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request)
          .then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
