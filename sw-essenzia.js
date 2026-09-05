// Service worker minimo: solo pasa las peticiones a la red, no cachea nada
// (para no interferir con la regla de no-cache del archivo principal).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
