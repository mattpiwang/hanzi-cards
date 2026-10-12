/* Service worker : met l'application en cache pour qu'elle fonctionne hors ligne
   une fois installée sur le téléphone.

   Rappel important : un service worker ne s'enregistre que sur une origine
   sécurisée — https://, ou http://localhost / 127.0.0.1. Sur
   http://<IP-du-PC>:8002 (l'IP du PC vue du téléphone), le navigateur le
   refuse : l'app fonctionne, mais sans mode hors ligne. */

var CACHE = 'hanzi-cards-v3';

/* Tout ce dont l'app a besoin pour démarrer sans réseau. */
var ASSETS = [
  './',
  './index.html',
  './theme.html',
  './assets/style.css',
  './assets/app.js',
  './data/cards.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Stratégie « cache d'abord » : instantané et hors ligne. Le réseau ne sert
   qu'à remplir le cache au premier passage. */
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') { return; }

  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) { return hit; }
      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return response;
      }).catch(function () {
        return caches.match('./index.html');   // dernier recours
      });
    })
  );
});
