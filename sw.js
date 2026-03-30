/**
 * sw.js — Service Worker for Seestern Fighters PWA
 * Caches all game assets for offline play.
 * Strategy: Cache-first with network fallback.
 */

const CACHE_NAME = 'seestern-fighters-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/main.js',
  './src/world.js',
  './src/character.js',
  './src/input.js',
  './src/touch.js',
  './src/combat.js',
  './src/ai.js',
  './src/hud.js',
  './src/gamestate.js',
  './src/weapons.js',
  './src/projectile.js',
  './src/pickup.js',
  './src/obstacles.js',
  './src/level.js',
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fallback to network
self.addEventListener('fetch', (event) => {
  // Only cache same-origin and CDN Three.js requests
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isThreeJS    = url.hostname === 'unpkg.com';

  if (!isSameOrigin && !isThreeJS) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache valid responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
