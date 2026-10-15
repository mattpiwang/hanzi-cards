/* apply-phrases.js — écrit les phrases d'exemple dans les fiches d'un niveau.

   Entrées : data/phrases-<niveau>.json   { "字": ["句子", "pīnyīn", "français", "explication"], … }
             data/cards-<niveau>.json
   Sortie  : les fiches enrichies, sauvegarde dans data/cards.backup-phrases-<niveau>.json

   Le champ écrit est `phrase` (trois éléments : chinois, pinyin, français) et,
   quand la phrase est un chéngyǔ, `phraseNote` (l'explication française). Une
   fiche sans phrase dans le fichier source reste sans phrase : l'application
   n'affiche alors simplement rien.

   Plusieurs conventions sont acceptées pour la note : le quatrième élément du
   tableau, ou une chaîne vide s'il n'y a rien à expliquer.

   Usage : node apply-phrases.js data/cards-hsk1.json
*/

'use strict';

const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const FICHIER = process.argv[2] || path.join('data', 'cards-hsk1.json');
const CARDS = path.isAbsolute(FICHIER) ? FICHIER : path.join(ICI, FICHIER);
const feuille = path.basename(CARDS);
const SUFFIXE = feuille === 'cards.json' ? '' : '-' + feuille.replace(/^cards-/, '').replace(/\.json$/, '');
const PHRASES = path.join(ICI, 'data', 'phrases' + SUFFIXE + '.json');
const SAUVEGARDE = path.join(ICI, 'data', 'cards.backup-phrases' + SUFFIXE + '.json');

function main() {
  console.log('Niveau : ' + feuille);

  const doc = JSON.parse(fs.readFileSync(CARDS, 'utf8').replace(/^\uFEFF/, ''));
  const phrases = JSON.parse(fs.readFileSync(PHRASES, 'utf8').replace(/^\uFEFF/, ''));

  let ecrites = 0;
  let dejaLa = 0;
  let sansCaractere = 0;
  let avecNote = 0;
  const sansPhrase = [];

  (doc.cards || []).forEach(function (c) {
    const lot = phrases[c.char];
    if (!lot || lot.length < 3) { sansPhrase.push(c.char); return; }

    const zh = String(lot[0] || '').trim();
    const py = String(lot[1] || '').trim();
    const fr = String(lot[2] || '').trim();
    const note = String(lot[3] || '').trim();
    if (!zh || !fr) { sansPhrase.push(c.char); return; }

    /* Contrôle : la phrase doit contenir le caractère de la fiche. On le
       signale sans bloquer — c'est un indicateur de qualité, pas une erreur
       fatale. */
    if (zh.indexOf(c.char) < 0) { sansCaractere++; }

    if (c.phrase && c.phrase.length >= 3) { dejaLa++; }
    c.phrase = [zh, py, fr];
    if (note) { c.phraseNote = note; avecNote++; } else { delete c.phraseNote; }
    ecrites++;
  });

  fs.copyFileSync(CARDS, SAUVEGARDE);
  fs.writeFileSync(CARDS, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  console.log('Phrases écrites dans les fiches    : ' + ecrites);
  console.log('  dont chéngyǔ expliqués           : ' + avecNote);
  console.log('  dont la fiche avait déjà une phrase : ' + dejaLa);
  console.log('Fiches restées sans phrase         : ' + sansPhrase.length);
  if (sansPhrase.length) {
    console.log('  ' + sansPhrase.slice(0, 40).join(' '));
  }
  if (sansCaractere) {
    console.log('⚠ phrases ne contenant pas le caractère : ' + sansCaractere);
  }
  console.log('Sauvegarde : ' + path.relative(ICI, SAUVEGARDE));
}

main();
