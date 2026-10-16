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
    theme: '',          // le thème en cours ('' si aucun), retenu pour la prochaine ouverture
    jour: null,         // le décompte du jour (consultées, je sais, à revoir)
    progress: {}       // { "好": { n: 2, ef: 2.5, i: 6, due: "2026-10-19", … } }
  };

  var el = {
    deckName: document.getElementById('deck-name'),
    card: document.getElementById('card'),
    front: document.getElementById('front-glyph'),
    back: document.getElementById('back'),
    bar: document.getElementById('bar-fill'),
    position: document.getElementById('position'),
    badge: document.getElementById('badge'),
    reset: document.getElementById('reset'),    sauvegarde: document.getElementById('sauvegarde'),
    aujourdhui: document.getElementById('aujourdhui'),
    compteSais: document.getElementById('compte-sais'),
    compteRevoir: document.getElementById('compte-revoir')
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
    /* « À revoir » remet la carte dans la file d'aujourd'hui : un échec doit
       revenir tout de suite, pas demain. C'est aussi ce qui fait monter le
       compteur du jour au lieu de le voir baisser. */
    f.due = connu ? dansNJours(f.i) : aujourdhui();
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

  /* La session : le niveau est retenu à part (« hanzi-niveau ») ; ici on garde
     le lot qu'on regardait (un thème, ou « à revoir aujourd'hui ») et la carte
     où l'on s'est arrêté. On la relit à l'ouverture pour reprendre exactement
     là où on en était, sans avoir à retrouver sa place. */
  var SESSION_KEY = 'hanzi-session';

  function lireSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY));
      return (s && typeof s === 'object') ? s : null;
    } catch (e) { return null; }
  }

  function retenirSession() {
    var c = current();
    if (!c) { return; }        /* vue vide : on ne mémorise pas de position */
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        niveau: window.__CARDS__ ? 'mono' : niveauDemande().cle,
        theme: state.theme || '',
        review: !!state.reviewMode,
        char: c.char
      }));
    } catch (e) { /* mode privé ou file:// : on repartira du début */ }
  }

  /* Le décompte du jour : ce qu'on a consulté et jugé depuis ce matin. Il est
     relu au chargement et remis à zéro tout seul quand la date change — c'est
     ce qui rend les compteurs vivants pendant qu'on révise. */
  var JOUR_KEY = 'hanzi-jour';

  function lireJour() {
    try {
      var j = JSON.parse(localStorage.getItem(JOUR_KEY));
      if (j && j.date === aujourdhui()) {
        return { date: j.date, sais: j.sais || 0, revoir: j.revoir || 0, vues: j.vues || {} };
      }
    } catch (e) { /* illisible : on repart de zéro */ }
    return { date: aujourdhui(), sais: 0, revoir: 0, vues: {} };
  }

  /* Un geste : « vue » (on a retourné le verso), « sais » ou « revoir ». */
  function compter(quoi, char) {
    if (!state.jour) { state.jour = lireJour(); }
    if (quoi === 'vue') { state.jour.vues[char] = true; }
    else if (quoi === 'sais') { state.jour.sais++; }
    else if (quoi === 'revoir') { state.jour.revoir++; }
    try { localStorage.setItem(JOUR_KEY, JSON.stringify(state.jour)); }
    catch (e) { /* mode privé : les compteurs restent en mémoire */ }
  }

  function nbVues() {
    return state.jour ? Object.keys(state.jour.vues).length : 0;
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
    state.jour = lireJour();
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

    /* L'ordre des traits : le carré 田字格 est caché par défaut, l'œil le
       révèle ; un appui sur le carré lance (ou relance) l'animation. Absent de
       la version « un seul fichier », qui n'embarque ni la bibliothèque ni les
       tracés. Les deux yeux sont dessinés en SVG : nets à toute taille, et ils
       prennent la couleur du thème par currentColor. */
    var traitsHTML = monoFichier ? '' :
      '<section class="traits-bloc">' +
        '<div class="traits" id="traits">' +
          '<button class="traits-oeil" id="traits-oeil" type="button" aria-pressed="false"' +
                  ' aria-label="Afficher l\'ordre des traits" title="Afficher l\'ordre des traits">' +
            '<svg class="oeil-ouvert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M2 12s3.7-6.2 10-6.2S22 12 22 12s-3.7 6.2-10 6.2S2 12 2 12z"/>' +
              '<circle cx="12" cy="12" r="2.7"/>' +
            '</svg>' +
            '<svg class="oeil-barre" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M2 12s3.7-6.2 10-6.2S22 12 22 12s-3.7 6.2-10 6.2S2 12 2 12z"/>' +
              '<circle cx="12" cy="12" r="2.7"/>' +
              '<line x1="4.5" y1="19.5" x2="19.5" y2="4.5"/>' +
            '</svg>' +
          '</button>' +
          '<div class="traits-box" id="traits-box" hidden>' +
            '<p class="traits-note">' +
              '<img class="traits-icon" src="icons/tap.webp" alt="" width="44" height="44">' +
            '</p>' +
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

    /* Une phrase d'exemple qui met le caractère en situation : drôle, ou
       chéngyǔ avec son explication. Champ optionnel — les fiches qui n'en ont
       pas (le HSK 2 pour l'instant) n'affichent simplement rien. */
    var phraseHTML = '';
    if (c.phrase && c.phrase.length >= 3) {
      phraseHTML = '<div class="phrase">' +
        '<p class="phrase-zh">' + esc(c.phrase[0]) + '</p>' +
        '<p class="phrase-py">' + esc(c.phrase[1]) + '</p>' +
        '<p class="phrase-fr">' + esc(c.phrase[2]) + '</p>' +
        (c.phraseNote ? '<p class="phrase-note">' + esc(c.phraseNote) + '</p>' : '') +
      '</div>';
    }

    return '' +
      '<div class="back-head">' +
        '<div class="pinyin tone-' + toneOf(c.pinyin) + '">' + esc(c.pinyin) + '</div>' +
        '<div class="meaning">' + sens + '</div>' +
      '</div>' +
      suivi +
      phraseHTML +
      compsHTML + wordsHTML + etymoHTML +
      (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '') +
      traitsHTML;
  }

  function render() {
    var c = current();

    /* Vue vide : plutôt qu'une carte morte qui ne répond pas au clic, on dit
       pourquoi — et on donne le chemin de sortie. */
    if (!c) {
      var raison = state.reviewMode
        ? 'Rien à revoir aujourd\'hui dans cette collection.'
        : (state.titre ? 'Ce lot est vide dans cette collection.' : 'Aucune carte chargée.');
      el.front.textContent = '—';
      /* Le lien de sortie n'a pas de sens dans la version « un seul fichier » :
         il n'y a pas d'autre page a ouvrir. */
      var sortie = monoFichier ? '' :
        '<br><br><a class="back-link" href="index.html">Voir toutes les cartes de la collection</a>';
      el.back.innerHTML = '<p class="meaning">' + esc(raison) + sortie + '</p>';
      if (el.position) { el.position.textContent = ''; }
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

    /* Quand plusieurs collections sont réunies, on dit d'où vient la fiche.
       Le niveau n'est pas répété s'il porte déjà le nom de la catégorie. */
    var ou = c.category || '';
    if (c.niveau && c.niveau !== ou) { ou = c.niveau + (ou ? ' · ' + ou : ''); }
    if (el.position) { el.position.textContent = 'Carte ' + (state.i + 1) + ' / ' + state.view.length + (ou ? ' · ' + ou : ''); }
    updateStats();

    /* Où l'on s'est arrêté : la prochaine ouverture reprendra ici. */
    retenirSession();
  }

  function updateStats() {
    var total = state.cards.length;
    var known = masteredCount();
    /* La pastille de l'onglet : le nombre de cartes à revoir, visible sans
       ouvrir la feuille. Elle disparaît quand il n'y a plus rien à revoir. */
    if (el.badge) {
      var dues = toReviewCount();
      el.badge.textContent = dues;
      el.badge.hidden = !dues;
    }
    el.bar.style.width = total ? Math.round(known / total * 100) + '%' : '0%';

    /* Le décompte du jour, en direct : consultées, « je sais », « à revoir ». */
    if (el.aujourdhui && state.jour) {
      var vues = nbVues();
      el.aujourdhui.textContent = 'Aujourd\'hui : ' + vues + ' carte' + (vues > 1 ? 's' : '') +
        ' consultée' + (vues > 1 ? 's' : '');
    }
    if (el.compteSais) { el.compteSais.textContent = state.jour ? state.jour.sais : 0; }
    if (el.compteRevoir) { el.compteRevoir.textContent = state.jour ? state.jour.revoir : 0; }
  }

  /* ------------------------------------------------------------------ */
  /*  Actions                                                            */
  /* ------------------------------------------------------------------ */

  function flip() {
    var c = current();
    if (!c) { return; }
    state.flipped = !state.flipped;
    el.card.classList.toggle('flipped', state.flipped);
    /* Retourner la carte, c'est la consulter : on le compte une fois par carte. */
    if (state.flipped) { compter('vue', c.char); }
    updateStats();
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
    compter(known ? 'sais' : 'revoir', c.char);
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

  /* Tout remettre a zero : la progression, le decompte du jour, et la
     position retenue. Deux appuis plutot qu'un dialogue natif : dans une
     application installee, `confirm` peut etre ignore et renvoyer false —
     le bouton semblait alors ne rien faire. Ici, le libelle change, donc on
     voit que le bouton repond. */
  function resetProgress() {
    if (!state.resetArme) {
      state.resetArme = true;
      if (el.reset) {
        if (!state.resetLibelle) { state.resetLibelle = el.reset.textContent; }
        el.reset.textContent = 'Confirmer';
        el.reset.classList.add('warn');
      }
      window.setTimeout(desarmerReset, 4000);
      return;
    }
    desarmerReset();
    state.progress = {};
    save();
    state.jour = { date: aujourdhui(), sais: 0, revoir: 0, vues: {} };
    try { localStorage.setItem(JOUR_KEY, JSON.stringify(state.jour)); }
    catch (e) { /* mode prive : la remise a zero reste en memoire */ }
    try { localStorage.removeItem(SESSION_KEY); }
    catch (e) { /* rien a effacer */ }
    state.view = state.cards.slice();
    state.i = 0;
    render();
    menuOuvert(false);   /* la feuille se referme, une fois tout efface */
  }

  /* Le bouton retrouve son libelle si on ne confirme pas. */
  function desarmerReset() {
    state.resetArme = false;
    if (el.reset) {
      if (state.resetLibelle) { el.reset.textContent = state.resetLibelle; }
      el.reset.classList.remove('warn');
    }
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
  /*  La barre du bas : les onglets et leur feuille                      */
  /* ------------------------------------------------------------------ */

  /* Chaque onglet ouvre une feuille posée juste au-dessus de la barre. Une
     seule à la fois : un appui sur l'onglet ouvert le referme. Le clic ailleurs
     et Échap ferment aussi — comme le faisait le menu précédent. */
  var onglets = document.querySelectorAll('[data-onglet]');
  var feuilles = document.querySelectorAll('[data-feuille]');

  function fermerFeuilles() {
    for (var i = 0; i < feuilles.length; i++) { feuilles[i].hidden = true; }
    for (var j = 0; j < onglets.length; j++) {
      onglets[j].setAttribute('aria-expanded', 'false');
      onglets[j].classList.remove('actif');   // le halo part avec la feuille
    }
  }

  /* Le nom est conservé pour le reste du code : les entrées de la feuille
     appellent menuOuvert(false) avant d'agir, pour qu'on voie le résultat. */
  function menuOuvert(ouvert) {
    if (!ouvert) { fermerFeuilles(); }
  }

  function ouvrirFeuille(cle) {
    var ouverte = false;
    for (var i = 0; i < feuilles.length; i++) {
      var f = feuilles[i];
      var meme = (f.getAttribute('data-feuille') === cle);
      var etaitOuverte = !f.hidden;
      f.hidden = !(meme && !etaitOuverte);   // un second appui referme
      if (!f.hidden) { ouverte = true; }
    }
    for (var j = 0; j < onglets.length; j++) {
      var o = onglets[j];
      var actif = ouverte && (o.getAttribute('data-onglet') === cle);
      o.setAttribute('aria-expanded', actif ? 'true' : 'false');
      o.classList.toggle('actif', actif);
    }
  }

  for (var k = 0; k < onglets.length; k++) {
    (function (bouton) {
      bouton.addEventListener('click', function (e) {
        e.stopPropagation();
        ouvrirFeuille(bouton.getAttribute('data-onglet'));
      });
    })(onglets[k]);
  }

  if (onglets.length) {
    // Un appui ailleurs, ou Échap, referme la feuille ouverte.
    document.addEventListener('click', function (e) {
      var dedans = false;
      for (var i = 0; i < feuilles.length; i++) {
        if (feuilles[i].contains(e.target)) { dedans = true; }
      }
      if (!dedans) { fermerFeuilles(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { fermerFeuilles(); }
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
    var fiches = Object.keys(state.progress).length;
    if (!fiches) {
      annoncerSauvegarde('Aucune progression à enregistrer pour l\'instant.');
      return;
    }
    var nom = 'cartes-progression-' + aujourdhui() + '.json';
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
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    /* Le lien reste dans la page jusqu'à la révocation : retiré juste après
       le clic, certains navigateurs annulent le téléchargement — et il ne
       se passe alors rien du tout. */
    window.setTimeout(function () {
      if (a.parentNode) { a.parentNode.removeChild(a); }
      URL.revokeObjectURL(url);
    }, 2000);
    annoncerSauvegarde('Enregistré : ' + nom + ' · ' + fiches + ' fiche' + (fiches > 1 ? 's' : ''));
  }

  /* Le retour visible : sans lui, un téléchargement discret laisse croire que
     le bouton ne fait rien. Le message s'efface tout seul. */
  function annoncerSauvegarde(message) {
    if (!el.sauvegarde) { return; }
    el.sauvegarde.textContent = message;
    if (state.sauvegardeMinuteur) { window.clearTimeout(state.sauvegardeMinuteur); }
    state.sauvegardeMinuteur = window.setTimeout(function () {
      if (el.sauvegarde) { el.sauvegarde.textContent = ''; }
    }, 8000);
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

  /* Le clic vient-il du carré 田字格 ?

     On interroge le CHEMIN de l'événement, pas les ancêtres actuels de la cible :
     au premier appui le contenu du carré est réécrit, donc la cible peut avoir
     été retirée du document entre-temps — et un élément détaché n'a plus
     d'ancêtres, si bien que target.closest('.traits') renverrait null et le clic
     remonterait retourner la carte. Le chemin, lui, est figé à l'émission. */
  function dansLesTraits(e) {
    if (e.composedPath) {
      var chemin = e.composedPath();
      for (var i = 0; i < chemin.length; i++) {
        var n = chemin[i];
        if (n && n.classList && n.classList.contains('traits')) { return true; }
      }
      return false;
    }
    return !!(e.target && e.target.closest && e.target.closest('.traits'));
  }

  /* Prépare le dessin de la carte affichée, puis joue l'animation. Un appui
     suivant relance l'animation déjà en place, sans tout reconstruire. */
  function animerTraits() {
    var boite = document.getElementById('traits-box');
    var c = current();
    if (!boite || !c) { return; }

    function message(texte) {
      // On remplace le texte du noeud existant : pas de noeud retiré en plein clic.
      var note = boite.querySelector('.traits-note');
      if (note) { note.textContent = texte; }
      else { boite.innerHTML = '<p class="traits-note">' + texte + '</p>'; }
    }

    function jouer() {
      var donnees = traces ? traces[c.char] : null;
      if (!donnees) {
        message('Pas de tracé pour ce caractère.');
        return;
      }
      if (writer && carteDessinee === c.char) { writer.animateCharacter(); return; }
      boite.innerHTML = '';
      writer = HanziWriter.create(boite, c.char, {
        width: 198, height: 198, padding: 8,
        showOutline: false,
        /* showCharacter vaut true par défaut : le caractère serait peint entier
           à la création, puis l'animation le remettrait à zéro pour le
           redessiner — d'où un clignotement au premier appui. */
        showCharacter: false,
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
      message('Tracés indisponibles : cette animation demande la version servie par un serveur.');
    }

    if (!biblioPrete || !traces) { message('⏳'); }
    chargerBibliotheque(function () { chargerTraces(jouer, echec); }, echec);
  }

  /* L'œil montre ou cache le carré 田字格. Le bouton porte l'état dans
     aria-pressed, et c'est le CSS qui choisit l'icône à afficher. */
  function basculerTraits() {
    var boite = document.getElementById('traits-box');
    var oeil = document.getElementById('traits-oeil');
    if (!boite || !oeil) { return; }
    if (boite.hasAttribute('hidden')) {
      boite.removeAttribute('hidden');
      oeil.setAttribute('aria-pressed', 'true');
      oeil.setAttribute('aria-label', 'Masquer l\'ordre des traits');
      oeil.setAttribute('title', 'Masquer l\'ordre des traits');
    } else {
      boite.setAttribute('hidden', '');
      oeil.setAttribute('aria-pressed', 'false');
      oeil.setAttribute('aria-label', 'Afficher l\'ordre des traits');
      oeil.setAttribute('title', 'Afficher l\'ordre des traits');
    }
  }

  /* Un seul écouteur, posé sur le verso : son contenu est réécrit à chaque
     carte, mais l'élément qui le contient ne change pas. L'œil bascule le
     carré, un appui dans le carré lance l'animation, et on arrête là la
     remontée du clic : le gestionnaire de la carte n'a rien à y faire. */
  if (!monoFichier) {
    el.back.addEventListener('click', function (e) {
      if (!dansLesTraits(e)) { return; }
      e.stopPropagation();
      if (e.target.closest && e.target.closest('.traits-oeil')) { basculerTraits(); return; }
      animerTraits();
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
    if (dansLesTraits(e)) { return; }
    flip();
  });
  el.card.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); flip(); }
  });

  /* Tout ce qui commande est désormais dans le menu : l'écran ne garde que la
     carte. Un appui sur la carte la retourne, un glissement la juge. Chaque
     entrée du menu referme celui-ci avant d'agir — sinon on ne verrait pas le
     résultat. Au clavier, ← → naviguent et 1 / 2 jugent, sans rien afficher. */
  function depuisLeMenu(id, action, garderOuvert) {
    /* Un element absent ne doit pas faire tomber l'application entiere :
       les boutons vont et viennent (on juge desormais au glissement), et
       une liaison orpheline suffisait a empecher le demarrage. */
    var bouton = document.getElementById(id);
    if (!bouton) { return; }
    bouton.addEventListener('click', function () {
      if (!garderOuvert) { menuOuvert(false); }
      action();
    });
  }

  depuisLeMenu('shuffle', shuffle);
  depuisLeMenu('reset', resetProgress, true);

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

    /* La session ne sert que si l'adresse ne dit rien : un lien qui précise un
       niveau, un thème ou un caractère commande. Et elle ne vaut que pour le
       niveau d'où elle vient — sinon on se placerait sur une carte absente. */
    var niveauCle = window.__CARDS__ ? 'mono' : niveauDemande().cle;
    var brut = (!p.theme && p.review !== '1' && !p.char) ? lireSession() : null;
    var reprise = (brut && brut.niveau === niveauCle) ? brut : null;

    /* Ce qu'on regarde : le thème de l'adresse, sinon celui de la session. */
    var theme = p.theme || (reprise && reprise.theme) || '';
    var vue = theme ? state.cards.filter(function (c) { return c.category === theme; }) : null;
    if (vue && !vue.length) { theme = ''; vue = null; }   /* thème vide : on ouvre tout */

    /* « À revoir aujourd'hui », demandé par l'adresse ou repris de la session. */
    var revision = (p.review === '1') || (!theme && !!(reprise && reprise.review));
    if (!vue && revision) {
      vue = state.cards.filter(estDue);
      /* Rien de dû : plutôt qu'un écran vide, on ouvre le paquet — sauf si
         l'adresse demandait explicitement la révision. */
      if (!vue.length && p.review !== '1') { revision = false; vue = null; }
    }
    if (!vue) { vue = state.cards.slice(); }

    state.theme = theme;
    state.reviewMode = revision;
    state.titre = theme || (revision ? 'À revoir aujourd\'hui' : '');
    state.view = vue;

    /* ?char=好 : la recherche de la page Thèmes renvoie ici sur un caractère
       précis. On garde tout le paquet et on se place simplement dessus, pour
       pouvoir continuer la révision à partir de là. */
    var cible = p.char || (reprise && reprise.char);
    if (cible) {
      for (var k = 0; k < state.view.length; k++) {
        if (state.view[k].char === cible) { state.i = k; break; }
      }
    }

    /* Le niveau remplace le nom générique du paquet : « HSK 2 — 125 caractères »
       est plus utile que « Hanzi — caractères chinois ». */
    var quoi = state.titre || data.niveau || data.deck || 'Jeu de cartes';
    if (el.deckName) { el.deckName.textContent = quoi + ' — ' + state.view.length + ' caractères'; }
    render();
  }

  /* Échec de chargement : on dit quoi faire, pas seulement que ça a échoué. Le
     cas le plus courant est une ancienne version gardée en cache, qui réclame un
     fichier renommé depuis (data/cards.json devenu data/cards-hsk1.json). */
  function fail(err) {
    if (el.deckName) { el.deckName.textContent = 'Erreur'; }
    /* On retourne la carte pour montrer le message : sans ça il restait caché
       derrière un recto qui ne répond pas au clic (il n'y a pas de carte). */
    el.front.textContent = '—';
    state.flipped = true;
    el.card.classList.add('flipped');
    el.back.innerHTML = '<p class="meaning">Impossible de charger les cartes : ' + esc(err.message) +
      '<br><br>Si l\'application marchait avant, <strong>recharge la page</strong> (Ctrl+Shift+R, ' +
      'ou « vider le cache ») : le navigateur garde parfois l\'ancienne version.' +
      '<br><br>Sinon, lance le site via un serveur local (serve.cmd ou Ctrl+Shift+B dans VS Code) : ' +
      'un fichier ouvert en file:// ne peut pas lire le JSON voisin.</p>';
  }

  load();

  /* ------------------------------------------------------------------ */
  /*  Les niveaux                                                        */
  /* ------------------------------------------------------------------ */

  /* Un fichier par niveau, chargé à la demande : on ne télécharge que celui
     qu'on révise. La progression, elle, reste commune — elle est indexée par
     caractère, et un caractère ne change pas de niveau. */
  /* Chaque niveau est une collection : un fichier, chargé à la demande, avec son
     nom. « Tous les niveaux » les réunit — c'est le même code, avec plusieurs
     fichiers à la fois. */
  /* Doit suivre la version du service worker (CACHE ci-dessous) : c'est ce qui
     permet de savoir quelle version le navigateur sert vraiment. */
  var VERSION = '97';

  var NIVEAUX = [
    { cle: 'hsk1', nom: 'HSK 1', fichiers: ['data/cards-hsk1.json'] },
    { cle: 'hsk2', nom: 'HSK 2', fichiers: ['data/cards-hsk2.json'] },
    { cle: 'hsk3', nom: 'HSK 3', fichiers: ['data/cards-hsk3.json'] },
    { cle: 'tout', nom: 'Tous les niveaux', fichiers: ['data/cards-hsk1.json', 'data/cards-hsk2.json', 'data/cards-hsk3.json'] }
  ];

  /* Le niveau demandé : ?niveau=hsk2 dans l'adresse, sinon celui de la dernière
     visite, sinon le premier. Le nom inconnu retombe sur le premier. */
  function niveauDemande() {
    var demande = parametres().niveau;
    if (!demande) {
      try { demande = localStorage.getItem('hanzi-niveau'); } catch (e) { demande = null; }
    }
    for (var i = 0; i < NIVEAUX.length; i++) {
      if (NIVEAUX[i].cle === demande) { return NIVEAUX[i]; }
    }
    return NIVEAUX[0];
  }

  /* Le menu indique le niveau en cours d'un petit trait doré et d'un ✓. */
  /* La version, affichée dans Réglages : elle dit ce que le navigateur a vraiment chargé. */
  function afficherVersion() {
    var v = document.getElementById('version');
    if (v) { v.textContent = VERSION; }
  }

  function marquerNiveau(cle) {
    var liens = document.querySelectorAll('[data-niveau]');
    for (var i = 0; i < liens.length; i++) {
      var actif = (liens[i].getAttribute('data-niveau') === cle);
      liens[i].classList.toggle('actif', actif);
      if (actif) { liens[i].setAttribute('aria-current', 'true'); }
      else { liens[i].removeAttribute('aria-current'); }
    }
  }

  /* Trois modes de chargement :
     - fichier unique (cartes-mobile.html) : les données sont déjà dans la page,
       via window.__CARDS__ — aucun réseau, ça marche hors ligne, et il n'y a
       qu'un seul niveau ;
     - site normal : on va chercher le fichier du niveau choisi ;
     - échec : on le dit, plutôt que de laisser un écran blanc. */
  /* Charge une collection : un ou plusieurs fichiers, fusionnés. Chaque fiche
     retient le nom de son niveau — c'est ce qui permet de l'afficher et de
     compter niveau par niveau. Un caractère déjà chargé n'est pas repris deux
     fois (les listes HSK ne se recoupent pas, mais autant s'en assurer). */
  function chargerCollection(choix) {
    return Promise.all(choix.fichiers.map(function (f) {
      return fetch(f, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) { throw new Error('fichier de cartes introuvable (' + r.status + ')'); }
        return r.json();
      });
    })).then(function (paquets) {
      var cartes = [];
      var vus = {};
      paquets.forEach(function (paquet) {
        var nom = paquet.niveau || choix.nom;
        (paquet.cards || []).forEach(function (c) {
          if (vus[c.char]) { return; }
          vus[c.char] = true;
          c.niveau = nom;
          cartes.push(c);
        });
      });
      return { cards: cartes, deck: choix.nom, niveau: choix.nom };
    });
  }

  afficherVersion();

  if (window.__CARDS__) {
    marquerNiveau(NIVEAUX[0].cle);
    start(window.__CARDS__);
  } else {
    var choisi = niveauDemande();
    try { localStorage.setItem('hanzi-niveau', choisi.cle); } catch (e) { /* navigation privée */ }
    marquerNiveau(choisi.cle);
    chargerCollection(choisi)
      .then(function (data) { start(data); })
      .catch(fail);
  }

  /* Installation sur le téléphone : le service worker met le site en cache pour
     qu'il fonctionne hors ligne. Il n'est disponible que sur une origine
     sécurisée (https, ou localhost) — sur http:// vers l'IP du réseau local le
     navigateur le refuse, et `serviceWorker` est simplement absent. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
        .then(function (enregistrement) {
          /* On redemande tout de suite s'il existe une version plus récente.
             updateViaCache: 'none' empêche le navigateur de servir le script du
             worker depuis son cache HTTP : sans ça, un téléphone peut garder
             l'ancienne version pendant des jours. */
          if (enregistrement) { enregistrement.update(); }
        })
        .catch(function () { /* silencieux */ });
    });
  }

})();
