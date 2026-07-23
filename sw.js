/* Service worker: makes the installed app work offline / independent of the
 * GitHub Pages site being live. Strategy: network-first (so it picks up updates
 * whenever the site is reachable) with a cache fallback (so it still runs when
 * the site is offline or the repo has been made private). */
const CACHE = 'boop-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './pages.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // A good response: refresh the cache and use it.
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        }
        // Non-OK (e.g. 404 from a now-private Pages site): fall back to cache.
        return caches.match(e.request).then((hit) => hit || res);
      })
      .catch(() =>
        // Network failure (offline): serve from cache; for navigations, the shell.
        caches.match(e.request).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
