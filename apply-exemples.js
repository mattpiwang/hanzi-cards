/* apply-exemples.js — écrit les mots d'exemple dans data/cards.json.

   Entrées : data/mots-choisis.json        (mots + pinyin numéroté + définition anglaise)
             data/traductions-exemples.json (mot -> traduction française)
             data/cards.json
   Sortie  : data/cards.json enrichi, sauvegarde dans data/cards.backup.json

   Les fiches écrites à la main gardent leurs propres exemples : on ne touche
   qu'aux fiches importées qui n'en ont pas encore.

   Le pinyin de CC-CEDICT est numéroté (hao3) ; l'application attend des accents
   (hǎo), donc on le convertit ici.

   Usage : node apply-exemples.js
*/

'use strict';

const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const CARDS = path.join(ICI, 'data', 'cards.json');
const CHOISIS = path.join(ICI, 'data', 'mots-choisis.json');
const TRAD = path.join(ICI, 'data', 'traductions-exemples.json');
const SAUVEGARDE = path.join(ICI, 'data', 'cards.backup.json');

/* Règle d'accentuation : a, puis o, puis e ; sinon la dernière voyelle
   (c'est ce qui donne jiǔ pour "jiu3" et huì pour "hui4"). */
const VOYELLES = { a: 'aāáǎà', o: 'oōóǒò', e: 'eēéěè', i: 'iīíǐì', u: 'uūúǔù', 'ü': 'üǖǘǚǜ' };

function accentuer(syllabe) {
  const m = syllabe.match(/^([A-Za-zü:]+)([0-5])$/);
  if (!m) { return syllabe.replace(/u:/g, 'ü').replace(/v/g, 'ü'); }
  const base = m[1].replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const ton = parseInt(m[2], 10);
  if (!ton || ton === 5) { return base; }                      // ton neutre : pas d'accent

  let pos = base.indexOf('a');
  if (pos < 0) { pos = base.indexOf('o'); }
  if (pos < 0) { pos = base.indexOf('e'); }
  if (pos < 0) {
    for (let i = base.length - 1; i >= 0; i--) {
      if ('iouü'.indexOf(base[i]) >= 0) { pos = i; break; }
    }
  }
  if (pos < 0) { return base; }
  const ligne = VOYELLES[base[pos]];
  if (!ligne) { return base; }
  return base.slice(0, pos) + ligne[ton] + base.slice(pos + 1);
}

function pinyinLisible(pinyin) {
  return String(pinyin).trim().split(/\s+/).map(accentuer).join(' ');
}

function main() {
  const doc = JSON.parse(fs.readFileSync(CARDS, 'utf8').replace(/^\uFEFF/, ''));
  const choisis = JSON.parse(fs.readFileSync(CHOISIS, 'utf8').replace(/^\uFEFF/, ''));
  const trad = JSON.parse(fs.readFileSync(TRAD, 'utf8').replace(/^\uFEFF/, ''));

  let enrichies = 0;
  let sansTraduction = 0;
  const motsVus = new Set();

  (doc.cards || []).forEach(function (c) {
    if (!c.source) { return; }                    // fiches rédigées à la main : on n'y touche pas
    if (c.words && c.words.length) { return; }    // déjà des exemples
    const lot = choisis[c.char];
    if (!lot || !lot.length) { return; }

    const mots = [];
    lot.forEach(function (x) {
      if (motsVus.has(x.mot)) { return; }
      const fr = trad[x.mot];
      if (!fr) { sansTraduction++; return; }
      motsVus.add(x.mot);
      mots.push([x.mot, pinyinLisible(x.pinyin), fr]);
    });
    if (mots.length) { c.words = mots; enrichies++; }
  });

  fs.copyFileSync(CARDS, SAUVEGARDE);
  fs.writeFileSync(CARDS, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  const avecMots = (doc.cards || []).filter(function (c) { return c.words && c.words.length; }).length;
  console.log('Fiches enrichies de mots d\'exemple : ' + enrichies);
  console.log('Fiches avec exemples au total      : ' + avecMots + ' / ' + (doc.cards || []).length);
  if (sansTraduction) { console.log('Mots sans traduction (ignorés)     : ' + sansTraduction); }

  console.log('\nAperçu (5 fiches importées) :');
  (doc.cards || []).filter(function (c) { return c.source; }).slice(0, 5).forEach(function (c) {
    const l = (c.words || []).map(function (w) { return w[0] + ' [' + w[1] + '] = ' + w[2]; }).join('  |  ');
    console.log('  ' + c.char + ' : ' + (l || '(aucun)'));
  });
}

main();
