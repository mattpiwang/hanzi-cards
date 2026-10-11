/* Cartes français / chinois — logique de révision, sans aucune dépendance.
   Style volontairement simple (var, fonctions nommées) pour rester lisible. */

(function () {
  'use strict';

  var STORE_KEY = 'hanzi-cards-v1';

  /* Le ton n'est pas stocké dans les données : on le déduit du diacritique du
     pinyin. Une seule table suffit, et elle sert aussi à colorer les exemples. */
  var TONES = {
    'ā': 1, 'ē': 1, 'ī': 1, 'ō': 1, 'ū': 1, 'ǖ': 1,
    'á': 2, 'é': 2, 'í': 2, 'ó': 2, 'ú': 2, 'ǘ': 2,
    'ǎ': 3, 'ě': 3, 'ǐ': 3, 'ǒ': 3, 'ǔ': 3, 'ǚ': 3,
    'à': 4, 'è': 4, 'ì': 4, 'ò': 4, 'ù': 4, 'ǜ': 4
  };

  /* Seuil de maîtrise : au-delà de 2, la carte sort du paquet « à revoir ».
     Compteur simple à trois états — 0 jamais vue, 1 à revoir, 2 en cours, 3 sue. */
  var MASTERED = 3;

  var state = {
    cards: [],
    view: [],          // cartes visibles après filtrage
    i: 0,              // index dans view
    flipped: false,
    filter: 'all',
    progress: {}       // { "好": { box: 3, seen: 4, at: "2026-10-11" } }
  };

  var el = {
    deckName: document.getElementById('deck-name'),
    filters: document.getElementById('filters'),
    card: document.getElementById('card'),
    front: document.getElementById('front-glyph'),
    back: document.getElementById('back'),
    counters: document.getElementById('counters'),
    bar: document.getElementById('bar-fill'),
    position: document.getElementById('position')
  };

  /* ------------------------------------------------------------------ */
  /*  Utilitaires                                                        */
  /* ------------------------------------------------------------------ */

  function toneOf(pinyin) {
    for (var i = 0; i < pinyin.length; i++) {
      if (TONES[pinyin[i]]) { return TONES[pinyin[i]]; }
    }
    return 0; // ton neutre
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function boxOf(card) {
    var p = state.progress[card.char];
    return p ? p.box : 0;
  }

  function setBox(card, box) {
    var old = state.progress[card.char] || { seen: 0 };
    state.progress[card.char] = {
      box: box,
      seen: old.seen + 1,
      at: new Date().toISOString().slice(0, 10)
    };
    save();
  }

  /* La progression est enregistrée dans le navigateur. Deux cas où ça échoue :
     navigation privée, et fichier ouvert en file:// (Chrome l'interdit). Dans ce
     cas on continue simplement en mémoire : l'app reste utilisable, la
     progression est perdue à la fermeture. */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.progress)); }
    catch (e) { /* on ignore : mode privé ou file:// */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { state.progress = JSON.parse(raw) || {}; }
    } catch (e) { state.progress = {}; }
  }

  function masteredCount() {
    return state.cards.filter(function (c) { return boxOf(c) >= MASTERED; }).length;
  }

  function toReviewCount() {
    return state.cards.filter(function (c) { return boxOf(c) < MASTERED; }).length;
  }

  /* ------------------------------------------------------------------ */
  /*  Filtres                                                            */
  /* ------------------------------------------------------------------ */

  function buildFilters() {
    var cats = [];
    state.cards.forEach(function (c) {
      if (cats.indexOf(c.category) === -1) { cats.push(c.category); }
    });

    var html = chip('all', 'Toutes', state.cards.length, state.filter === 'all');
    cats.forEach(function (cat) {
      var n = state.cards.filter(function (c) { return c.category === cat; }).length;
      html += chip(cat, cat, n, state.filter === cat);
    });
    html += chip('review', 'À revoir', toReviewCount(), state.filter === 'review');
    el.filters.innerHTML = html;
  }

  function chip(key, label, count, active) {
    return '<button class="chip" data-key="' + esc(key) + '" aria-pressed="' +
      (active ? 'true' : 'false') + '">' + esc(label) +
      '<span class="n">' + count + '</span></button>';
  }

  function applyFilter(key) {
    state.filter = key;
    state.i = 0;
    if (key === 'all') {
      state.view = state.cards.slice();
    } else if (key === 'review') {
      state.view = state.cards.filter(function (c) { return boxOf(c) < MASTERED; });
    } else {
      state.view = state.cards.filter(function (c) { return c.category === key; });
    }
    buildFilters();
    render();
  }

  /* ------------------------------------------------------------------ */
  /*  Rendu                                                              */
  /* ------------------------------------------------------------------ */

  function current() {
    return state.view[state.i];
  }

  /* Le verso concentre tout ce qui est demandé : pinyin, radicaux, exemples de
     mots, étymologie. */
  function backHTML(c) {
    var comps = c.components.map(function (t) {
      return '<li><span class="r">' + esc(t[0]) + '</span>' +
             '<span class="g">' + esc(t[1]) + '</span>' +
             '<span class="role">' + esc(t[2]) + '</span></li>';
    }).join('');

    var words = c.words.map(function (t) {
      return '<li><span class="w">' + esc(t[0]) + '</span>' +
             '<span class="p tone-' + toneOf(t[1]) + '">' + esc(t[1]) + '</span>' +
             '<span class="t">' + esc(t[2]) + '</span></li>';
    }).join('');

    return '' +
      '<div class="back-head">' +
        '<div class="pinyin tone-' + toneOf(c.pinyin) + '">' + esc(c.pinyin) + '</div>' +
        '<div class="meaning">' + esc(c.meaning) + '</div>' +
      '</div>' +
      '<section><h3>Radicaux</h3><ul class="comps">' + comps + '</ul></section>' +
      '<section><h3>Exemples</h3><ul class="words">' + words + '</ul></section>' +
      '<section><h3>Étymologie</h3>' +
        '<p class="etype">' + esc(c.etymology[0]) + '</p>' +
        '<p class="etext">' + esc(c.etymology[1]) + '</p>' +
      '</section>' +
      (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '');
  }

  function render() {
    var c = current();

    if (!c) {
      el.front.textContent = '—';
      el.back.innerHTML = '<p class="meaning">Aucune carte dans ce filtre.</p>';
      el.position.textContent = '';
      updateStats();
      return;
    }

    el.front.textContent = c.char;
    el.back.innerHTML = backHTML(c);
    el.back.scrollTop = 0;

    // On repart toujours du recto quand on change de carte.
    state.flipped = false;
    el.card.classList.remove('flipped');

    el.position.textContent = 'Carte ' + (state.i + 1) + ' / ' + state.view.length + ' · ' + c.category;
    updateStats();
  }

  function updateStats() {
    var total = state.cards.length;
    var known = masteredCount();
    el.counters.textContent = state.view.length + ' carte' + (state.view.length > 1 ? 's' : '') +
      ' · ' + toReviewCount() + ' à revoir · ' + known + ' sue' + (known > 1 ? 's' : '');
    el.bar.style.width = total ? Math.round(known / total * 100) + '%' : '0%';
  }

  /* ------------------------------------------------------------------ */
  /*  Actions                                                            */
  /* ------------------------------------------------------------------ */

  function flip() {
    if (!current()) { return; }
    state.flipped = !state.flipped;
    el.card.classList.toggle('flipped', state.flipped);
  }

  function go(delta) {
    if (!state.view.length) { return; }
    // Navigation circulaire : après la dernière, on revient à la première.
    state.i = (state.i + delta + state.view.length) % state.view.length;
    render();
  }

  function mark(known) {
    var c = current();
    if (!c) { return; }
    // « Je sais » monte d'un cran (max 3), « À revoir » renvoie au début.
    setBox(c, known ? Math.min(boxOf(c) + 1, MASTERED) : 1);

    // Dans le filtre « à revoir », une carte maîtrisée quitte la liste :
    // on la retire pour ne pas la revoir tout de suite.
    if (state.filter === 'review' && boxOf(c) >= MASTERED) {
      state.view.splice(state.i, 1);
      if (state.i >= state.view.length) { state.i = 0; }
      buildFilters();
      render();
      return;
    }

    buildFilters();
    updateStats();
    go(1);
  }

  function shuffle() {
    for (var i = state.view.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = state.view[i]; state.view[i] = state.view[j]; state.view[j] = tmp;
    }
    state.i = 0;
    render();
  }

  function resetProgress() {
    if (!confirm('Effacer toute la progression (cartes sues et à revoir) ?')) { return; }
    state.progress = {};
    save();
    applyFilter('all');
  }

  /* ------------------------------------------------------------------ */
  /*  Écouteurs                                                          */
  /* ------------------------------------------------------------------ */

  el.filters.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (b) { applyFilter(b.dataset.key); }
  });

  el.card.addEventListener('click', flip);
  el.card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); flip(); }
  });

  document.getElementById('flip').addEventListener('click', flip);
  document.getElementById('prev').addEventListener('click', function () { go(-1); });
  document.getElementById('next').addEventListener('click', function () { go(1); });
  document.getElementById('known').addEventListener('click', function () { mark(true); });
  document.getElementById('again').addEventListener('click', function () { mark(false); });
  document.getElementById('shuffle').addEventListener('click', shuffle);
  document.getElementById('reset').addEventListener('click', resetProgress);

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; }
    switch (e.key) {
      case ' ': case 'Enter': e.preventDefault(); flip(); break;
      case 'ArrowLeft': go(-1); break;
      case 'ArrowRight': go(1); break;
      case '1': mark(false); break;
      case '2': mark(true); break;
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Démarrage                                                          */
  /* ------------------------------------------------------------------ */

  function start(data) {
    state.cards = data.cards || [];
    state.view = state.cards.slice();
    el.deckName.textContent = (data.deck || 'Jeu de cartes') + ' — ' + state.cards.length + ' caractères';
    buildFilters();
    render();
  }

  function fail(err) {
    el.deckName.textContent = 'Erreur';
    el.back.innerHTML = '<p class="meaning">Impossible de charger les cartes : ' + esc(err.message) +
      '<br><br>Lance le site via un serveur local (serve.cmd ou Ctrl+Shift+B dans VS Code) : ' +
      'un fichier ouvert en file:// ne peut pas lire le JSON voisin.</p>';
  }

  load();

  /* Deux modes de chargement :
     - fichier unique (cartes-mobile.html) : les données sont déjà dans la page,
       via window.__CARDS__ — aucun réseau nécessaire, ça marche hors ligne ;
     - site normal : on va chercher data/cards.json. */
  if (window.__CARDS__) {
    start(window.__CARDS__);
  } else {
    fetch('data/cards.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) { throw new Error('fichier de cartes introuvable (' + r.status + ')'); }
        return r.json();
      })
      .then(start)
      .catch(fail);
  }

  /* Installation sur le téléphone : le service worker met le site en cache pour
     qu'il fonctionne hors ligne. Il n'est disponible que sur une origine
     sécurisée (https, ou localhost) — sur http:// vers l'IP du réseau local le
     navigateur le refuse, et `serviceWorker` est simplement absent. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* silencieux */ });
    });
  }

})();
