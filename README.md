# Cartes français / chinois — 汉字

Application de révision : **recto = le caractère**, **verso = pinyin, radicaux,
exemples de mots et étymologie**. Statique, sans dépendance, installable sur un
téléphone.

```
index.html          la page
theme.html          la page « Thèmes » (atteinte par l'onglet Parcourir)
assets/style.css    le design, et l'animation de retournement
assets/app.js       la logique de révision
data/cards-hsk1.json  niveau HSK 1 (253 caractères : 41 à la main, 212 importés)
data/cards-hsk2.json  niveau HSK 2 (125 caractères importés, tout en français)
manifest.json       déclaration PWA : nom, icônes, mode plein écran
service-worker.js   cache hors ligne (voir § 5 pour la condition HTTPS)
icons/              icônes de l'application, générées avec .NET
build-mobile.ps1    produit la version « un seul fichier »
serve.cmd           double-clic : sert le site, en local et sur le réseau
import-hanzi-db.ps1 importe la base Make Me a Hanzi, filtrable par liste
traduire.ps1        fait traduire les fiches par l'assistant OpenClaw
build-exemples.js   choisit les mots d'exemple dans les listes HSK
apply-exemples.js   écrit ces mots dans le fichier du niveau
generer-phrases.ps1 demande à Ziya une phrase d'exemple par fiche (drôle ou chéngyǔ)
apply-phrases.js    écrit ces phrases dans le fichier du niveau
verifier-phrases.js contrôle les phrases : caractère présent, pinyin, français
```

---

## 1. Ce que contient une carte

```json
{
  "char": "好",
  "pinyin": "hǎo",
  "meaning": "bon, bien",
  "category": "Famille & maison",
  "components": [
    ["女", "femme", "sens"],
    ["子", "enfant", "sens"]
  ],
  "words": [
    ["你好", "nǐ hǎo", "bonjour"],
    ["好看", "hǎo kàn", "beau, joli"]
  ],
  "etymology": [
    "会意 — idéogramme composé",
    "Une femme et un enfant réunis : l'harmonie du foyer, d'où « bon, bien »."
  ],
  "note": "Prononcé hào, le même caractère signifie « aimer »."
}
```

| Champ | Rôle |
|---|---|
| `char` | Le caractère, affiché au recto. |
| `pinyin` | La prononciation, en grand au verso (colorée selon le ton). |
| `meaning` | Le sens en français. |
| `category` | Classe la carte ; affiché à côté de la position. |
| `components` | Les radicaux : `[caractère, glose, rôle]`, le rôle valant `sens`, `son`, `pictogramme` ou `indicateur`. |
| `words` | Deux exemples : `[mot, pinyin, traduction]`. |
| `etymology` | `[type, explication]`. |
| `note` | Facultatif : remarque affichée sous l'étymologie. |

Les **catégories ne sont pas déclarées** : elles sont simplement lues sur les
cartes. Une carte avec `"category": "Nourriture"` s'affiche avec cette mention,
sans rien d'autre à tenir à jour.

---

## 2. Comment ça marche

**Le ton est déduit, jamais stocké.** `app.js` cherche le diacritique du pinyin
(`ǎ ě ǐ ǒ ǔ ǚ` → 3e ton) dans une petite table. Une seule source de vérité, et
les exemples de mots en profitent aussi.

**La progression suit SM-2** (répétition espacée), caractère par caractère, dans
le `localStorage` du navigateur :

| Champ | Rôle |
|---|---|
| `n` | réussites d'affilée |
| `ef` | facteur de facilité : 2,5 au départ, borné entre 1,3 et 2,8 |
| `i` | intervalle courant, en jours |
| `due` | date de la prochaine révision |
| `seen`, `at` | nombre de révisions, et date de la dernière |

Une réponse **Je sais** (ou un glissement à droite) enchaîne 1 jour, 6 jours,
puis `i x ef`. Une réponse **À revoir** (glissement à gauche) ramène à un jour et
abaisse la facilité : les intervalles suivants raccourcissent.

« À revoir » veut donc dire **dû aujourd'hui**, pas « jamais sue ». Une carte est
considérée **sue** à partir de trois semaines d'intervalle. Les progressions de
l'ancien compteur à trois états sont migrées automatiquement au chargement.

**Il n'y a plus de filtres** : ils ont été retirés volontairement pour épurer
l'écran. Le paquet se parcourt à la suite — ou mélangé avec le bouton
l'entrée « Mélanger » du menu — et le compteur de l'en-tête indique combien de
cartes restent à revoir.

**L'écran ne garde que la carte** : les deux jugements, les liens et les outils
sont descendus dans la barre du bas, rangée en quatre onglets :

La barre du bas porte les informations (niveau, position, compteurs), une barre
de progression fine, et **quatre onglets**. Chaque onglet ouvre sa feuille
juste au-dessus, et un second appui la referme :

| Onglet | Sa feuille |
|---|---|
| **Réviser** | Je sais (2), À revoir (1), Mélanger |
| **Parcourir** | la page Thèmes, les cartes à revoir, toutes les cartes, et le choix du niveau |
| **Progression** | Sauvegarder, Restaurer, Réinitialiser |
| **Réglages** | le thème clair ou sombre (l'interrupteur yin / yang) |

La page **Thèmes** liste chaque lot de vocabulaire avec sa progression et lance
la révision du lot choisi. Le choix passe par l'adresse, sans rien ajouter à
l'écran principal :

| Adresse | Ce qu'on révise |
|---|---|
| `index.html` | toutes les cartes |
| `index.html?theme=Nature` | un thème (le nom exact de la catégorie) |
| `index.html?review=1` | les cartes dues aujourd'hui |

Ces adresses sont **partageables** : un lien suffit pour envoyer un thème à
quelqu'un.

**Le menu contient aussi l'interrupteur 阴 / 阳** — l'ombre et la lumière, pour
le mode sombre et le mode clair. Le curseur indique le mode en cours, et le
caractère du mode actif passe en doré. Le choix est conservé dans le navigateur
et appliqué **avant le premier affichage** (petit script dans l'en-tête des deux
pages), donc aucun flash clair au chargement quand on a choisi le sombre.

Le mode clair s'appelle **papier de riz** : fond crème `#f3ecda`, encre de Chine
pour le grand caractère, or assombri pour que les titres restent lisibles — et
des **fibres dessinées en CSS** (deux dégradés répétés très pâles), donc aucune
image à charger.

Comme toute la feuille de style ne dépend que de variables CSS, **ajouter un
thème revient à ajouter un bloc `[data-theme="…"]`** dans `assets/style.css`.

**Le retournement** est une rotation 3D en CSS pur. Le verso défile tout seul si
l'étymologie est longue. Les **couleurs de tons** suivent la convention
habituelle : 1 rouge, 2 orange, 3 vert, 4 bleu, ton neutre en gris.

**Le glissement** (au doigt sur téléphone, ou à la souris sur ordinateur) refait
les deux boutons : la carte suit le doigt, pivote légèrement, une étiquette
apparaît — « Je sais » en vert à gauche quand on tire vers la droite, « À revoir »
en ambre à droite quand on tire vers la gauche — et au-delà d'environ un quart de
la largeur, la carte part de son côté avant de passer à la suivante. Un appui
bref sans déplacement reste un retournement. Le geste est **horizontal
uniquement** : le défilement vertical du verso continue de fonctionner.

**L'ordre des traits** s'anime à la demande, depuis un bouton au verso. La
bibliothèque [hanzi-writer](https://hanziwriter.org) (36 Ko) et les tracés
(`data/strokes.json`, 494 Ko, extraits de **Make Me a Hanzi**) ne sont
téléchargés qu'au premier usage — le reste du temps, ils ne coûtent rien.
« Rejouer » relance l'animation, « Tracer au doigt » passe en mode quiz. Le
carré 田字格 est dessiné en CSS, et les couleurs du tracé sont lues dans les
variables CSS : l'animation suit donc le thème clair comme le sombre.

⚠️ La version « un seul fichier » (§ 5-B) ne propose **pas** cette animation :
elle y ajouterait ~530 Ko. Elle est réservée à la version servie (serveur local,
ou GitHub Pages).

**Les mots d'exemple** des fiches importées viennent des **listes de vocabulaire
HSK** (~11 000 entrées : le programme officiel), avec la priorité aux mots courts
qui commencent par le caractère et aux niveaux bas ; le pinyin et la définition
viennent de **CC-CEDICT**, traduits en français. 244 fiches sur 253 en ont.

**La page Thèmes** (`theme.html`, atteinte par l'onglet *Parcourir*) réunit :

| Bloc | Contenu |
|---|---|
| **Où j'en suis** | ce qui est dû aujourd'hui, ce qui est su, pourcentage du jeu |
| **Prévision** | combien de cartes reviennent chaque jour, sur sept jours |
| **Chercher** | par caractère, pinyin, sens ou radical ; le résultat ouvre la carte voulue (`index.html?char=X`) |
| **Réviser par thème** | un lot de vocabulaire, ou seulement les cartes à revoir |

**Le menu permet aussi de sauvegarder la progression** (catégorie *Progression*) :
« Sauvegarder » télécharge un fichier JSON daté, « Restaurer » le relit après
confirmation. Utile pour changer de téléphone, ou avant de vider les données du
site.

**Au clavier** : `Espace` retourne · `←` `→` naviguent · `1` à revoir · `2` je sais.

---

## 3. Ajouter ou modifier des cartes

Ouvre le fichier du niveau (`data/cards-hsk1.json`) et ajoute un objet dans `cards`. Rien d'autre à modifier :
ni liste de catégories, ni index, ni build.

La tâche VS Code **« Vérifier le fichier de cartes (JSON) »**
(`Ctrl+Shift+P` → *Run Task*) signale une virgule oubliée ou un champ manquant.

Après une modification, relance **`build-mobile.ps1`** si tu utilises la version
hors ligne du § 5.

**Tu ne vois pas tes modifications ?** L'application s'installe en *service worker*
et met ses fichiers en cache. Recharge **deux fois** (la première mise à jour
remplace le cache, la seconde affiche la nouvelle version), ou ouvre une fenêtre
de **navigation privée** pour vérifier. En cas de doute, le numéro de cache est
en tête de `service-worker.js` : l'incrémenter force le rechargement chez tout le
monde — c'est pour cela qu'on est passé à `v2` avec la page Thèmes.

---

### Importer des centaines de fiches (base Make Me a Hanzi)

`import-hanzi-db.ps1` convertit la base libre **[Make Me a Hanzi](https://github.com/skishore/makemeahanzi)**
(9 574 caractères) au format de ce jeu de cartes. Elle fournit exactement les
mêmes champs : pinyin accentué, décomposition en radicaux, étymologie classée
(象形 / 会意 / 形声) et radical principal.

```powershell
# 1. un niveau HSK (le fichier de filtre liste les caractères voulus)
#    -Output compte : un fichier par niveau, chargé à la demande
.\import-hanzi-db.ps1 -FilterFile ..\hanzi-db\filtres\hsk2.txt -Category 'HSK 2' -Output data\cards-hsk2.json

# 2. tout d'un coup (9 500 fiches : lourd, ~15 Mo de JSON)
.\import-hanzi-db.ps1 -Category 'Tout'

# 3. voir le rendu sans toucher au vrai fichier
.\import-hanzi-db.ps1 -Limit 20 -Category 'Essai' -Output .\data\cards.test.json
```

| Option | Effet |
|---|---|
| `-FilterFile` | fichier texte listant les caractères voulus — **tout texte convient** (liste HSK, copier-coller, PDF converti) |
| `-Limit` | ne garder que les n premiers. **À éviter sans filtre** : l'ordre du fichier source est l'ordre Unicode, donc les caractères les plus rares arrivent en premier |
| `-Category` | nom du lot, affiché sur chaque fiche importée (ex. `HSK 1`) |
| `-Output` | autre fichier de sortie, pour tester |
| `-Replace` | repartir de zéro au lieu de compléter l'existant |

**Les fiches écrites à la main gagnent toujours** : un caractère déjà présent
(comme 好, avec son sens français et ses exemples) n'est jamais écrasé. L'ancien
fichier est sauvegardé dans `data/cards.backup.json` avant chaque écriture.

⚠️ **Les définitions et étymologies importées sont en anglais** — c'est la langue
de la source. L'application affiche le français quand il existe, et l'anglais
avec une petite mention `en` sinon. Le sens français peut être ajouté
progressivement, fiche par fiche.

### Les niveaux, un fichier chacun

Un fichier JSON par niveau, **chargé à la demande** : on ne télécharge que celui
qu'on révise. Le choix se fait dans le menu (catégorie *Niveau*) ou sur la page
Thèmes, et il est **retenu** d'une visite à l'autre (`?niveau=hsk2` dans
l'adresse, sinon `localStorage`).

| Niveau | Fichier | Fiches |
|---|---|---|
| HSK 1 | `data/cards-hsk1.json` | 253 (41 écrites à la main, 212 importées) |
| HSK 2 | `data/cards-hsk2.json` | 125 (importées) |

Le service worker ne met en cache que le niveau de base à l'installation ; les
autres sont mis en cache **au premier usage** — inutile de télécharger 105 Ko
pour un niveau qu'on n'ouvrira peut-être pas.

La progression, elle, est **commune** : elle est indexée par caractère, et un
caractère ne change pas de niveau.

### Les niveaux se comportent comme des collections

- **On choisit une collection** — HSK 1, HSK 2, ou **Tous les niveaux**, qui les
  réunit (378 fiches). Le choix est mémorisé.
- **Chaque fiche sait d'où elle vient** : son fichier déclare `niveau`, et la
  barre de position l'affiche quand plusieurs collections sont réunies
  (« Carte 12 / 378 · HSK 2 »).
- **Le filtrage par niveau est déjà là** : chaque niveau importé porte sa propre
  catégorie (`HSK 1`, `HSK 2`), donc `?niveau=tout&theme=HSK 2` ne révise que le
  HSK 2, et la page Thèmes liste les niveaux comme des lots.
- **La page Thèmes compte niveau par niveau** : « HSK 1 : 34 / 253 · HSK 2 :
  12 / 125 — tous niveaux : 46 / 378 ». Elle charge les niveaux en parallèle ;
  le service worker les garde ensuite.
- **Les compteurs de l'application portent sur la collection chargée** : en
  HSK 1, « à revoir » ne compte que les cartes HSK 1 dues. Celles de HSK 2
  attendent de l'autre côté.

**Listes HSK utilisées** : [HSK 3.0 de krmanik](https://github.com/krmanik/HSK-3.0)
— HSK 1 : 246 caractères · HSK 2 : 125 · HSK 3 : 284 · HSK 4 : 441 · HSK 5 : 431 ·
HSK 6 : 413 · HSK 7-9 : 1 148. Téléchargées dans `..\hanzi-db\filtres\`.

**Attribution** : les fiches importées viennent de Make Me a Hanzi, lui-même
dérivé d'Unihan et de polices Arphic sous licence permissive ; le champ `source`
de chaque fiche le mentionne.

## 4. Lancer le site

```powershell
# 1. double-clic sur serve.cmd         (port 8082, local + réseau)
# 2. ou dans VS Code : Ctrl+Shift+B    (port 8002)
# 3. ou la commande brute
python -m http.server 8002          # à lancer depuis le dossier du projet
```

Un `index.html` ouvert par double-clic (en `file://`) **ne fonctionnera pas** :
le navigateur interdit à une page locale de lire le fichier de fiches. C'est la
seule raison d'être du serveur — et c'est aussi ce que règle la version du § 5-B.

---

## 5. Installer sur le téléphone

Trois voies. La première est la seule où **tout** fonctionne.

### A. Hébergement statique — recommandé

Le dossier est prêt : manifeste, icônes et service worker en place, chemins
relatifs. Sur **[Netlify Drop](https://app.netlify.com/drop)**, tu glisses le
dossier `hanzi-cards` dans la page et tu obtiens une adresse `https://`.

| | |
|---|---|
| Installation | Android : Chrome → menu ⋮ → *Installer l'application*. iPhone : Safari → Partager → *Sur l'écran d'accueil*. |
| Hors ligne | **oui** — le service worker met tout en cache au premier chargement |
| Progression | conservée (origine `https`) |
| PC allumé | non |

C'est la seule voie qui coche les quatre cases, parce qu'un **service worker
exige une origine sécurisée** (`https`, ou `localhost`).

### B. Fichier unique, sans réseau

```powershell
.\build-mobile.ps1          # produit cartes-mobile.html (~327 Ko)
```

Ce fichier contient la page, le style, la logique **et les 253 fiches**. Copie-le
sur le téléphone (USB, OneDrive, mail) et ouvre-le : aucun serveur, aucun réseau.

⚠️ **La progression risque de ne pas être conservée** : Chrome interdit
`localStorage` aux pages ouvertes en `file://` (Firefox pour Android l'autorise).
L'app reste pleinement utilisable, mais elle peut repartir de zéro à chaque
ouverture.

### C. Réseau local

```powershell
.\serve.cmd                 # écoute sur toutes les interfaces, port 8082
```

Puis sur le téléphone, **même Wi-Fi que le PC** : `http://<IP-du-PC>:8082`.
Le script affiche l'adresse à utiliser. Le PC doit rester allumé.

Deux réserves à connaître :

1. **Le pare-feu Windows doit autoriser le port.** Aucune règle n'existe pour
   `python.exe` sur cette machine. Dans un PowerShell **administrateur** :
   ```powershell
   New-NetFirewallRule -DisplayName "Cartes 汉字" -Direction Inbound -Protocol TCP -LocalPort 8002,8082 -Action Allow -Profile Private
   ```
2. **Pas de mode hors ligne** : un service worker refuse de s'enregistrer sur
   `http://<IP-du-PC>` (ni `https`, ni `localhost`). L'app s'installe et
   fonctionne, mais uniquement tant que le PC sert les fichiers.

---

## 6. État des données — à lire

Le jeu compte **253 fiches**, de deux origines bien distinctes :

- **41 fiches rédigées à la main** — les caractères les plus courants. Tout est
  vérifié : caractères, pinyin accentué, sens **en français**, mots d'exemple et
  étymologie. C'est la partie la plus soignée.
- **337 fiches importées** de la base libre Make Me a Hanzi (212 en HSK 1, 125 en HSK 2) —
  pinyin accentué, radicaux et étymologie classée, mais **définitions en anglais**
  et **sans mots d'exemple**. L'application les signale par une petite mention `en`.

Les **classifications étymologiques** suivent la tradition du *Shuowen Jiezi*
(象形 pictogramme, 指事 indicateur, 会意 composé d'idées, 形声
phonétique-sémantique, 假借 emprunt). C'est la taxonomie enseignée partout, mais
certains cas sont **débattus** — l'étymologie de 風 ou de 安 relève en partie de
l'interprétation ancienne. À prendre comme un support pédagogique solide, pas
comme une source académique.

## 7. Pistes d'enrichissement

| Envie | Piste |
|---|---|
| **Ordre des traits animé** | [hanzi-writer](https://hanziwriter.org) — un JSON par caractère, fonctionne hors ligne. |
| **Plus de vocabulaire** | Importer les niveaux suivants : `.\import-hanzi-db.ps1 -FilterFile ..\hanzi-db\filtres\hsk2.txt -Category 'HSK 2'` — les listes HSK 1→7-9 sont déjà téléchargées (§ 3). |
| **Mots d'exemple pour les fiches importées** | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) : dictionnaire libre, ~120 000 entrées, pour remplir le champ `words`. |
| **Sens en français partout** | Traduire les 212 définitions anglaises — faisable par lots avec une API de traduction. |
| **Répétition espacée réelle** | Remplacer le compteur à trois états par un algorithme SM-2 (intervalles croissants). |
| **Chinois traditionnel** | Ajouter un champ `traditional` et un bouton d'affichage. |
| **Audio** | Un simple `<audio>` si tu enregistres les prononciations. |

## 8. Limites connues

- **378 caractères** : le HSK 1 complet et le HSK 2. Pour lire couramment, il faut viser
  2 500 à 3 000 caractères (voir § 3 pour importer les niveaux suivants).
- La progression est **locale au navigateur** : pas de synchronisation entre appareils, et elle disparaît si tu vides les données du site.
- Pas de répétition espacée à intervalles : « Je sais » monte d'un cran, sans notion de délai.
- En `file://` (version § 5-B), la progression peut ne pas survivre à la fermeture.
