# Architecture

*Relevé le 19/10 sur le code de la **V1.48**. Rien de théorique ici : chaque
ligne a été vérifiée dans les fichiers avant d'être écrite.*

## Le principe : deux pages, une application

`index.html` et `theme.html` partagent **la même feuille de style**, **le même
stockage local** et **la même barre de navigation**. L'application (les cartes)
vit dans `app.js` et n'est chargée que par `index.html` ; la page Thèmes a son
propre script en ligne, plus léger (tableau de bord, recherche, thèmes).

```
hanzi-cards/
├── index.html          l'écran des cartes (app.js)
├── theme.html          le tableau de bord (script en ligne)
├── assets/
│   ├── style.css       la feuille commune
│   ├── app.js          l'application
│   ├── fonts/          les polices chinoises de la carte
│   └── data/           (vide)
├── data/
│   ├── cards-hsk1.json · cards-hsk2.json · cards-hsk3.json
│   └── …               (mots choisis, traductions, phrases au fil du pipeline)
├── service-worker.js   le cache, versionné à chaque livraison
├── cartes-mobile.html  la version hors ligne, engendrée par build-mobile.ps1
├── test-cartes.js      le harnais (37 contrôles), sans dépendance
└── ROADMAP.md · README.md · ARCHITECTURE.md
```

## L'arborescence du corps

### `index.html`

```
body
├── main.wrap                   la carte (recto, verso, glissement)
├── div.page#accueil            ← une PAGE : le nom, le champ de recherche
├── div.page#revoir             ← une PAGE : la grille des fiches « à revoir »
└── footer.bas                  ← la barre et ses feuilles
    ├── .bar                    la fine barre de progression
    ├── nav.onglets             les cinq boutons
    ├── .feuille[data-feuille="reviser"]
    ├── .feuille[data-feuille="parcourir"]
    ├── .feuille[data-feuille="niveau"]
    ├── .feuille[data-feuille="reglages"]
    └── p.version               « Version 148 — HSK 1 / HSK 2 / HSK 3 »
```

### `theme.html`

```
body.page-themes
├── div.page#accueil            ← une PAGE : nom + recherche sur le pinyin
└── footer.bas
    ├── nav.onglets
    ├── .feuille[data-feuille="reviser"]     info du paquet + lien vers les cartes
    ├── .feuille[data-feuille="parcourir"]
    ├── .feuille[data-feuille="niveau"]
    └── .feuille[data-feuille="reglages"]    阴/阳 · 字/卡 · Progression
```

**Feuille ou page ?** Une **feuille** (`div.feuille`) est un panneau posé
au-dessus de la barre, dans le pied de page : elle s'ouvre et se referme.
Une **page** (`div.page`) est fixée sur tout l'écran, sœur de `<main>` : elle
recouvre la carte, et la barre passe au-dessus d'elle (`z-index`).

## La règle de navigation

> **La barre ne navigue jamais.** Un bouton de `nav.onglets` ouvre ou referme
> une feuille, ou bascule une page. Seuls les **liens à l'intérieur des
> feuilles** changent de page.

C'est `ouvrirFeuille(cle)` qui aiguille : `accueil` et `revoir` sont les deux
**pages** (traitées ensemble), tout le reste sont des **feuilles**.

```
ouvrirFeuille(cle)
├── cle ∈ {accueil, revoir}
│     ├── fermerFeuilles()            (on referme tout)
│     ├── remplirRevoir()             (si « revoir »)
│     ├── page.hidden = !page.hidden  (un second appui referme)
│     └── body.page-ouverte           (masque la carte)
└── sinon
      ├── on cache les deux pages
      └── on ouvre la feuille demandée, et on éteint les autres
```

## Les dépendances, lien par lien

| Lien | Cible | Éléments (ids) | Code | État & stockage |
|---|---|---|---|---|
| **Réviser** | feuille | `#deck-name` `#position` `#aujourdhui` `#statut-revoir` `#statut-sais` | `ouvrirFeuille` → `updateStats` → `statuts` | `state.cards`, `state.progress` (`hanzi-cards-v1`), `state.jour` (`hanzi-jour`) |
| **Parcourir** | feuille | liens vers `theme.html`, `index.html?review=1`, plus `#lien-revoir` | `brancherLienRevoir` → `statuts().aRevoir` (garde-fou) → `ouvrirFeuille('revoir')` | `state.progress` |
| **Accueil** | **page** | `#accueil-recherche`, `#accueil-resultats` | `brancherPages` → `brancherRechercheAccueil` → `chercherAccueil` → `sansTons` | `state.view`, `rechercheContenu` (`hanzi-recherche`) |
| **Niveau** | feuille | quatre liens `?niveau=hsk1…tout` | aucun : les liens rechargent → `niveauDemande` → `start` | les fichiers `data/cards-*.json` |
| **Réglages** | feuille | `#theme-toggle`/`#theme-label`, `#recherche-contenu`/`#recherche-label`, `#export` `#import` `#import-file` `#reset` `#sauvegarde` | `depuisLeMenu`, `brancherReglageRecherche`, `exporterProgression`, `restaurerProgression`, `resetProgress` | `hanzi-theme`, `hanzi-recherche`, `hanzi-cards-v1`, `hanzi-session`, `hanzi-jour` |
| **Revoir** *(par Parcourir, pas par la barre)* | **page** | `#revoir-liste` (grille de mini-cartes) | `remplirRevoir` + le clic de `brancherLienRevoir` | `state.cards`, `state.progress` |

Sur `theme.html`, les cinq boutons ouvrent des feuilles ou la page Accueil ;
son script ne connaît ni les cartes ni la progression en mémoire, il lit le
stockage local.

## Les cinq clés de stockage

| Clé | Contenu | Écrite par |
|---|---|---|
| `hanzi-cards-v1` | la progression SM-2 : une fiche par caractère (`n`, `ef`, `i`, `due`, `seen`) | `app.js` |
| `hanzi-session` | niveau, paquet, position : on rouvre où on s'est arrêté | `app.js` |
| `hanzi-jour` | le décompte du jour (vues, je sais, à revoir), remis à zéro chaque matin | `app.js` |
| `hanzi-theme` | `clair` ou rien (sombre par défaut) | les deux pages, même clé |
| `hanzi-recherche` | `pinyin` ou `contenu` — le mode de recherche | les deux pages, même clé |

## Les trois statuts

`statuts()` partitionne le paquet chargé. « Vue » se lit dans `seen`, **pas**
dans `n` (qui compte les réussites consécutives et retombe à zéro sur un échec).

| Statut | Condition |
|---|---|
| **À voir** | `seen = 0` |
| **À revoir** | `seen > 0` et `n = 0` (dernier jugement « à revoir ») |
| **Je sais** | `seen > 0` et `n > 0` (dernier jugement « je sais ») |

## La recherche

| Mode | Ce qui est comparé |
|---|---|
| **字 (pinyin)** — par défaut | le pinyin seul, **tons ignorés**, à l'égalité : « yi » ramène yī, yí, yǐ, yì |
| **卡 (contenu)** | en plus : sens, mots d'exemple, composants, phrase et sa note, en **début de mot** |

Un caractère chinois se cherche tel quel, dans le caractère comme dans la phrase
(c'est ainsi qu'un chéngyǔ de quatre caractères se retrouve).

## Les invariants

À vérifier avant chaque livraison, sans exception :

1. **trois numéros de version alignés** — `service-worker.js` (le cache),
   `assets/app.js` (`VERSION`), `theme.html` (`VERSION_PAGE`) ;
2. **`node test-cartes.js`** au vert (37 contrôles) — il exécute le vrai
   `app.js` dans un faux DOM ;
3. **`build-mobile.ps1`** après toute modification : le fichier hors ligne
   intègre le CSS, le JS et les données, et échoue franchement si le CSS
   n'a pas été intégré ;
4. **le BOM** des scripts PowerShell : sans lui, PowerShell 5.1 les lit en ANSI
   et refuse de démarrer ;
5. **`style.css?v=N`** dans les deux pages : un vieux style en cache ne peut
   plus se mêler à un HTML neuf.
