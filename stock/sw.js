/*
 * sw.js — Service Worker del Control de Stock (PWA).
 *
 * Estrategia de actualización SEGURA para iPad:
 *  - CACHE_VERSION cambia con cada despliegue => se descarta el caché antiguo.
 *  - HTML/JS: network-first (siempre intenta la versión nueva; cae al caché sin red).
 *    Así el iPad NUNCA se queda con una interfaz antigua tras desplegar.
 *  - skipWaiting + clients.claim: la versión nueva toma control de inmediato.
 *
 * Para comprobar la versión activa: abre la consola del navegador o mira el pie de la
 * app ("stock vX.Y.Z"); en Ajustes de iOS puedes "Añadir a pantalla de inicio" de nuevo
 * si algo quedara cacheado. Al subir cambios, incrementa CACHE_VERSION.
 */
var CACHE_VERSION = 'glr-stock-v1.0.0';
var CORE = [
  './',
  './index.html',
  './catalog.js',
  './stock-engine.js',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) { return c.addAll(CORE); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Network-first para documentos y scripts propios: la versión nueva gana.
  e.respondWith(
    fetch(req)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        return res;
      })
      .catch(function () { return caches.match(req); })
  );
});
