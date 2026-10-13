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

## 1. À faire maintenant

### Contenu

| Priorité | Chantier | Détail |
|---|---|---|
| ★★★ | **Sens en français** | Traduire les 212 définitions anglaises. Tant qu'une fiche n'est pas traduite, l'application affiche « sens à compléter » — jamais l'anglais. |
| ★★★ | **Étymologies en français** | Même traitement : les indices de Make Me a Hanzi sont souvent de jolies images (« une femme 女 avec un fils 子 »). |
| ★★ | **Mots d'exemple pour les fiches importées** | Remplir le champ `words`, vide sur les 212 fiches importées, depuis [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (~120 000 entrées libres). |

### Fonctionnalités

| Priorité | Chantier | Détail |
|---|---|---|
| ★★★ | **Ordre des traits animé** | [hanzi-writer](https://hanziwriter.org) + les tracés vectoriels `graphics.txt` de Make Me a Hanzi : mode démonstration, puis quiz (tracer au doigt). |
| ★★★ | **Répétition espacée (SM-2)** | Remplacer le compteur à 3 états par de vrais intervalles : échéance par fiche, file « à revoir aujourd'hui ». |
| ★★ | **Revoir seulement les cartes non sues** | L'entrée existe déjà dans le menu (`index.html?review=1`) ; à compléter d'un raccourci clavier et d'un moyen de revenir en arrière. |
| ★★ | **Sauvegarde de la progression** | Export / import d'un fichier JSON : changer de téléphone sans rien perdre. |
| ★★ | **Recherche** | Par caractère, pinyin, sens ou radical. |
| ★ | **Statistiques** | Fiches apprises, série de jours, progression par thème (la page Thèmes en montre déjà l'essentiel). |

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
