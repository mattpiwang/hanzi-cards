# Feuille de route — Cartes 汉字

**État actuel** (15/10, version 86) : **378 fiches** — 253 du HSK 1 (41 écrites à
la main en français + 212 importées) et 125 du HSK 2 —, application statique
sans dépendance, installable en PWA, progression locale au navigateur.

Chaque fiche a **au moins deux mots d'exemple** (781 en tout), le **HSK 1 a en
plus une phrase** qui met son caractère en situation (253 phrases, dont 108
chéngyǔ expliqués), et **aucun anglais n'est affiché** : les sens, étymologies,
gloses, mots et phrases sont tous en français.

**Déjà en place** : retournement d'un appui sur la carte, **glissement
gauche/droite pour juger**, barre du bas à quatre onglets, **page Thèmes**, interrupteur **阴 / 阳**
(mode sombre / papier de riz), navigation au clavier, compteur de progression,
version « un seul fichier » hors ligne, service worker.

---

## Décisions prises le 12/10

| Décision | Détail |
|---|---|
| **Pas d'anglais à l'écran** | Les sens et les étymologies importés sont traduits en français. L'anglais **reste dans les données** (`meaningEn`) : il sert de base à la traduction, mais n'est **jamais affiché** sur une carte. |
| **Contenu et fonctionnalités avant l'APK** | L'empaquetage Android attendra que l'application soit plus riche. |
| **Architecture : un fichier par niveau** | Au prochain import, chaque niveau aura son `cards-<niveau>.json`, chargé à la demande. À mettre en place **au moment de l'import**, pas avant. |

## Décisions prises le 15/10

| Décision | Détail |
|---|---|
| **La phrase s'ajoute aux mots, elle ne les remplace pas** | Deux champs nouveaux : `phrase` (chinois, pinyin, français) et `phraseNote` (l'explication, quand c'est un chéngyǔ). Les mots d'exemple restent la base du vocabulaire. |
| **Une phrase contient le caractère de sa fiche** | Règle vérifiée mécaniquement par `verifier-phrases.js` : 253 / 253. |
| **Le HSK 1 d'abord** | Les phrases ont été faites pour le HSK 1 uniquement ; le HSK 2 suivra la même recette. |
| **Aucune phrase plutôt qu'une phrase faible** | Si la source est muette, on n'affiche rien : pas de remplissage. Même principe que pour les notes de décomposition. |

---

## 1. Réalisé — le 13/10

Tous les chantiers ci-dessous sont **terminés et vérifiés** (syntaxe, contrastes,
service worker) et committés.

### Contenu

| Priorité | Chantier | Ce qui a été fait |
|---|---|---|
| ★★★ | **Sens en français** | ✅ **253 / 253** fiches. L'anglais reste dans `meaningEn` et n'est plus jamais affiché. |
| ★★★ | **Étymologies en français** | ✅ **212 / 212**, plus les gloses des radicaux (**394** remplacées). |
| ★★ | **Mots d'exemple** | ✅ **244 / 253** fiches. Mots pris dans les listes HSK (~11 000 entrées), pinyin et définitions de CC-CEDICT, traduits. |

### Fonctionnalités

| Priorité | Chantier | Détail |
|---|---|---|
| ★★★ | **Ordre des traits animé** | ✅ [hanzi-writer](https://hanziwriter.org) + tracés de Make Me a Hanzi (253 caractères). Le quiz « tracer au doigt » a été **retiré** : la carte retournée en 3D envoyait les coordonnées en miroir. |
| ★★★ | **Répétition espacée (SM-2)** | ✅ Intervalles 1 j, 6 j, puis `i x ef` ; échéance par fiche ; migration des anciennes progressions. Testé par simulation. |
| ★★ | **Revoir les cartes dues** | ✅ Entrée « Cartes à revoir » du menu = **dues aujourd'hui** ; une carte réussie quitte la file. |
| ★★ | **Sauvegarde de la progression** | ✅ Export / import JSON dans le menu, avec confirmation. Validation testée sur 8 cas limites. |
| ★★ | **Recherche** | ✅ Sur la page Thèmes : caractère, pinyin, sens ou radical ; le résultat ouvre la carte (`index.html?char=X`). |
| ★ | **Statistiques** | ✅ Dû aujourd'hui, fiches sues, pourcentage du jeu, **prévision des sept prochains jours** (fonction pure testée). |

---

## 2. Réalisé — le 15/10

### Les trous, puis les phrases

| Priorité | Chantier | Ce qui a été fait |
|---|---|---|
| ★★★ | **Les trous comblés** | ✅ **55 trous** : 14 fiches gagnent 2 à 4 mots d'exemple — dont six expressions (九牛一毛, 七上八下, 狗急跳墙, 六神无主, 目不转睛, 拳打脚踢) — et **41 fiches sans décomposition** reçoivent une note qui explique le silence. |
| ★★★ | **Plus aucune fiche à un seul mot** | ✅ Les 46 fiches qui n'avaient qu'un seul exemple en ont désormais **au moins deux** : **781 mots** au total. La cause n'était pas un manque de traductions, mais une règle du script (`apply-exemples.js` ne remplissait que les fiches *sans* mot) : il a suffi de vider ces fiches et de relancer, puis de choisir un second mot pour les 19 dernières. |
| ★★ | **Notes reformulées** | ✅ Les 41 notes parlent maintenant à un apprenant : « D'un seul bloc : ce caractère n'a pas de parties à décomposer » (6 caractères vraiment atomiques : 八 牛 士 身 已 鸟) et « Décomposition non documentée : ce caractère s'apprend comme un tout » (35). Les 4 notes de tons (一, 不, 好, 生) sont intactes. |
| ★★★ | **Une phrase par fiche** | ✅ **253 / 253**, HSK 1 seulement. Chaque phrase contient le caractère de sa fiche, fait 6 à 16 caractères (11,4 en moyenne), et est **drôle** ou un **chéngyǔ expliqué** : **108 chéngyǔ**, chacun avec son explication en français. Pinyin accentué, traduction française. |
| ★ | **Plomberie** | ✅ Les cinq fichiers compagnons du niveau de base sont renommés en `-hsk1` : le pipeline HSK 1 était cassé depuis le renommage de `cards.json`. Trois défauts corrigés au passage. |
| ★ | **Outils** | ✅ `generer-phrases.ps1` (Ziya, par lots, relançable), `apply-phrases.js`, `verifier-phrases.js` — documentés dans le README. L'analyse JSON est confiée à Node : `ConvertFrom-Json` de Windows PowerShell rejetait des lots pourtant valides. |

### Où en sont les données

| | |
|---|---|
| Fiches | **378** (253 HSK 1 + 125 HSK 2) — aucune sans mot d'exemple |
| Mots d'exemple | **781** |
| Phrases | **253** (HSK 1) |
| Notes explicatives | 41 réécrites, plus 4 notes de tons |
| Non affiché | tout l'anglais : `meaningEn`, `etymologyEn` et les définitions brutes restent en base, jamais à l'écran |

---

## 3. Plus tard

| Chantier | Pourquoi attendre |
|---|---|
| **Phrases du HSK 2** | Aligner les 125 fiches du HSK 2 sur le HSK 1. Recette rodée : `generer-phrases.ps1 -Fichier data\cards-hsk2.json`, puis `apply-phrases.js`. Quelques minutes. |
| **Niveaux HSK 3 à 9** | HSK 2 est fait (125 fiches, 13/10). Les listes sont déjà téléchargées (`..\hanzi-db\filtres\`) et la marche à suivre est éprouvée de bout en bout : import, trois traductions, mots d'exemple, phrases. Il ne reste qu'à répéter. |
| **Chinois traditionnel** | Champ `traditional` + bouton d'affichage. |
| **Audio** | Prononciations enregistrées, ou de synthèse. Prévu pour accompagner chaque phrase d'exemple. |
| **APK** | Via PWABuilder ou Bubblewrap, une fois le contenu étoffé. |

---

## 4. Architecture — fait : un fichier par niveau

Tout tenait autrefois dans `data/cards.json` : 302 Ko pour 253 fiches, soit
environ **1,1 Ko par fiche**. Les six niveaux HSK représenteraient ~2 000 fiches
≈ 2,2 Mo — trop lourd à charger d'un bloc sur un téléphone.

**Choix retenu** : un fichier par niveau (`data/cards-hsk1.json`,
`cards-hsk2.json`…), chargé à la demande. Le mode hors ligne met en cache les
niveaux déjà ouverts, et l'écran d'accueil permet de choisir le niveau — la page
Thèmes s'en charge.

**Fait le 13/10**, pendant l'import du HSK 2 : `data/cards-hsk1.json` (253 fiches)
et `data/cards-hsk2.json` (125 fiches). L'application ne télécharge que le niveau
choisi, et le service worker ne garde en cache que ceux qu'on a ouverts.

**Puis les niveaux sont devenus des collections** : une entrée « Tous les
niveaux » les réunit (378 fiches), chaque fiche déclare son niveau, la page
Thèmes compte niveau par niveau avec le total, et le filtrage par niveau passe
par les catégories (`?niveau=tout&theme=HSK 2`). La progression reste commune,
indexée par caractère.

**Le pipeline suit la même règle** : chaque niveau a ses compagnons suffixés
(`mots-choisis-hsk1.json`, `traductions-mots-hsk1.json`, `phrases-hsk1.json`…),
et les trois scripts prennent le fichier du niveau en argument. C'est ce
suffixe qui manquait au HSK 1 jusqu'au 15/10.

---

## 5. Empaquetage APK (plus tard)

- **[PWABuilder](https://www.pwabuilder.com)** (en ligne) ou **Bubblewrap** (Node + JDK) produisent un `.apk` signé depuis la PWA publiée.
- Déjà en place : GitHub Pages en HTTPS, `manifest.json` complet, icônes 192/512, `display: standalone`.
- À prévoir : un identifiant d'application (ex. `io.github.mattpiwang.cartes`), une clé de signature à conserver, et une nouvelle version à republier à chaque évolution.

---

## 6. À trancher à la prochaine révision

> Note laissée par Matt le 13/10, après l'épuration de l'écran.

L'écran ne garde plus que la carte, et tout ce qui commande est dans le menu
barre du bas, rangé en onglets (*Cette carte*, *Parcourir*, *Progression*,
*Apparence*).

### a. Que faire ensuite ?

Le contenu n'a plus de trou : la suite est soit **du contenu neuf** (phrases du
HSK 2, puis HSK 3 à 9), soit **de l'interface**, soit **l'APK**. Le HSK 2 est le
pas le plus court et le plus utile — il rend l'application homogène.

### b. Les phrases ont-elles leur place sur le recto ?

Aujourd'hui la phrase vit au verso, dans un encadré à liseré doré, entre l'état
de révision et la décomposition. Deux pistes : la garder là, ou en faire une
**étape de révision à part entière** (« lis la phrase, comprends-tu le
caractère ? »), ce qui demanderait de repenser la file de révision.

### c. Une page par bouton ?

*(close le 14/10 : les quatre onglets de la barre du bas portent les commandes,
chacun ouvrant sa feuille — fait sans ajouter un pixel de hauteur, la barre a
remplacé le pied existant.)*

### d. Une arborescence de menu ?

Des sous-menus, par exemple *Progression* → sauvegarder / restaurer /
réinitialiser. Plus clair à mesure que les commandes s'ajoutent, au prix d'un
ou deux appuis supplémentaires pour y arriver.
