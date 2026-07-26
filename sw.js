// Cockpit service worker.
// Strategy: NETWORK-FIRST for the app shell so the phone always gets the latest
// version when online (falling back to cache only when offline). API calls always
// go straight to the network and are never cached. Bump CACHE to force a refresh.
const CACHE = 'cockpit-v4';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
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
  if (u.pathname.startsWith('/api/')) return; // never cache live data
  if (u.pathname === '/skin.js') return; // always network-fresh app code
  // Network-first: fetch fresh, cache a copy, fall back to cache when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
  );
});


// ---- Web Push (Cyprus) ----
self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e){ data = { body: event.data ? event.data.text() : '' }; }
  var title = data.title || 'Cyprus';
  var options = { body: data.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: data.tag || 'cyprus', renotify: true, data: { url: data.url || '/app/' } };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/app/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for(var i=0;i<list.length;i++){ if(list[i].url.indexOf(url) > -1 && 'focus' in list[i]) return list[i].focus(); }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
