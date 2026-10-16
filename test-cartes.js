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
    getAttribute: function () { return null; },
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
function lancer(memoire) {
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
  const onglets = [element('onglet-reviser'), element('onglet-progression')];

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
    location: { search: '', href: 'file:///cartes-mobile.html' },
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

  vm.runInNewContext(APP, sandbox, { filename: 'app.js' });

  return {
    lire: function (id) { var e = elements.get(id); return (e && e.textContent != null) ? String(e.textContent) : ''; },
    aElement: function (id) { return elements.has(id); },
    feuilles: feuilles,
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
console.log('  boutons     : ' + JSON.stringify(app.lire('compte-sais')) + ' / ' + JSON.stringify(app.lire('compte-revoir')));
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
const p2Sais = app.lire('compte-sais');
const p2Revoir = app.lire('compte-revoir');
const j2 = jour(memoire) || {};   // figé avant la réinitialisation de la phase 3
console.log('  position    : ' + JSON.stringify(position));
console.log('  à revoir (pastille) : ' + JSON.stringify(compteurs));
console.log('  aujourdhui  : ' + JSON.stringify(aujourdhui));
console.log('  boutons     : ' + JSON.stringify(app.lire('compte-sais')) + ' / ' + JSON.stringify(app.lire('compte-revoir')));

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
const apresSais = app.lire('compte-sais');
const apresRevoir = app.lire('compte-revoir');
console.log('  à revoir (pastille) : ' + JSON.stringify(apresCompteurs));
console.log('  aujourdhui  : ' + JSON.stringify(apresAujourdhui));
console.log('  je sais / à revoir : ' + apresSais + ' / ' + apresRevoir);

/* ------------------------------------------------------------------ */
/*  Phase 4 : on sauvegarde                                           */
/* ------------------------------------------------------------------ */

console.log('');
console.log('=== 4) on appuie sur « Sauvegarder » ===');
app.clic('export');
const message = app.lire('sauvegarde');
console.log('  message affiché : ' + JSON.stringify(message));

/* ------------------------------------------------------------------ */
/*  Verdict                                                           */
/* ------------------------------------------------------------------ */

const j = j2;
const controles = [
  ['la progression revient (2 fiches à revoir sur 3)', String(compteurs) === '2'],
  ['la position revient sur la carte quittée', position.indexOf('Carte 3 / 3') >= 0],
  ['le décompte du jour revient', aujourdhui.indexOf('1 carte consultée') >= 0 &&
    p2Sais === '1' && p2Revoir === '1'],
  ['la consultation du jour est gardée', Object.keys(j.vues || {}).length === 1],
  ['le décompte est daté', typeof j.date === 'string' && j.date.length === 10],
  ['plus de boutons « known » ni « again »', !app.aElement('known') && !app.aElement('again')],
  ['l\'application ne touche plus à « counters »', !app.aElement('counters')],
  ['le bouton demande confirmation sans fermer la feuille', libelle === 'Confirmer'],
  ['la sauvegarde annonce ce qu\'elle a écrit', message.indexOf('cartes-progression-') >= 0],
  ['la feuille se referme après confirmation',
    app.feuilles.every(function (f) { return f.hidden === true; })],
  ['la réinitialisation efface la progression', String(apresCompteurs) === '3'],
  ['la réinitialisation efface le décompte du jour', String(apresSais) === '0' && String(apresRevoir) === '0'],
  ['la réinitialisation efface les consultations', apresAujourdhui.indexOf('0 carte') >= 0]
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
