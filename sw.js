// Minimal offline shell. API calls always go to network; the app shell is cached.
const CACHE = 'cockpit-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return; // never cache data
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});
