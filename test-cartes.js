/* test-cartes.js — fait tourner assets/app.js dans Node avec un faux DOM.
 *
 * Pourquoi : la progression, la reprise de session et les compteurs du jour
 * sont du code qui ne se voit qu'a l'usage. Plutot que d'esperer, on simule.
 *
 * Deux phases :
 *   1. on charge l'application avec trois fiches, on retourne une carte, on
 *      clique « Je sais » puis « A revoir », et on lit ce qui s'affiche ;
 *   2. on RELANCE l'application avec la MEME memoire (comme si on fermait et
 *      rouvrait) : la progression, la position et le decompte du jour doivent
 *      revenir tout seuls. C'est le controle de la sauvegarde automatique.
 *
 * Ce que ca ne remplace pas : un vrai navigateur (mise en page, gestes).
 * Ce que ca attrape : une faute de frappe dans un identifiant, une fonction
 * qui plante, un compteur fige, une progression qui ne revient pas.
 *
 * Usage : node test-cartes.js        (depuis le dossier du projet)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = __dirname;
const APP = fs.readFileSync(path.join(REPO, 'assets', 'app.js'), 'utf8');

const FICHES = [
  { char: '好', pinyin: 'hǎo', meaning: 'bon, bien', category: 'HSK 1', components: [], words: [], phrase: ['你好！', 'Nǐ hǎo !', 'Bonjour !'] },
  { char: '水', pinyin: 'shuǐ', meaning: 'eau', category: 'HSK 1', components: [], words: [] },
  { char: '山', pinyin: 'shān', meaning: 'montagne', category: 'HSK 1', components: [], words: [] }
];

/* ------------------------------------------------------------------ */
/*  Un DOM de pacotille, sur une memoire qu'on garde d'un lancement    */
/*  a l'autre                                                         */
/* ------------------------------------------------------------------ */

function element(id) {
  return {
    id: id, textContent: '', innerHTML: '', hidden: false, value: '', files: [],
    scrollTop: 0, style: {}, dataset: {}, enfants: [], _ecoutes: {},
    classList: {
      _s: new Set(),
      add: function (c) { this._s.add(c); },
      remove: function (c) { this._s.delete(c); },
      toggle: function (c, on) {
        if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (on) { this._s.add(c); } else { this._s.delete(c); }
      },
      contains: function (c) { return this._s.has(c); }
    },
    addEventListener: function (type, fn) { (this._ecoutes[type] = this._ecoutes[type] || []).push(fn); },
    removeEventListener: function () {},
    setAttribute: function () {}, removeAttribute: function () {},
    getAttribute: function (nom) {
      // Le harnais nomme ses faux elements « onglet-reviser », « feuille-niveau » :
      // on en deduit l'attribut que le code interroge.
      if (nom === 'data-onglet' && id.indexOf('onglet-') === 0) { return id.slice(7); }
      if (nom === 'data-feuille' && id.indexOf('feuille-') === 0) { return id.slice(8); }
      return null;
    },
    appendChild: function (x) { this.enfants.push(x); return x; },
    removeChild: function () {}, remove: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    contains: function () { return false; },
    closest: function () { return null; },
    focus: function () {}, dispatchEvent: function () {}, click: function () {},
    matches: function () { return false; }
  };
}

/** Un lancement complet de l'application, sur une memoire donnee. */
function lancer(memoire, recherche) {
  const elements = new Map();
  const parId = function (id) {
    if (!elements.has(id)) { elements.set(id, element(id)); }
    return elements.get(id);
  };
  const ecoutesDocument = {};

  const localStorage = {
    getItem: function (k) { return memoire.has(k) ? memoire.get(k) : null; },
    setItem: function (k, v) { memoire.set(k, String(v)); },
    removeItem: function (k) { memoire.delete(k); }
  };

  /* Les feuilles et les onglets, avec la feuille « Progression » ouverte :
     c'est l'etat au moment ou l'on appuie sur Reinitialiser. */
  const feuilles = [element('feuille-reviser'), element('feuille-progression')];
  feuilles[1].hidden = false;
  const onglets = [element('onglet-reviser'), element('onglet-progression'), element('onglet-accueil')];

  const document = {
    getElementById: parId,
    querySelector: function () { return null; },
    querySelectorAll: function (sel) {
      if (sel.indexOf('data-feuille') >= 0) { return feuilles; }
      if (sel.indexOf('onglet') >= 0) { return onglets; }
      return [];
    },
    createElement: function () { return element('cree'); },
    addEventListener: function (type, fn) { (ecoutesDocument[type] = ecoutesDocument[type] || []).push(fn); },
    removeEventListener: function () {},
    body: parId('body'), documentElement: parId('html'), activeElement: null
  };

  const window = {
    __CARDS__: { niveau: 'HSK 1', cards: FICHES.map(function (c) { return Object.assign({}, c); }) },
    location: { search: recherche || '', href: 'file:///cartes-mobile.html' },
    localStorage: localStorage,
    addEventListener: function () {},
    removeEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    requestAnimationFrame: function (f) { return setTimeout(f, 0); },
    console: console, navigator: { userAgent: 'node' }
  };

  /* Ce que le navigateur fournit pour telecharger : le faux DOM ne l'avait
     pas, donc le chemin de l'export n'etait jamais teste. */
  function Blob(parties, options) { this.parties = parties; this.type = (options || {}).type; }
  const URLfaux = {
    createObjectURL: function () { return 'blob:test'; },
    revokeObjectURL: function () {}
  };

  const sandbox = {
    window: window, document: document, localStorage: localStorage,
    navigator: window.navigator, console: console, location: window.location,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    requestAnimationFrame: window.requestAnimationFrame,
    Blob: Blob, URL: URLfaux,
    JSON: JSON, Date: Date, Math: Math, Object: Object, Array: Array, String: String,
    Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, Promise: Promise,
    confirm: function () { return true; }, alert: function () {}
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  /* La section Accueil porte l'attribut hidden dans le HTML : le faux element
     doit naitre dans le meme etat, sinon l'application la croit deja ouverte et
     la referme au demarrage (c'est ce que la phase 5 a revele). */
  parId('accueil').hidden = true;

  vm.runInNewContext(APP, sandbox, { filename: 'app.js' });

  return {
    lire: function (id) { var e = elements.get(id); return (e && e.textContent != null) ? String(e.textContent) : ''; },
    aElement: function (id) { return elements.has(id); },
    feuilles: feuilles,
    onglets: onglets,
    accueil: parId('accueil'),
    revoir: parId('revoir'),
    clicOnglet: function (cle) {
      onglets.forEach(function (o) {
        if (o.getAttribute('data-onglet') === cle) {
          (o._ecoutes.click || []).forEach(function (f) { f({ stopPropagation: function () {} }); });
        }
      });
    },
    element: function (id) { return elements.get(id); },
    lireHTML: function (id) {
      var e = elements.get(id);
      return (e && e.innerHTML) ? String(e.innerHTML) : '';
    },
    clicEvt: function (id) {
      var ev = { defaultPrevented: false, preventDefault: function () { this.defaultPrevented = true; } };
      var e = elements.get(id);
      if (e && e._ecoutes && e._ecoutes.click) {
        e._ecoutes.click.forEach(function (f) { f(ev); });
      }
      return ev;
    },
    clic: function (id) {
      var e = elements.get(id);
      if (!e || !e._ecoutes || !e._ecoutes.click) { return 0; }
      e._ecoutes.click.forEach(function (f) { f({ preventDefault: function () {} }); });
      return e._ecoutes.click.length;
    },
    clavier: function (touche) { (ecoutesDocument['keydown'] || []).forEach(function (f) { f({ key: touche, preventDefault: function () {}, target: {} }); }); }
  };
}

function jour(memoire) {
  const raw = memoire.get('hanzi-jour');
  return raw ? JSON.parse(raw) : null;
}

/* ------------------------------------------------------------------ */
/*  Phase 1 : on révise                                               */
/* ------------------------------------------------------------------ */

function escResume(s) { return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); }

const memoire = new Map();

console.log('=== 1) premier lancement (3 fiches en mémoire) ===');
let app = lancer(memoire);
const depart = { position: app.lire('position'), pastille: app.lire('badge'), aujourdhui: app.lire('aujourdhui') };
console.log('  position    : ' + JSON.stringify(depart.position));
console.log('  à revoir (pastille) : ' + JSON.stringify(depart.pastille));
console.log('  aujourdhui  : ' + JSON.stringify(depart.aujourdhui));

app.clavier(' ');      // on retourne la carte : une consultation
app.clavier('2');      // « Je sais » : la touche 2, comme le glissement a droite
app.clavier('1');      // « À revoir » : la touche 1, comme le glissement a gauche

console.log('');
console.log('=== retourné une carte, « Je sais », puis « À revoir » (2 fiches restent à revoir) ===');
console.log('  position    : ' + JSON.stringify(app.lire('position')));
console.log('  à revoir (pastille) : ' + JSON.stringify(app.lire('badge')));
console.log('  aujourdhui  : ' + JSON.stringify(app.lire('aujourdhui')));
console.log('  mémoire     : ' + Array.from(memoire.keys()).join(', '));

/* ------------------------------------------------------------------ */
/*  Phase 2 : on ferme et on rouvre                                   */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 2) on ferme et on rouvre (même mémoire, aucun fichier) ===');
app = lancer(memoire);
const position = app.lire('position');
const compteurs = app.lire('badge');
const aujourdhui = app.lire('aujourdhui');
const j2 = jour(memoire) || {};   // figé avant la réinitialisation de la phase 3
console.log('  position    : ' + JSON.stringify(position));
console.log('  à revoir (pastille) : ' + JSON.stringify(compteurs));
console.log('  aujourdhui  : ' + JSON.stringify(aujourdhui));

/* ------------------------------------------------------------------ */
/*  Phase 3 : on réinitialise                                         */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 3) on appuie sur « Réinitialiser » (deux fois) ===');
const n1 = app.clic('reset');
console.log('  premier appui (' + n1 + ' écouteur) : le bouton dit ' + JSON.stringify(app.lire('reset')));
const libelle = app.lire('reset');
const n2 = app.clic('reset');
console.log('  second appui (' + n2 + ' écouteur)');
const apresCompteurs = app.lire('badge');
const apresAujourdhui = app.lire('aujourdhui');
const jApres = jour(memoire) || {};
console.log('  à revoir (pastille) : ' + JSON.stringify(apresCompteurs));
console.log('  aujourdhui  : ' + JSON.stringify(apresAujourdhui));

/* ------------------------------------------------------------------ */
/*  Phase 4 : on sauvegarde                                           */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 4) on appuie sur « Sauvegarder » ===');
app.clic('export');
const message = app.lire('sauvegarde');
console.log('  message affiché : ' + JSON.stringify(message));



/* ------------------------------------------------------------------ */
/*  Phase 5 : Accueil est une page, pas une feuille                    */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 5) ce que montre l\'onglet Accueil ===');
const appAccueil = lancer(new Map());
const ouvertAuDepart = appAccueil.accueil.hidden === false;
const feuillesFermees = appAccueil.feuilles.every(function (f) { return f.hidden === true; });
console.log('  au démarrage, la page Accueil est montrée : ' + ouvertAuDepart +
  ', feuilles ouvertes = ' + appAccueil.feuilles.filter(function (f) { return !f.hidden; }).length);

appAccueil.clicOnglet('accueil');            // un appui la referme
const refermee = appAccueil.accueil.hidden === true;

appAccueil.clicOnglet('accueil');            // un second la rouvre
const rouverte = appAccueil.accueil.hidden === false;

appAccueil.clicOnglet('reviser');            // un autre onglet la cache
const cacheeParAutre = appAccueil.accueil.hidden === true;
const pageListeOuverte = appAccueil.element('liste').hidden === false;
console.log('  après un appui sur Réviser : page cachée = ' + cacheeParAutre +
  ', page Révision ouverte = ' + pageListeOuverte);


/* ------------------------------------------------------------------ */
/*  Phase 6 : choisir un niveau montre ses cartes                      */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 6) ouverture avec ?niveau=hsk3 ===');
const appNiveau = lancer(new Map(), '?niveau=hsk3');
const accueilFerme = appNiveau.accueil.hidden === true;
const deck = appNiveau.lire('deck-name');
console.log('  page Accueil cachée : ' + accueilFerme);
console.log('  paquet affiché      : ' + JSON.stringify(deck));


/* ------------------------------------------------------------------ */
/*  Phase 7 : « Cartes à revoir » et son paquet                       */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 7) ?review=1, avec et sans carte due ===');

/* Rien de dû : les trois fiches sont poussées loin dans le futur. */
const memoireRien = new Map();
memoireRien.set('hanzi-cards-v1', JSON.stringify({
  '好': { n: 3, ef: 2.5, i: 3, due: 999999, seen: 3, at: '' },
  '水': { n: 3, ef: 2.5, i: 3, due: 999999, seen: 3, at: '' },
  '山': { n: 3, ef: 2.5, i: 3, due: 999999, seen: 3, at: '' }
}));
const appRien = lancer(memoireRien, '?review=1');
const deckRien = appRien.lire('deck-name');
console.log('  rien de dû  -> paquet affiché : ' + JSON.stringify(deckRien));

/* Tout est dû : une mémoire neuve. */
const appDues = lancer(new Map(), '?review=1');
const deckDues = appDues.lire('deck-name');
console.log('  des cartes dues -> paquet affiché : ' + JSON.stringify(deckDues));


/* ------------------------------------------------------------------ */
/*  Phase 8 : « Cartes à revoir » et le compteur du jour              */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 8) le lien « Cartes à revoir » ===');
const appRienFait = lancer(new Map());
const evRien = appRienFait.clicEvt('lien-revoir');
console.log('  compteur du jour à 0 : clic bloqué = ' + evRien.defaultPrevented);

const appRevoir = lancer(new Map());
appRevoir.clavier(' ');   // on retourne la carte : une consultation
appRevoir.clavier('1');   // « À revoir » : le compteur du jour passe à 1
console.log('  statuts après un « à revoir » : à revoir = ' + appRevoir.lire('statut-revoir') + ' · je sais = ' + appRevoir.lire('statut-sais'));
appRevoir.clicEvt('lien-revoir');
const pageRevoirOuverte = appRevoir.revoir.hidden === false;
const htmlRevoir = appRevoir.lireHTML('revoir-liste');
const attributsDansLaBalise = htmlRevoir.indexOf('aria-label') >= 0 &&
  htmlRevoir.indexOf('aria-label') < htmlRevoir.indexOf('>');
console.log('  compteur du jour à 1 : page Revoir ouverte = ' + pageRevoirOuverte);


/* Verifie qu'un « je sais » change bien l'affichage : un balayage a droite. */
const appSais = lancer(new Map());
appSais.clavier(' ');
appSais.clavier('2');
const saisApres2 = appSais.lire('statut-sais');
const revoirApres2 = appSais.lire('statut-revoir');
console.log('  après un « je sais » : je sais = ' + saisApres2 + ', à revoir = ' + revoirApres2);


/* ------------------------------------------------------------------ */
/*  Phase 9 : la recherche de la page Accueil                         */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 9) on tape dans le champ de la page Accueil ===');
const appRecherche = lancer(new Map());
const evPage = { stopped: false, stopPropagation: function () { this.stopped = true; } };
(appRecherche.element('accueil')._ecoutes.click || []).forEach(function (f) { f(evPage); });
const champ = appRecherche.element('accueil-recherche');
const zoneRes = appRecherche.element('accueil-resultats');
champ.value = 'shui';
(champ._ecoutes.input || []).forEach(function (f) { f({}); });
const htmlRes = (zoneRes && zoneRes.innerHTML) || '';
console.log('  résultat pour « shui » (pinyin) : ' + escResume(htmlRes));
const trouveEau = htmlRes.indexOf('水') >= 0;
const trouveUnSeul = (htmlRes.match(/class="resultat"/g) || []).length >= 1;

champ.value = 'eau';
(champ._ecoutes.input || []).forEach(function (f) { f({}); });
const htmlPinyinEau = (zoneRes && zoneRes.innerHTML) || '';
const rienEnPinyin = htmlPinyinEau.indexOf('水') < 0;
console.log('  « eau » en mode pinyin : ' + escResume(htmlPinyinEau));

appRecherche.clicEvt('recherche-contenu');
(champ._ecoutes.input || []).forEach(function (f) { f({}); });
const htmlContenu = (zoneRes && zoneRes.innerHTML) || '';
const trouveParContenu = htmlContenu.indexOf('水') >= 0;
console.log('  « eau » en mode contenu : ' + escResume(htmlContenu));

/* La phrase d'exemple fait partie du contenu (mode 卡) : « bonjour » doit
   trouver 好, dont la phrase est « 你好！». */
champ.value = 'bonjour';
(champ._ecoutes.input || []).forEach(function (f) { f({}); });
const htmlPhrase = (zoneRes && zoneRes.innerHTML) || '';
const trouveParPhrase = htmlPhrase.indexOf('好') >= 0;
console.log('  « bonjour » en mode contenu : ' + escResume(htmlPhrase));

champ.value = 'montagne';
(champ._ecoutes.input || []).forEach(function (f) { f({}); });
const htmlMont = (zoneRes && zoneRes.innerHTML) || '';
console.log('  résultat pour « montagne » : ' + escResume(htmlMont));
const trouveMont = htmlMont.indexOf('山') >= 0;

/* ------------------------------------------------------------------ */
/*  Verdict                                                           */
/* ------------------------------------------------------------------ */

const j = j2;
const controles = [
  ['la pastille compte la carte jugée « à revoir »', String(compteurs) === '1'],
  ['la position revient sur la carte quittée', position.indexOf('Carte 3 / 3') >= 0],
  ['le décompte du jour revient', aujourdhui.indexOf('1 carte consultée') >= 0 &&
    (j2.sais || 0) === 1 && (j2.revoir || 0) === 1],
  ['la consultation du jour est gardée', Object.keys(j.vues || {}).length === 1],
  ['le décompte est daté', typeof j.date === 'string' && j.date.length === 10],
  ['plus de boutons « known » ni « again »', !app.aElement('known') && !app.aElement('again')],
  ['l\'application ne touche plus à « counters »', !app.aElement('counters')],
  ['le bouton demande confirmation sans fermer la feuille', libelle === 'Confirmer'],
  ['la sauvegarde annonce ce qu\'elle a écrit', message.indexOf('cartes-progression-') >= 0],
  ['la feuille se referme après confirmation',
    app.feuilles.every(function (f) { return f.hidden === true; })],
  ['la réinitialisation ne laisse plus rien à revoir', String(apresCompteurs) === '0'],
  ['la réinitialisation efface le décompte du jour',
    (jApres.sais || 0) === 0 && (jApres.revoir || 0) === 0],
  ['la réinitialisation efface les consultations', apresAujourdhui.indexOf('0 carte') >= 0],
  ['la page Accueil est montrée au démarrage, feuilles fermées', ouvertAuDepart && feuillesFermees],
  ['un appui sur Accueil la referme', refermee],
  ['un second la rouvre', rouverte],
  ['un autre onglet la cache et ouvre la page Révision', cacheeParAutre && pageListeOuverte],
  ['?niveau= montre les cartes, pas l\'accueil', accueilFerme],
  // Le harnais ne contient que les fiches du HSK 1 : on ne peut pas y verifier
  // le changement de paquet. Ce qui compte ici, c'est qu'une carte s'affiche.
  ['et une carte est affichée', appNiveau.lire('front-glyph').length > 0],
  ['?review=1 sans carte due montre le niveau', deckRien.indexOf('HSK 1') >= 0],
  ['?review=1 avec des cartes dues montre la révision', deckDues.indexOf('À revoir') >= 0],
  ['compteur du jour à 0 : « Cartes à revoir » ne fait rien', evRien.defaultPrevented === true],
  ['compteur du jour à 1 : la page Revoir s\'ouvre', pageRevoirOuverte],
  ['les attributs des mini-cartes restent dans la balise', attributsDansLaBalise],
  ['la feuille Reviser ne propose plus de bouton Melanger', !app.aElement('shuffle')],
  ['la recherche par pinyin trouve 水 pour « shui »', trouveEau],
  ['et trouve 山 pour « montagne »', trouveMont],
  ['elle renvoie au moins une ligne', trouveUnSeul],
  ['en mode pinyin, « eau » ne trouve rien', rienEnPinyin],
  ['en mode contenu, « eau » trouve 水', trouveParContenu],
  ['en mode contenu, un mot de phrase trouve la fiche', trouveParPhrase],
  ['la page Accueil retient ses clics', evPage.stopped],
  ['un « je sais » incrémente le compte je sais', saisApres2 === '1'],
  ['et ne laisse pas la carte à revoir', revoirApres2 === '0']
];

console.log('');
let tout = true;
controles.forEach(function (c) {
  console.log('  ' + (c[1] ? 'OK  ' : 'ECHEC') + ' ' + c[0]);
  if (!c[1]) { tout = false; }
});
console.log('');
console.log(tout
  ? '  VERDICT : la progression se sauvegarde et se recharge toute seule au lancement ✓'
  : '  VERDICT : quelque chose ne revient pas au lancement ✗');
process.exit(tout ? 0 : 1);
