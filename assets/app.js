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
  /* Le rythme des révisions est décrit plus bas, avec la mécanique SM-2. */

  var state = {
    cards: [],
    view: [],          // cartes affichées, dans l'ordre courant
    i: 0,              // index dans view
    flipped: false,
    titre: '',         // thème en cours, quand il vient de l'adresse
    reviewMode: false, // vue « à revoir aujourd'hui » (?review=1)
    progress: {}       // { "好": { n: 2, ef: 2.5, i: 6, due: "2026-10-19", … } }
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

  /* ------------------------------------------------------------------ */
  /*  Répétition espacée (SM-2)                                          */
  /* ------------------------------------------------------------------ */

  /* Chaque fiche garde :
       n     réussites d'affilée
       ef    facteur de facilité (2,5 au départ, borné entre 1,3 et 2,8)
       i     intervalle courant, en jours
       due   date de la prochaine révision (AAAA-MM-JJ)
       seen  nombre total de révisions
       at    date de la dernière révision

     Réussie : les intervalles suivent 1 jour, 6 jours, puis i × ef — c'est la
     formule de SuperMemo 2. Manquée : retour à un jour, et la facilité baisse,
     donc tous les intervalles suivants raccourcissent. */
  var JOUR = 86400000;
  var EF_DEPART = 2.5, EF_MIN = 1.3, EF_MAX = 2.8;
  var MAITRISE = 21;   // au-delà de trois semaines d'intervalle, la carte est sue

  function aujourdhui() {
    return new Date().toISOString().slice(0, 10);
  }

  function dansNJours(n) {
    return new Date(Date.now() + n * JOUR).toISOString().slice(0, 10);
  }

  function fiche(char) {
    if (!state.progress[char]) {
      state.progress[char] = { n: 0, ef: EF_DEPART, i: 0, due: aujourdhui(), seen: 0, at: '' };
    }
    return state.progress[char];
  }

  function estDue(card) {
    return fiche(card.char).due <= aujourdhui();
  }

  function estMaitrisee(card) {
    return fiche(card.char).i >= MAITRISE;
  }

  /* Révision : « Je sais » compte comme une qualité 5, « À revoir » comme 2. */
  function reviser(card, connu) {
    var f = fiche(card.char);
    if (connu) {
      f.n = f.n + 1;
      if (f.n === 1) { f.i = 1; }
      else if (f.n === 2) { f.i = 6; }
      else { f.i = Math.round(Math.max(f.i, 6) * f.ef); }
      f.ef = Math.min(EF_MAX, f.ef + 0.1);
    } else {
      f.n = 0;
      f.i = 1;
      f.ef = Math.max(EF_MIN, f.ef - 0.32);
    }
    f.due = dansNJours(f.i);
    f.seen = f.seen + 1;
    f.at = aujourdhui();
    save();
    return f;
  }

  /* La progression est enregistrée dans le navigateur. Deux cas où ça échoue :
     navigation privée, et fichier ouvert en file:// (Chrome l'interdit). Dans ce
     cas on continue simplement en mémoire : l'app reste utilisable, la
     progression est perdue à la fermeture. */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.progress)); }
    catch (e) { /* on ignore : mode privé ou file:// */ }
  }

  /* Les anciennes fiches portaient un simple compteur « box ». On les traduit
     une fois pour toutes au chargement : 0/1 → à revoir, 2 → 1 jour, 3 → 6 jours. */
  function migrerProgression() {
    var change = false;
    Object.keys(state.progress).forEach(function (ch) {
      var p = state.progress[ch];
      if (p && p.ef === undefined) {
        var n = p.box >= 3 ? 2 : (p.box >= 2 ? 1 : 0);
        state.progress[ch] = {
          n: n,
          ef: EF_DEPART,
          i: n === 2 ? 6 : (n === 1 ? 1 : 0),
          due: n === 2 ? dansNJours(6) : aujourdhui(),
          seen: p.seen || 0,
          at: p.at || ''
        };
        change = true;
      }
    });
    if (change) { save(); }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { state.progress = JSON.parse(raw) || {}; }
    } catch (e) { state.progress = {}; }
    migrerProgression();
  }

  function masteredCount() {
    return state.cards.filter(estMaitrisee).length;
  }

  /* Ce qui est « à revoir » : ce qui est dû aujourd'hui ou en retard. */
  function toReviewCount() {
    return state.cards.filter(estDue).length;
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

    /* Aucun anglais à l'écran, jamais : si la traduction française manque
       encore, on l'annonce discrètement. L'anglais reste dans les données
       (champ meaningEn) : il sert de base à la traduction, rien de plus. */
    var sens = c.meaning
      ? esc(c.meaning)
      : '<span class="manquant">sens à compléter</span>';

    var etymoHTML = (c.etymology && c.etymology.length)
      ? '<section><h3>Étymologie</h3>' +
          '<p class="etype">' + esc(c.etymology[0]) + '</p>' +
          (c.etymology[1] ? '<p class="etext">' + esc(c.etymology[1]) + '</p>' : '') +
        '</section>'
      : '';

    /* L'ordre des traits : le carré 田字格 est visible directement, et un appui
       dessus lance (ou relance) l'animation. Absent de la version « un seul
       fichier », qui n'embarque ni la bibliothèque ni les tracés. */
    var traitsHTML = monoFichier ? '' :
      '<section class="traits-bloc">' +
        '<div class="traits" id="traits">' +
          '<div class="traits-box" id="traits-box">' +
            '<p class="traits-note">appuie ici pour voir l\'ordre des traits</p>' +
          '</div>' +
        '</div>' +
      '</section>';

    /* Où en est cette fiche : combien de fois revue, et quand elle revient.
       On lit la progression sans la créer (state.progress, pas fiche()). */
    var suivi = '';
    var p = state.progress[c.char];
    if (p && p.seen) {
      var quand = (p.due && p.due <= aujourdhui())
        ? 'à revoir maintenant'
        : ('prochaine révision dans ' + p.i + ' jour' + (p.i > 1 ? 's' : ''));
      suivi = '<p class="suivi">Revue ' + p.seen + ' fois · ' + esc(quand) +
        (p.i >= MAITRISE ? ' · <span class="ok">maîtrisée</span>' : '') + '</p>';
    }

    return '' +
      '<div class="back-head">' +
        '<div class="pinyin tone-' + toneOf(c.pinyin) + '">' + esc(c.pinyin) + '</div>' +
        '<div class="meaning">' + sens + '</div>' +
      '</div>' +
      suivi +
      compsHTML + wordsHTML + etymoHTML + traitsHTML +
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
    writer = null;          // le dessin précédent disparaît avec le contenu réécrit
    carteDessinee = '';
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
    var avant = estDue(c);
    var f = reviser(c, known);

    /* En mode « à revoir », une carte qui vient d'être réussie ne sera plus due
       avant un moment : elle quitte la file, plutôt que de revenir tout de suite. */
    if (state.reviewMode && avant && !estDue(c)) {
      state.view.splice(state.i, 1);
      if (state.i >= state.view.length) { state.i = 0; }
      updateStats();
      render();
      return;
    }

    updateStats();
    go(1);
    return f;
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
  /*  Mode clair / sombre (阴 / 阳)                                       */
  /* ------------------------------------------------------------------ */

  var THEME_KEY = 'hanzi-theme';
  var themeBtn = document.getElementById('theme-toggle');
  var themeLabel = document.getElementById('theme-label');

  function themeActuel() {
    try { return localStorage.getItem(THEME_KEY) === 'clair' ? 'clair' : 'sombre'; }
    catch (e) { return 'sombre'; }
  }

  function appliquerTheme(nom) {
    var racine = document.documentElement;
    if (nom === 'clair') { racine.setAttribute('data-theme', 'clair'); }
    else { racine.removeAttribute('data-theme'); }

    try { localStorage.setItem(THEME_KEY, nom); } catch (e) { /* on ignore */ }

    if (themeBtn) { themeBtn.setAttribute('aria-checked', nom === 'clair' ? 'true' : 'false'); }
    if (themeLabel) { themeLabel.textContent = nom === 'clair' ? 'Mode clair' : 'Mode sombre'; }

    // La barre système du téléphone suit le thème choisi.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute('content', nom === 'clair' ? '#f3ecda' : '#0e1114'); }
  }

  if (themeBtn) {
    appliquerTheme(themeActuel());   // le script du <head> l'a déjà posé : on synchronise l'interrupteur
    themeBtn.addEventListener('click', function () {
      appliquerTheme(themeActuel() === 'clair' ? 'sombre' : 'clair');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Sauvegarde de la progression                                       */
  /* ------------------------------------------------------------------ */

  /* La progression ne vit que dans ce navigateur. L'export produit un fichier
     JSON lisible, l'import le relit : utile pour changer de téléphone, ou
     avant de vider les données du site. */
  function exporterProgression() {
    var paquet = {
      app: 'hanzi-cards',
      version: 2,
      exporteLe: aujourdhui(),
      fiches: state.cards.length,
      progression: state.progress
    };
    var blob = new Blob([JSON.stringify(paquet, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'cartes-progression-' + aujourdhui() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* Accepte un export complet (objet avec « progression ») ou une simple table
     de progression : un fichier bricolé à la main reste utilisable. */
  function progressionDe(paquet) {
    if (!paquet || typeof paquet !== 'object' || Array.isArray(paquet)) { return null; }
    var prog = paquet.progression || paquet;
    if (!prog || typeof prog !== 'object' || Array.isArray(prog)) { return null; }
    var res = {};
    var n = 0;
    Object.keys(prog).forEach(function (k) {
      if (prog[k] && typeof prog[k] === 'object') { res[k] = prog[k]; n++; }
    });
    return n ? res : null;
  }

  function restaurerProgression(fichier) {
    var lecteur = new FileReader();
    lecteur.onload = function () {
      var paquet = null;
      try { paquet = JSON.parse(lecteur.result); } catch (e) { paquet = null; }
      var prog = progressionDe(paquet);
      if (!prog) {
        alert('Ce fichier ne contient pas de progression lisible.');
        return;
      }
      var n = Object.keys(prog).length;
      if (!confirm('Remplacer ta progression actuelle par celle de ce fichier (' + n + ' fiches) ?')) { return; }
      state.progress = prog;
      migrerProgression();   // au cas où la sauvegarde vient d'une ancienne version
      save();
      render();
      updateStats();
      alert('Progression restaurée : ' + n + ' fiches.');
    };
    lecteur.readAsText(fichier);
  }

  var btnExport = document.getElementById('export');
  var btnImport = document.getElementById('import');
  var champImport = document.getElementById('import-file');

  if (btnExport) {
    btnExport.addEventListener('click', function () {
      menuOuvert(false);
      exporterProgression();
    });
  }
  if (btnImport && champImport) {
    btnImport.addEventListener('click', function () {
      menuOuvert(false);
      champImport.click();
    });
    champImport.addEventListener('change', function () {
      if (champImport.files && champImport.files[0]) { restaurerProgression(champImport.files[0]); }
      champImport.value = '';   // pour pouvoir rechoisir le même fichier
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Ordre des traits (hanzi-writer)                                    */
  /* ------------------------------------------------------------------ */

  /* Tout arrive à la demande : la bibliothèque (36 Ko) et les tracés (494 Ko)
     ne sont téléchargés que si on demande l'animation. La version « un seul
     fichier » ne les embarque pas — d'où monoFichier. */
  var monoFichier = !!window.__CARDS__;
  var biblioPrete = false;
  var traces = null;
  var writer = null;
  var carteDessinee = '';   // le caractère actuellement dessiné dans le carré

  function chargerBibliotheque(fait, rate) {
    if (biblioPrete) { fait(); return; }
    var s = document.createElement('script');
    s.src = 'assets/hanzi-writer.min.js';
    s.onload = function () { biblioPrete = true; fait(); };
    s.onerror = rate;
    document.head.appendChild(s);
  }

  function chargerTraces(fait, rate) {
    if (traces) { fait(); return; }
    fetch('data/strokes.json')
      .then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.json(); })
      .then(function (d) { traces = d; fait(); })
      .catch(rate);
  }

  function couleurCSS(nom, secours) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nom);
    return (v && v.trim()) || secours;
  }

  /* Prépare le dessin de la carte affichée, puis joue l'animation. Un appui
     suivant relance l'animation déjà en place, sans tout reconstruire. */
  function animerTraits() {
    var boite = document.getElementById('traits-box');
    var c = current();
    if (!boite || !c) { return; }

    function jouer() {
      var donnees = traces ? traces[c.char] : null;
      if (!donnees) {
        boite.innerHTML = '<p class="traits-note">Pas de tracé pour ce caractère.</p>';
        return;
      }
      if (writer && carteDessinee === c.char) { writer.animateCharacter(); return; }
      boite.innerHTML = '';
      writer = HanziWriter.create(boite, c.char, {
        width: 198, height: 198, padding: 8,
        showOutline: false,
        strokeColor: couleurCSS('--accent', '#d8b26a'),
        drawingColor: couleurCSS('--txt', '#ffffff'),
        highlightColor: couleurCSS('--ok', '#3ecf8e'),
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200,
        charDataLoader: function (car, onComplete) { onComplete(donnees); }
      });
      carteDessinee = c.char;
      writer.animateCharacter();
    }

    function echec() {
      boite.innerHTML = '<p class="traits-note">Tracés indisponibles : cette animation demande la version servie par un serveur.</p>';
    }

    if (!biblioPrete || !traces) {
      boite.innerHTML = '<p class="traits-note">chargement…</p>';
    }
    chargerBibliotheque(function () { chargerTraces(jouer, echec); }, echec);
  }

  /* Un seul écouteur, posé sur le verso : son contenu est réécrit à chaque
     carte, mais l'élément qui le contient ne change pas. Un appui dans le carré
     田字格 — et nulle part ailleurs — lance l'animation. */
  if (!monoFichier) {
    el.back.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.traits')) { animerTraits(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Écouteurs                                                          */
  /* ------------------------------------------------------------------ */

  el.card.addEventListener('click', function (e) {
    /* Un glissement se termine parfois par un clic : on l'ignore, sinon la
       carte se retournerait juste après avoir été jugée. */
    if (geste.avaleClic) { return; }
    /* Le carré 田字格 est DANS la carte : sans ce filtre, l'appui qui lance
       l'animation remonterait jusqu'ici et retournerait la carte. */
    if (e.target.closest && e.target.closest('.traits')) { return; }
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
    state.reviewMode = (p.review === '1');
    state.titre = p.theme || (state.reviewMode ? 'À revoir aujourd\'hui' : '');

    if (p.theme) {
      state.view = state.cards.filter(function (c) { return c.category === p.theme; });
    } else if (state.reviewMode) {
      state.view = state.cards.filter(estDue);
    } else {
      state.view = state.cards.slice();
    }

    /* ?char=好 : la recherche de la page Thèmes renvoie ici sur un caractère
       précis. On garde tout le paquet et on se place simplement dessus, pour
       pouvoir continuer la révision à partir de là. */
    if (p.char) {
      for (var k = 0; k < state.view.length; k++) {
        if (state.view[k].char === p.char) { state.i = k; break; }
      }
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
