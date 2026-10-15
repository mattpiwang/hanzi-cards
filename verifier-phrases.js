/* verifier-phrases.js — contrôle qualité des phrases d'exemple d'un niveau.

   Ce script ne modifie rien : il relit les fiches et les phrases sources, puis
   dit ce qui va et ce qui ne va pas. C'est le garde-fou du chantier
   « phrases » : une phrase doit contenir le caractère de sa fiche, être en
   chinois, avoir un pinyin accentué et une traduction française — et jamais
   d'anglais, puisque l'application n'affiche que du français.

   Usage : node verifier-phrases.js data/cards-hsk1.json
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

/* Mots anglais typiques : s'ils traînent dans une traduction, c'est un oubli. */
/* Mots anglais typiques : s'ils traînent dans une traduction, c'est un oubli.
   On exclut volontairement « a » et « an » : en français, « il y a », « il a
   dépassé » les déclencheraient à tort (c'est arrivé). */
const ANGLAIS = /(^|\s)(the|to|of|and|with|for|is|are|not|very|this|that|from|into|about)(\s|$)/i;
/* Une phrase « canonique » de chéngyǔ : exactement quatre caractères chinois. */
const QUATRE = /^[\u4e00-\u9fff]{4}$/;

function accentue(pinyin) {
  return /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(pinyin);
}

function main() {
  const doc = JSON.parse(fs.readFileSync(CARDS, 'utf8').replace(/^\uFEFF/, ''));
  const cartes = doc.cards || [];
  let phrases = {};
  try {
    phrases = JSON.parse(fs.readFileSync(PHRASES, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    console.log('Fichier de phrases illisible (' + path.relative(ICI, PHRASES) + ') : ' + e.message);
  }

  const problemes = [];
  const sansPhrase = [];
  const sansCaractere = [];
  const sansNote = [];
  let avecNote = 0;
  let chengyu = 0;

  cartes.forEach(function (c) {
    const ph = c.phrase;
    if (!ph || ph.length < 3 || !ph[0]) { sansPhrase.push(c.char); return; }
    const zh = String(ph[0]);
    const py = String(ph[1] || '');
    const fr = String(ph[2] || '');
    if (zh.indexOf(c.char) < 0) { sansCaractere.push(c.char + ' « ' + zh + ' »'); }
    if (!py.trim()) { problemes.push(c.char + ' : pinyin vide'); }
    else if (!accentue(py)) { problemes.push(c.char + ' : pinyin sans accent (« ' + py + ' »)'); }
    if (!fr.trim()) { problemes.push(c.char + ' : traduction vide'); }
    else if (ANGLAIS.test(fr)) { problemes.push(c.char + ' : anglais dans la traduction (« ' + fr + ' »)'); }
    if (c.phraseNote) {
      avecNote++;
      if (ANGLAIS.test(c.phraseNote)) { problemes.push(c.char + ' : anglais dans la note'); }
    } else if (QUATRE.test(zh)) {
      chengyu++;
      sansNote.push(c.char);
    }
  });

  console.log('Fichier           : ' + feuille);
  console.log('Fiches            : ' + cartes.length);
  console.log('Avec phrase       : ' + (cartes.length - sansPhrase.length));
  console.log('Sans phrase       : ' + sansPhrase.length +
    (sansPhrase.length ? '   ' + sansPhrase.slice(0, 40).join(' ') : ''));
  console.log('Chéngyǔ (4 car.)  : ' + chengyu + ' sans explication' +
    (sansNote.length ? '   ' + sansNote.slice(0, 25).join(' ') : ''));
  console.log('Notes explicatives: ' + avecNote);
  console.log('Phrase sans le caractère de la fiche : ' + sansCaractere.length);
  sansCaractere.slice(0, 12).forEach(function (x) { console.log('   ' + x); });
  console.log('Problèmes         : ' + problemes.length);
  problemes.slice(0, 15).forEach(function (x) { console.log('   ' + x); });

  console.log('\nQuelques exemples :');
  const echantillon = cartes.filter(function (c) { return c.phrase; });
  const pas = Math.max(1, Math.floor(echantillon.length / 5));
  for (let i = 0; i < echantillon.length; i += pas) {
    const c = echantillon[i];
    console.log('  ' + c.char + '  ' + c.phrase[0] + '  [' + c.phrase[1] + ']  ' + c.phrase[2] +
      (c.phraseNote ? '   → ' + c.phraseNote : ''));
  }
}

main();
