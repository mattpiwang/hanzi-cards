/* build-exemples.js — choisit deux mots d'exemple par fiche importée.

   SOURCES
   -------
   Les MOTS viennent des listes de vocabulaire HSK (2021, ~11 000 entrées) :
   c'est le programme officiel, donc des mots réellement utiles et classés par
   niveau. C'est bien meilleur qu'un tri par fréquence approximatif.
   Le PINYIN et la DÉFINITION viennent de CC-CEDICT.

   Entrées  : ../hanzi-db/filtres/mots2021-hsk*.txt   (un mot par ligne)
              ../hanzi-db/cedict.txt                  (traditionnel simplifié [pin1 yin1] /sens/)
   Sortie   : data/mots-choisis.json  { "爱": [ { mot, pinyin, niveau, def }, … ] }

   La traduction française des définitions est faite ensuite (traduire.ps1,
   même méthode que pour les sens et les étymologies : Ziya, fichier UTF-8).

   Usage : node build-exemples.js
*/

'use strict';

const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const DICO = path.join(ICI, '..', 'hanzi-db', 'cedict.txt');
const FILTRES = path.join(ICI, '..', 'hanzi-db', 'filtres');
const CARTES = path.join(ICI, 'data', 'cards.json');
const SORTIE = path.join(ICI, 'data', 'mots-choisis.json');

const NIVEAUX = ['1', '2', '3', '4', '5', '6', '7-9'];
const PAR_CARACTERE = 2;
const LONGUEUR_MAX = 3;

function lireCartes() {
  return JSON.parse(fs.readFileSync(CARTES, 'utf8')).cards || [];
}

/* Mot -> niveau HSK (le plus bas gagne : c'est le plus courant). */
function lireMotsHSK() {
  const mots = new Map();
  NIVEAUX.forEach(function (niv, rang) {
    const f = path.join(FILTRES, 'mots2021-hsk' + niv + '.txt');
    if (!fs.existsSync(f)) { return; }
    fs.readFileSync(f, 'utf8').split('\n').forEach(function (l) {
      const mot = l.trim();
      if (mot.length < 2 || mot.length > LONGUEUR_MAX) { return; }
      if (!mots.has(mot)) { mots.set(mot, rang); }
    });
  });
  return mots;
}

/* Mot simplifié -> { pinyin, defs } depuis CC-CEDICT. */
function lireCedict() {
  const index = new Map();
  fs.readFileSync(DICO, 'utf8').split('\n').forEach(function (l) {
    if (!l || l[0] === '#') { return; }
    const m = l.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
    if (!m) { return; }
    const mot = m[2];
    if (index.has(mot)) { return; }
    const defs = m[4].split('/').filter(function (d) { return d.trim(); });
    if (!defs.length) { return; }
    index.set(mot, { pinyin: m[3], defs: defs });
  });
  return index;
}

/* Les définitions qui renvoient ailleurs n'apprennent rien. */
function definissable(e) {
  const d = e.defs.join(' ; ');
  if (/^(used in|variant of|see |old variant|archaic variant|abbr\. for|erhua variant|Japanese variant)/i.test(d)) { return false; }
  if (/^surname [A-Z]/.test(d)) { return false; }
  return true;
}

function score(mot, rang, caractere) {
  let s = (NIVEAUX.length - rang) * 2;               // HSK 1 vaut 12, HSK 7-9 vaut 2
  if (mot[0] === caractere) { s += 5; }              // le mot commence par le caractère : plus parlant
  if (mot.length === 2) { s += 2; }                  // les mots de deux caractères sont les plus utiles
  return s;
}

function main() {
  if (!fs.existsSync(DICO)) { console.error('CC-CEDICT introuvable : ' + DICO); process.exit(1); }

  const cartes = lireCartes();
  const aFaire = cartes.filter(function (c) { return c.source; });
  const vocabulaire = new Set(cartes.map(function (c) { return c.char; }));
  console.log('Fiches importées à illustrer : ' + aFaire.length);

  const motsHSK = lireMotsHSK();
  console.log('Mots HSK retenus (2 à ' + LONGUEUR_MAX + ' caractères) : ' + motsHSK.size);
  const cedict = lireCedict();
  console.log('Entrées CC-CEDICT indexées : ' + cedict.size);

  /* Index inverse : caractère -> mots HSK qui le contiennent. */
  const parCaractere = new Map();
  motsHSK.forEach(function (rang, mot) {
    new Set(mot.split('')).forEach(function (ch) {
      if (!parCaractere.has(ch)) { parCaractere.set(ch, []); }
      parCaractere.get(ch).push({ mot: mot, rang: rang });
    });
  });

  const resultat = {};
  let sansExemple = 0;
  for (const c of aFaire) {
    const candidats = parCaractere.get(c.char) || [];
    const classes = candidats
      .filter(function (x) { return cedict.has(x.mot) && definissable(cedict.get(x.mot)); })
      .sort(function (a, b) { return score(b.mot, b.rang, c.char) - score(a.mot, a.rang, c.char); });

    const choisis = [];
    for (const x of classes) {
      const e = cedict.get(x.mot);
      choisis.push({
        mot: x.mot,
        pinyin: e.pinyin,
        niveau: 'HSK ' + NIVEAUX[x.rang],
        def: e.defs.join(' ; ')
      });
      if (choisis.length >= PAR_CARACTERE) { break; }
    }
    if (choisis.length) { resultat[c.char] = choisis; } else { sansExemple++; }
  }

  fs.writeFileSync(SORTIE, JSON.stringify(resultat, null, 1), 'utf8');
  const total = Object.keys(resultat).length;
  const nbMots = Object.keys(resultat).reduce(function (n, k) { return n + resultat[k].length; }, 0);
  console.log('Fiches illustrées : ' + total + ' / ' + aFaire.length + ' (' + sansExemple + ' sans candidat)');
  console.log('Mots choisis : ' + nbMots + ' -> ' + SORTIE);

  // Aperçu, sans dépendre d'un terminal : les 8 premières fiches du jeu.
  console.log('\nAperçu (8 premières fiches importées) :');
  aFaire.slice(0, 8).forEach(function (c) {
    const l = resultat[c.char];
    console.log('  ' + c.char + ' : ' + (l ? l.map(function (x) { return x.mot + ' (' + x.niveau + ') — ' + x.def; }).join('  |  ') : '(aucun)'));
  });
}

main();
