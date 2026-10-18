# Feuille de route — Cartes 汉字

**État actuel** (16/10, version 87) : **662 fiches** — 253 du HSK 1 (41 écrites à
la main en français + 212 importées), 125 du HSK 2 et 284 du HSK 3 —,
application statique sans dépendance, installable en PWA, progression locale au
navigateur.

Chaque fiche a **au moins deux mots d'exemple** (1 277 en tout), le **HSK 1 et
le HSK 3 ont en plus une phrase** qui met le caractère en situation (537
phrases, dont 235 chéngyǔ expliqués), et **aucun anglais n'est affiché** : les
sens, étymologies, gloses, mots et phrases sont tous en français.

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

## 3. Réalisé — le 16/10

### Le HSK 3 est arrivé (284 fiches de plus)

| Priorité | Chantier | Ce qui a été fait |
|---|---|---|
| ★★★ | **Import du HSK 3** | ✅ 284 fiches importées de Make Me a Hanzi, filtrées sur `hsk3.txt` : pinyin, radicaux, décomposition, type étymologique. |
| ★★★ | **Tout en français** | ✅ 284 sens, 284 étymologies et 256 gloses de composants traduits : **aucune glose anglaise ne subsiste**. |
| ★★★ | **Mots d'exemple** | ✅ 496 mots choisis dans les listes HSK (CC-CEDICT) et traduits — **284 / 284 fiches** en ont au moins un. |
| ★★★ | **Une phrase par fiche** | ✅ 284 phrases, dont **127 chéngyǔ** avec leur explication. Contrôle qualité au vert : chaque phrase contient son caractère. |
| ★★ | **Les fiches muettes** | ✅ Les 32 fiches sans décomposition portent une note ; les 8 fiches restées sans mot d'exemple ont reçu un mot choisi à la main (消瘦, 又名, 山羊, 姨妈, 勺子…). |
| ★★ | **Un outil pour les niveaux suivants** | ✅ `ajouter-niveau.ps1` déroule les huit étapes (traductions, mots, phrases) d'un seul appel — le HSK 4 tiendra en deux commandes. |

### Où en sont les données

| | HSK 1 | HSK 2 | HSK 3 | Total |
|---|---|---|---|---|
| Fiches | 253 | 125 | 284 | **662** |
| Mots d'exemple | 524 | 257 | 496 | **1 277** |
| Phrases | 253 | 0 | 284 | **537** |
| Notes explicatives | 26 | 19 | 32 | **77** |

**Reste à aligner** : les **125 fiches du HSK 2** n'ont pas encore de phrase —
elles ont leurs mots, et la recette tient en une commande.

**Décision du 16/10** : un niveau se traite désormais **d'un bout à l'autre** par
`import-hanzi-db.ps1` puis `ajouter-niveau.ps1`, et il se déclare dans trois
fichiers (`assets/app.js`, `theme.html`, `index.html`).

### Un incident à retenir

Six scripts PowerShell avaient perdu leur **BOM UTF-8** au fil des retouches du
15/10 : Windows PowerShell les lisait alors en CP1252, et `import-hanzi-db.ps1` a
refusé de s'analyser le jour de l'import du HSK 3. Les huit scripts en ont un
désormais. `build-mobile.ps1` corrige aussi l'étiquette des niveaux du fichier
unique, qui ne contient que le HSK 1.

---

## 4. Réalisé — le 17/10 (l'application)

### Ce que la révision est devenue

| Priorité | Chantier | Ce qui a été fait |
|---|---|---|
| ★★★ | **Reprise de session** | ✅ On rouvre sur sa carte, pas sur la première : niveau, lot et position sont retenus puis restaurés. Un lien explicite gagne toujours ; un thème vide ou une révision sans rien de dû retombe sur le paquet entier. |
| ★★★ | **Les compteurs du jour** | ✅ « N cartes consultées », « Je sais » et « À revoir », datés, remis à zéro chaque matin, conservés d'un rechargement à l'autre. |
| ★★ | **On juge au geste** | ✅ Les boutons « Je sais / À revoir » ont quitté la feuille : on glisse (ou on tape 1 / 2 au clavier). Les deux lignes ne sont plus que le tableau de bord du jour. |
| ★★ | **Réinitialiser, pour de vrai** | ✅ Double appui (« Confirmer ») qui efface progression, décompte du jour et position — puis referme la feuille. Avant : un dialogue natif que les applications installées ignorent, qui ne faisait donc **rien**, sans le moindre signe. |
| ★★ | **Sauvegarder, visiblement** | ✅ Le lien de téléchargement reste en place jusqu'à la libération de l'URL (retiré trop tôt, certains navigateurs annulent le téléchargement), et un message dit ce qui a été écrit. |
| ★★★ | **Bug : « À revoir » renvoyait à demain** | ✅ Corrigé. Un échec calculait son échéance comme une réussite : la carte quittait la file du jour, et le compteur baissait au lieu de monter. |
| ★★★ | **La page Thèmes** | ✅ Même barre de navigation que les cartes, **feuilles qui s'ouvrent sur place**, défilement rendu (la règle `html, body { overflow: hidden }` des cartes la coupait), et thèmes de **tous** les niveaux — les fiches importées n'ont pas de thème de vocabulaire. |
| ★★ | **Menu réorganisé** | ✅ *Progression* descend dans *Réglages* ; l'onglet devient **Niveau** et reçoit les quatre niveaux. Aucune ligne de JavaScript : la mécanique des feuilles est générique (`data-onglet` ↔ `data-feuille`). |
| ★★★ | **Un filet : `test-cartes.js`** | ✅ 13 contrôles qui exécutent le vrai `app.js` dans un faux DOM : progression, position, compteurs du jour, réinitialisation, sauvegarde. |

### L'accueil, et l'état de référence

L'onglet **Accueil** n'est plus une feuille : c'est une **page** — une `div#accueil`
posée dans le corps du document, entre `</main>` et `<footer>` —, avec le champ de
recherche en tête. **Seul Accueil** est dans ce cas : *Parcourir*, *Niveau* et
*Réglages* restent des feuilles. La carte est masquée tant que la page est ouverte,
et l'application démarre sur la carte, **pas** sur Accueil.

La **page Thèmes** a suivi le même chemin : plus d'en-tête, la même barre que les
cartes (avec sa ligne de version), le défilement rendu, et des feuilles qui
s'ouvrent sur place.

**État de référence : version 148.** Le harnais a désormais dix-sept contrôles,
dont quatre qui vérifient la règle d'Accueil. Une copie de cet état est déposée
hors du dépôt, dans `..\_sauvegardes\cartes-v148\` — utile tant que le travail
n'est pas commité.
### La leçon de la soirée

Deux régressions sont passées **inaperçues** ✗ : des éléments retirés d'`index.html`
alors que le script continuait à les chercher (les écritures sont protégées, donc
rien ne casse — et rien ne s'affiche), et un onglet qui rechargeait la page au lieu
d'ouvrir sa feuille. Les deux ont été trouvées en **exécutant**, pas en relisant.
C'est pour cela que `test-cartes.js` existe : toute modification de l'interface
devrait le passer au vert avant d'être publiée.

**Version 105**, hors ligne reconstruit.

---

## 5. Plus tard

| Chantier | Pourquoi attendre |
|---|---|
| **Phrases du HSK 2** | Aligner les 125 fiches du HSK 2 sur le HSK 1. Recette rodée : `generer-phrases.ps1 -Fichier data\cards-hsk2.json`, puis `apply-phrases.js`. Quelques minutes. |
| **Niveaux HSK 4 à 9** | Le HSK 1, le HSK 2 et le HSK 3 sont faits (662 fiches). Les listes sont déjà téléchargées (`..\hanzi-db\filtres\`) et la marche à suivre tient en deux commandes : `import-hanzi-db.ps1`, puis `ajouter-niveau.ps1`. Il ne reste qu'à répéter. |
| **Chinois traditionnel** | Champ `traditional` + bouton d'affichage. |
| **Audio** | Prononciations enregistrées, ou de synthèse. Prévu pour accompagner chaque phrase d'exemple. |
| **APK** | Via PWABuilder ou Bubblewrap, une fois le contenu étoffé. |
| **Thèmes pour les niveaux importés** | Les 125 fiches du HSK 2 et les 284 du HSK 3 n'ont pas de thème de vocabulaire — leur seule catégorie est le nom de leur niveau. La page Thèmes ne peut donc lister que ceux du HSK 1. Les classer (Nature, Verbes, Famille…) ouvrirait un vrai parcours par thème sur tous les niveaux. |
| **Traductions locales (Ollama)** | Mesuré le 16/10, en aveugle sur 50 définitions : un 7 B local (`qwen2.5:7b`) n'en rend que **64 %** au format demandé, et perd le match **21 à 1** (10 égalités) face à Ziya — les seules vraies erreurs étant de son côté. Gardé pour les tâches courtes (`..\ollama-chat\`), **écarté pour le contenu des cartes**. Protocole, tableau A/B et dépouillement : `..\comparaison-ollama\`. |

### Favoris — demandé le 17/10

| Priorité | Chantier | Détail |
|---|---|---|
| ★★ | **Favoris** | Une étoile sur chaque fiche, stockée en local (`localStorage`, comme la progression) et reprise par l'export / import JSON existant. Filtre « Favoris » dans *Parcourir*, et file de révision dédiée si le besoin se confirme. |

Pourquoi maintenant et pas plus tard : c'est une fonction courte (un booléen par
caractère, aucune donnée à importer), et elle rend la révision plus personnelle
sans toucher au contenu. À poser **après** les phrases du HSK 2, pour ne pas
étoiler des fiches qu'on retouchera ensuite.

### Recherche de caractère — demandé le 17/10

La recherche existe déjà sur la page **Thèmes** (caractère, pinyin, sens ou
radical, et le résultat ouvre la carte). Ce qui manque, c'est un accès direct
depuis l'écran principal.

| Priorité | Chantier | Détail |
|---|---|---|
| ★★ | **Barre de recherche permanente** | Un champ accessible depuis l'écran principal (ou un onglet dédié), qui filtre instantanément les 662 fiches par caractère, pinyin ou sens, sans passer par Thèmes. |
| ★ | **Résultats enrichis** | Chaque résultat montre caractère, pinyin, sens et niveau ; les favoris remontent en tête. |
| ★ | **Lien profond** | Conserver `index.html?char=X` pour qu'un résultat ouvre directement la fiche, avec un retour à la recherche. |

À faire en même temps que les favoris : les deux touchent la même barre de
navigation et le même stockage local.

---

## 6. Architecture — fait : un fichier par niveau

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
niveaux » les réunit (662 fiches), chaque fiche déclare son niveau, la page
Thèmes compte niveau par niveau avec le total, et le filtrage par niveau passe
par les catégories (`?niveau=tout&theme=HSK 2`). La progression reste commune,
indexée par caractère.

**Le pipeline suit la même règle** : chaque niveau a ses compagnons suffixés
(`mots-choisis-hsk1.json`, `traductions-mots-hsk1.json`, `phrases-hsk1.json`…),
et les trois scripts prennent le fichier du niveau en argument. C'est ce
suffixe qui manquait au HSK 1 jusqu'au 15/10.

---

## 7. Empaquetage APK (plus tard)

- **[PWABuilder](https://www.pwabuilder.com)** (en ligne) ou **Bubblewrap** (Node + JDK) produisent un `.apk` signé depuis la PWA publiée.
- Déjà en place : GitHub Pages en HTTPS, `manifest.json` complet, icônes 192/512, `display: standalone`.
- À prévoir : un identifiant d'application (ex. `io.github.mattpiwang.cartes`), une clé de signature à conserver, et une nouvelle version à republier à chaque évolution.

---

## 8. À trancher à la prochaine révision

> Note laissée par Matt le 13/10, après l'épuration de l'écran.

L'écran ne garde plus que la carte, et tout ce qui commande est dans le menu
barre du bas, rangé en onglets (*Cette carte*, *Parcourir*, *Progression*,
*Apparence*).

### a. Que faire ensuite ?

Le contenu n'a plus de trou : la suite est soit **du contenu neuf** (les phrases
du HSK 2, puis les niveaux HSK 4 à 9), soit **de l'interface**, soit **l'APK**.
Les phrases du HSK 2 sont le pas le plus court — il rend l'application homogène,
puisque le HSK 1 et le HSK 3 en ont déjà.

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
