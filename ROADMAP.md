# Feuille de route — Cartes 汉字

**État actuel** : 253 fiches (41 écrites à la main en français + 212 importées du
HSK 1), application statique sans dépendance, installable en PWA, progression
locale au navigateur.

**Déjà en place** : retournement d'un appui sur la carte, **glissement
gauche/droite pour juger**, menu burger, **page Thèmes**, interrupteur **阴 / 阳**
(mode sombre / papier de riz), navigation au clavier, compteur de progression,
version « un seul fichier » hors ligne, service worker.

---

## Décisions prises le 12/10

| Décision | Détail |
|---|---|
| **Pas d'anglais à l'écran** | Les sens et les étymologies importés sont traduits en français. L'anglais **reste dans les données** (`meaningEn`) : il sert de base à la traduction, mais n'est **jamais affiché** sur une carte. |
| **Contenu et fonctionnalités avant l'APK** | L'empaquetage Android attendra que l'application soit plus riche. |
| **Architecture : un fichier par niveau** | Au prochain import, chaque niveau aura son `cards-<niveau>.json`, chargé à la demande. À mettre en place **au moment de l'import**, pas avant. |

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

## 2. Plus tard

| Chantier | Pourquoi attendre |
|---|---|
| **Niveaux HSK suivants** | Les listes sont déjà téléchargées (`..\hanzi-db\filtres\` : HSK 2 → 7-9). On les importera quand le contenu actuel sera traduit et l'architecture par niveau en place. |
| **Chinois traditionnel** | Champ `traditional` + bouton d'affichage. |
| **Audio** | Prononciations enregistrées, ou de synthèse. |
| **APK** | Via PWABuilder ou Bubblewrap, une fois le contenu étoffé. |

---

## 3. Architecture — décidé : un fichier par niveau

Tout tient aujourd'hui dans `data/cards.json` : 302 Ko pour 253 fiches, soit
environ **1,1 Ko par fiche**. Les six niveaux HSK représenteraient ~2 000 fiches
≈ 2,2 Mo — trop lourd à charger d'un bloc sur un téléphone.

**Choix retenu** : un fichier par niveau (`data/cards-hsk1.json`,
`cards-hsk2.json`…), chargé à la demande. Le mode hors ligne devra mettre en
cache les niveaux déjà ouverts, et l'écran d'accueil devra permettre de choisir
le niveau — la page Thèmes s'en chargera naturellement.

Tant qu'il n'y a qu'un niveau, un fichier unique reste plus simple : le découpage
se fera **pendant** le prochain import.

---

## 4. Empaquetage APK (plus tard)

- **[PWABuilder](https://www.pwabuilder.com)** (en ligne) ou **Bubblewrap** (Node + JDK) produisent un `.apk` signé depuis la PWA publiée.
- Déjà en place : GitHub Pages en HTTPS, `manifest.json` complet, icônes 192/512, `display: standalone`.
- À prévoir : un identifiant d'application (ex. `io.github.mattpiwang.cartes`), une clé de signature à conserver, et une nouvelle version à republier à chaque évolution.

---

## 5. À trancher à la prochaine révision

> Note laissée par Matt le 13/10, après l'épuration de l'écran.

L'écran ne garde plus que la carte, et tout ce qui commande est dans le menu
burger, rangé en quatre catégories (*Cette carte*, *Parcourir*, *Progression*,
*Apparence*). Quatre pistes sont ouvertes, aucune n'est tranchée.

### a. Que faire ensuite ?

Reprendre la feuille de route — niveaux HSK suivants, chinois traditionnel,
audio, APK — ou continuer d'abord sur l'interface ? Les deux se défendent : le
contenu appelle l'interface (un sélecteur de niveau deviendra nécessaire), et
l'interface est encore fraîche dans nos têtes.

### b. Une barre de boutons en bas ?

Au lieu du burger : les commandes principales toujours visibles sous la carte,
sans rien ouvrir. À mettre en balance avec la place qu'elles prendraient — on
vient justement de gagner toute la hauteur de l'écran, et une barre fixe
mangerait une partie de ce gain à chaque carte.

### c. Une page par bouton ?

Chaque entrée du menu ouvrirait sa propre page (thèmes, progression,
apparence…) plutôt que d'empiler les commandes dans le panneau. Le menu
resterait court et lisible, mais on multiplierait les écrans à maintenir — et
chaque page devrait refaire le travail de thème et de retour.

### d. Une arborescence de menu ?

Des sous-menus, par exemple *Progression* → sauvegarder / restaurer /
réinitialiser. Plus clair à mesure que les commandes s'ajoutent, au prix d'un
ou deux appuis supplémentaires pour y arriver.

