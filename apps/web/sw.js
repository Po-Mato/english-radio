self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open('english-radio-v1').then((cache) => cache.addAll([
    '/',
    '/manifest.webmanifest'
  ])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/stream/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
