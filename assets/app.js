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
    view: [],          // cartes affichées, dans l'ordre courant
    i: 0,              // index dans view
    flipped: false,
    titre: '',         // thème en cours, quand il vient de l'adresse
    progress: {}       // { "好": { box: 3, seen: 4, at: "2026-10-11" } }
  };

  var el = {
    deckName: document.getElementById('deck-name'),
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
  /*  Rendu                                                              */
  /* ------------------------------------------------------------------ */

  function current() {
    return state.view[state.i];
  }

  /* Le verso concentre tout ce qui est demandé : pinyin, radicaux, exemples de
     mots, étymologie. */
  function backHTML(c) {
    /* Chaque section n'apparaît que si la donnée existe : les fiches
       importées n'ont pas d'exemples de mots, et certaines n'ont pas de
       radicaux exploitables dans la source. */
    var compsHTML = (c.components && c.components.length)
      ? '<section><h3>Radicaux</h3><ul class="comps">' +
          c.components.map(function (t) {
            return '<li><span class="r">' + esc(t[0]) + '</span>' +
                   '<span class="g">' + esc(t[1]) + '</span>' +
                   '<span class="role">' + esc(t[2]) + '</span></li>';
          }).join('') +
        '</ul></section>'
      : '';

    var wordsHTML = (c.words && c.words.length)
      ? '<section><h3>Exemples</h3><ul class="words">' +
          c.words.map(function (t) {
            return '<li><span class="w">' + esc(t[0]) + '</span>' +
                   '<span class="p tone-' + toneOf(t[1]) + '">' + esc(t[1]) + '</span>' +
                   '<span class="t">' + esc(t[2]) + '</span></li>';
          }).join('') +
        '</ul></section>'
      : '';

    /* Le sens vient du français quand il existe, sinon de la base anglaise
       (avec une petite mention « en » pour que ce soit clair). */
    var sens = c.meaning
      ? esc(c.meaning)
      : (c.meaningEn ? esc(c.meaningEn) + ' <span class="en">en</span>' : '—');

    var etymoHTML = (c.etymology && c.etymology.length)
      ? '<section><h3>Étymologie</h3>' +
          '<p class="etype">' + esc(c.etymology[0]) + '</p>' +
          (c.etymology[1] ? '<p class="etext">' + esc(c.etymology[1]) + '</p>' : '') +
        '</section>'
      : '';

    return '' +
      '<div class="back-head">' +
        '<div class="pinyin tone-' + toneOf(c.pinyin) + '">' + esc(c.pinyin) + '</div>' +
        '<div class="meaning">' + sens + '</div>' +
      '</div>' +
      compsHTML + wordsHTML + etymoHTML +
      (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '');
  }

  function render() {
    var c = current();

    if (!c) {
      el.front.textContent = '—';
      el.back.innerHTML = '<p class="meaning">Aucune carte ici.</p>';
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
    state.view = state.cards.slice();
    state.i = 0;
    render();
  }

  /* ------------------------------------------------------------------ */
  /*  Geste de glissement                                                */
  /* ------------------------------------------------------------------ */

  /* Glisser vers la droite = « Je sais », vers la gauche = « À revoir » : les
     deux mêmes actions que les boutons, dans le même ordre qu'à l'écran. Un
     appui bref sans déplacement reste un clic, qui retourne la carte. */
  var swipeEl = document.getElementById('swipe');
  var tagYes = swipeEl ? swipeEl.querySelector('.swipe-tag.yes') : null;
  var tagNo = swipeEl ? swipeEl.querySelector('.swipe-tag.no') : null;

  var geste = {
    x0: 0, y0: 0, t0: 0,
    dx: 0,
    pose: false,       // un doigt est posé
    suivi: false,      // le mouvement est horizontal : on suit le doigt
    avaleClic: false   // le clic qui suit la fin d'un glissement est ignoré
  };

  /* Seuil de déclenchement : une fraction de la largeur, bornée, pour rester
     confortable sur un téléphone comme sur un grand écran. */
  function seuilGlissement() {
    var largeur = swipeEl ? swipeEl.offsetWidth : 400;
    return Math.max(70, Math.min(150, largeur * 0.26));
  }

  /* Opacité des étiquettes, proportionnelle à la distance parcourue. */
  function etiquettes(dx) {
    var force = Math.min(Math.abs(dx) / seuilGlissement(), 1);
    if (tagYes) { tagYes.style.opacity = dx > 0 ? force : 0; }
    if (tagNo) { tagNo.style.opacity = dx < 0 ? force : 0; }
  }

  /* Remet l'enveloppe en place sans animation, pour la carte suivante. */
  function remettreEnPlace() {
    if (!swipeEl) { return; }
    swipeEl.classList.remove('dragging');
    swipeEl.style.transition = 'none';
    swipeEl.style.transform = '';
    swipeEl.style.opacity = '';
    void swipeEl.offsetWidth;   // force le navigateur à appliquer tout de suite
    swipeEl.style.transition = '';
  }

  function finDeGlissement(declenche) {
    var dx = geste.dx;
    geste.pose = false;
    geste.suivi = false;
    geste.dx = 0;
    etiquettes(0);

    if (!swipeEl) { return; }

    if (!declenche) {
      // Trop court : la carte revient en place (la transition CSS fait le ressort),
      // et le clic éventuel retournera la carte.
      swipeEl.classList.remove('dragging');
      swipeEl.style.transform = '';
      return;
    }

    // Assez loin : la carte part de son côté, puis on passe à la suivante.
    geste.avaleClic = true;
    window.setTimeout(function () { geste.avaleClic = false; }, 400);
    swipeEl.classList.remove('dragging');
    swipeEl.style.transform = 'translateX(' + (dx > 0 ? 130 : -130) + '%) rotate(' +
      (dx > 0 ? 12 : -12) + 'deg)';
    swipeEl.style.opacity = '0';

    window.setTimeout(function () {
      remettreEnPlace();
      mark(dx > 0);
    }, 230);
  }

  if (swipeEl) {
    swipeEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) { return; }
      if (!current()) { return; }
      geste.pose = true;
      geste.suivi = false;
      geste.x0 = e.clientX;
      geste.y0 = e.clientY;
      geste.t0 = Date.now();
      geste.dx = 0;
    });

    swipeEl.addEventListener('pointermove', function (e) {
      if (!geste.pose) { return; }
      var dx = e.clientX - geste.x0;
      var dy = e.clientY - geste.y0;

      if (!geste.suivi) {
        /* Il faut un mouvement franchement horizontal pour prendre la main :
           un geste vertical doit rester un défilement du verso. */
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) { return; }
        geste.suivi = true;
        swipeEl.classList.add('dragging');
        try { swipeEl.setPointerCapture(e.pointerId); } catch (err) { /* sans gravité */ }
      }

      if (e.cancelable) { e.preventDefault(); }
      geste.dx = dx;
      // Léger pivot, comme une carte qu'on fait glisser sur la table.
      swipeEl.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 30) + 'deg)';
      etiquettes(dx);
    });

    function relacher() {
      if (!geste.pose) { return; }
      var dx = geste.dx;
      var rapide = (Date.now() - geste.t0) < 250 && Math.abs(dx) > 34;
      var loin = Math.abs(dx) >= seuilGlissement();
      finDeGlissement(geste.suivi && (loin || rapide));
    }

    swipeEl.addEventListener('pointerup', relacher);
    swipeEl.addEventListener('pointercancel', relacher);
    // Filet de sécurité : si la fenêtre perd le focus en plein geste.
    window.addEventListener('blur', function () { if (geste.pose) { finDeGlissement(false); } });
  }

  /* ------------------------------------------------------------------ */
  /*  Menu (burger)                                                      */
  /* ------------------------------------------------------------------ */

  var menuBtn = document.getElementById('menu-toggle');
  var menuPanel = document.getElementById('menu-panel');

  function menuOuvert(ouvert) {
    if (!menuBtn || !menuPanel) { return; }
    menuPanel.hidden = !ouvert;
    menuBtn.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
  }

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menuOuvert(menuPanel.hidden);
    });
    // Un clic ailleurs referme le menu.
    document.addEventListener('click', function (e) {
      if (!menuPanel.hidden && !menuPanel.contains(e.target)) { menuOuvert(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { menuOuvert(false); }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Écouteurs                                                          */
  /* ------------------------------------------------------------------ */

  el.card.addEventListener('click', function () {
    /* Un glissement se termine parfois par un clic : on l'ignore, sinon la
       carte se retournerait juste après avoir été jugée. */
    if (geste.avaleClic) { return; }
    flip();
  });
  el.card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); flip(); }
  });

  /* Les boutons « Retourner » et les flèches ont été retirés de l'interface :
     un appui sur la carte la retourne, et on passe à la suivante en la jugeant
     (glissement, ou les deux boutons ci-dessous). Au clavier, ← → naviguent
     toujours — c'est invisible, donc ça ne charge pas l'écran. */
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

  /* L'adresse peut préciser ce qu'on révise : la page theme.html envoie
     index.html?theme=Nature ou index.html?review=1, et l'application ne
     garde que ces cartes. C'est ce qui remplace les filtres — sans rien
     ajouter à l'écran. */
  function parametres() {
    var p = {};
    window.location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) { return; }
      var i = kv.indexOf('=');
      var cle = i === -1 ? kv : kv.slice(0, i);
      var val = i === -1 ? '' : kv.slice(i + 1);
      try { p[decodeURIComponent(cle)] = decodeURIComponent(val); } catch (e) { /* on ignore */ }
    });
    return p;
  }

  function start(data) {
    state.cards = data.cards || [];
    var p = parametres();
    state.titre = p.theme || (p.review === '1' ? 'Cartes à revoir' : '');

    if (p.theme) {
      state.view = state.cards.filter(function (c) { return c.category === p.theme; });
    } else if (p.review === '1') {
      state.view = state.cards.filter(function (c) { return boxOf(c) < MASTERED; });
    } else {
      state.view = state.cards.slice();
    }

    el.deckName.textContent = (state.titre || data.deck || 'Jeu de cartes') +
      ' — ' + state.view.length + ' caractères';
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
