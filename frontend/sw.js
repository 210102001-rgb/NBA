/* NBA Bank Sampah Digital — service worker (PWA).
   - App shell (html/js/css/gambar/ikon): cache-first, versi di CACHE agar update terkendali.
   - API (/nba/api/): selalu network, tidak pernah di-cache.
   - Navigasi: network-first, fallback ke cache saat offline. */
'use strict';
const CACHE = 'nba-v1';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './assets/logo.js',
  './assets/maskot.js',
  './vendor/leaflet.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;          // tile OSM dkk: biarkan
  if (u.pathname.includes('/api/')) return;               // API: selalu network
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (hit) => hit || fetch(e.request).then((r) => {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cp));
        return r;
      })
    )
  );
});
