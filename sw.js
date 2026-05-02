/* When Is F1 — service worker */

const VERSION = 'v2';
const SHELL_CACHE = `wif-shell-${VERSION}`;
const ASSET_CACHE = `wif-assets-${VERSION}`;
const API_CACHE   = `wif-api-${VERSION}`;

// Files that make up the app shell. Precache on install so the app
// boots offline after the first visit.
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './lib/theme.js',
  './lib/api.js',
  './lib/format.js',
  './lib/ics.js',
  './lib/gcal.js',
  './lib/combobox.js',
  './data/countries.js',
  './data/country-timezones.js',
  './data/circuit-timezones.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

const API_HOST  = 'api.jolpi.ca';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => ![SHELL_CACHE, ASSET_CACHE, API_CACHE].includes(k))
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jolpica API: network first, fall back to cache. Save fresh responses.
  if (url.hostname === API_HOST) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Google Fonts: stale-while-revalidate.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }

  // Same-origin: cache first for static assets, network fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    // Last-resort fallback for navigations: return cached index.
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}
