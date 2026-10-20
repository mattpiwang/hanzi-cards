/* Service worker : met l'application en cache pour qu'elle fonctionne hors ligne
   une fois installée sur le téléphone.

   Rappel important : un service worker ne s'enregistre que sur une origine
   sécurisée — https://, ou http://localhost / 127.0.0.1. Sur
   http://<IP-du-PC>:8002 (l'IP du PC vue du téléphone), le navigateur le
   refuse : l'app fonctionne, mais sans mode hors ligne.

   Stratégie de mise à jour
   ------------------------
   - Le DOCUMENT (la page) : le RÉSEAU D'ABORD. On veut toujours la dernière
     version quand on est en ligne ; le cache ne sert qu'en secours, hors ligne.
   - Tout le reste (CSS, JS, données, icônes) : « stale-while-revalidate ». On
     répond instantanément depuis le cache ET on va chercher la nouvelle version
     en arrière-plan, pour la prochaine ouverture.

   Pourquoi ce choix : avec l'ancienne stratégie (« cache d'abord » partout), le
   nouveau service worker pouvait mettre très longtemps à prendre la main sur un
   téléphone — l'app restait alors bloquée sur une vieille version, parfois
   pendant des jours, sans aucun moyen simple de la forcer à jour. */

var CACHE = 'hanzi-cards-v187';

/* Tout ce dont l'app a besoin pour démarrer sans réseau.
   Les tracés (data/strokes.json) et la bibliothèque hanzi-writer ne sont PAS
   listés : ils sont lourds et facultatifs. Le gestionnaire de requêtes plus bas
   les met en cache au premier usage. */
var ASSETS = [
  './',
  './index.html',
  './theme.html',
  './assets/style.css',
  './assets/app.js',
  './data/cards-hsk1.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/tap.webp'
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

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') { return; }

  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) { return; }   // on ne touche pas au reste

  var accepte = event.request.headers.get('accept') || '';
  var estDocument = event.request.mode === 'navigate' ||
                    accepte.indexOf('text/html') !== -1;

  /* --- Le document : le réseau d'abord, le cache en secours --------------- */
  if (estDocument) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        var copie = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copie); });
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (hit) {
          return hit || caches.match('./index.html');   // dernier recours
        });
      })
    );
    return;
  }

  /* --- Le reste : cache immédiat, rafraîchissement en arrière-plan -------- */
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(event.request).then(function (duCache) {
        var duReseau = fetch(event.request).then(function (response) {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(event.request, response.clone());
          }
          return response;
        });
        /* On garde le service worker en vie le temps du rafraîchissement :
           sans ce waitUntil, le navigateur peut l'arrêter avant d'avoir mis
           la nouvelle version en cache. */
        event.waitUntil(duReseau.catch(function () { /* hors ligne : on ignore */ }));
        return duCache || duReseau;
      });
    }).catch(function () {
      return caches.match('./index.html');
    })
  );
});
