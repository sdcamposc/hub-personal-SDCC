/**
 * Service Worker del Hub Personal
 * ─────────────────────────────────────────────────────────────
 * Qué SÍ cachea: las páginas del hub, hub.css y los íconos —
 * el "cascarón" de la app, para que abra rápido y algo se vea
 * incluso sin conexión.
 *
 * Qué NUNCA cachea ni intercepta: nada que no sea GET, y nada que
 * no sea de este mismo origen. Eso deja completamente afuera todas
 * las llamadas a Apps Script (Gastos, Sistema Personal, Running,
 * Inversiones) y a Google Fonts — esos datos son dinámicos, están
 * protegidos por token, y cachearlos podría mostrar información
 * vieja o de otro momento como si fuera actual.
 *
 * Estrategia para lo que sí cachea: "stale-while-revalidate" — 
 * muestra de inmediato lo que hay en caché (rápido, funciona offline)
 * y en paralelo pide la versión nueva a internet para la próxima vez.
 */

const CACHE_NAME = 'hub-personal-v1';

const CASCARON = [
  './',
  './index.html',
  './hub.css',
  './manifest.json',
  './icono-192.png',
  './icono-512.png',
  './gastos/index.html',
  './gastos/gastos2.html',
  './habitos/index.html',
  './tareas/index.html',
  './notas/index.html',
  './running/index.html',
  './inversiones/index.html',
  './inversiones/panel.html'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll falla entero si UNA sola URL no existe (por ej. si todavía no
      // subiste algún archivo) — por eso las agregamos de a una, tolerando
      // que alguna falle sin tumbar la instalación completa.
      return Promise.all(
        CASCARON.map(function (url) {
          return cache.add(url).catch(function () { /* se ignora, no bloquea */ });
        })
      );
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;

  // Solo intervenimos en GET a nuestro propio origen. Todo lo demás
  // (Apps Script, Google Fonts, POST, etc.) sigue directo a la red,
  // sin pasar por este service worker.
  let esMismoOrigen = false;
  try { esMismoOrigen = new URL(req.url).origin === self.location.origin; } catch (e) {}
  if (req.method !== 'GET' || !esMismoOrigen) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cacheado) {
      const actualizar = fetch(req).then(function (respuestaRed) {
        if (respuestaRed && respuestaRed.status === 200) {
          const copia = respuestaRed.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copia); });
        }
        return respuestaRed;
      }).catch(function () {
        // sin internet: si había algo en caché, ya se devolvió abajo;
        // si no había nada, no hay mucho más que hacer.
        return cacheado;
      });

      return cacheado || actualizar;
    })
  );
});
