# Cartes français / chinois — 汉字

Application de révision : **recto = le caractère**, **verso = pinyin, radicaux,
exemples de mots et étymologie**. Statique, sans dépendance, installable sur un
téléphone.

```
index.html          la page
assets/style.css    le design, et l'animation de retournement
assets/app.js       la logique de révision
data/cards.json     le jeu de cartes (41 caractères)
manifest.json       déclaration PWA : nom, icônes, mode plein écran
service-worker.js   cache hors ligne (voir § 5 pour la condition HTTPS)
icons/              icônes de l'application, générées avec .NET
build-mobile.ps1    produit la version « un seul fichier »
serve.cmd           double-clic : sert le site, en local et sur le réseau
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
| `category` | Sert à construire les filtres automatiquement. |
| `components` | Les radicaux : `[caractère, glose, rôle]`, le rôle valant `sens`, `son`, `pictogramme` ou `indicateur`. |
| `words` | Deux exemples : `[mot, pinyin, traduction]`. |
| `etymology` | `[type, explication]`. |
| `note` | Facultatif : remarque affichée sous l'étymologie. |

Les **catégories ne sont pas déclarées** : elles sont déduites des cartes. Tu
ajoutes une carte avec `"category": "Nourriture"`, le filtre apparaît tout seul.

---

## 2. Comment ça marche

**Le ton est déduit, jamais stocké.** `app.js` cherche le diacritique du pinyin
(`ǎ ě ǐ ǒ ǔ ǚ` → 3e ton) dans une petite table. Une seule source de vérité, et
les exemples de mots en profitent aussi.

**La progression est un compteur à trois états** par caractère, gardé dans le
`localStorage` du navigateur :

| État | Déclencheur | Effet |
|---|---|---|
| 0 | jamais vue | compte dans « à revoir » |
| 1 | bouton **À revoir** | renvoyée au début |
| 2 → 3 | bouton **Je sais** | monte d'un cran, sort de « à revoir » à 3 |

**Le filtre « À revoir »** n'affiche que les cartes non maîtrisées (état < 3), et
une carte validée en sort immédiatement.

**Le retournement** est une rotation 3D en CSS pur. Le verso défile tout seul si
l'étymologie est longue. Les **couleurs de tons** suivent la convention
habituelle : 1 rouge, 2 orange, 3 vert, 4 bleu, ton neutre en gris.

**Au clavier** : `Espace` retourne · `←` `→` naviguent · `1` à revoir · `2` je sais.

---

## 3. Ajouter ou modifier des cartes

Ouvre `data/cards.json` et ajoute un objet dans `cards`. Rien d'autre à modifier :
ni liste de catégories, ni index, ni build.

La tâche VS Code **« Vérifier le fichier de cartes (JSON) »**
(`Ctrl+Shift+P` → *Run Task*) signale une virgule oubliée ou un champ manquant.

Après une modification, relance **`build-mobile.ps1`** si tu utilises la version
hors ligne du § 5.

---

## 4. Lancer le site

```powershell
# 1. double-clic sur serve.cmd         (port 8082, local + réseau)
# 2. ou dans VS Code : Ctrl+Shift+B    (port 8002)
# 3. ou la commande brute
python -m http.server 8002          # à lancer depuis le dossier du projet
```

Un `index.html` ouvert par double-clic (en `file://`) **ne fonctionnera pas** :
le navigateur interdit à une page locale de lire `data/cards.json`. C'est la
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
.\build-mobile.ps1          # produit cartes-mobile.html (~41 Ko)
```

Ce fichier contient la page, le style, la logique **et les 41 fiches**. Copie-le
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

Les 41 fiches ont été **rédigées à la main**, pas extraites d'une base
lexicographique. Ce qui est solide : les caractères, le pinyin (vérifié : les 41
portent leur marque de ton), les sens et les mots d'exemple.

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
| **Beaucoup plus de vocabulaire** | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) : dictionnaire libre, ~120 000 entrées. |
| **Décomposition officielle** | La base **Make Me a Hanzi** donne composants et tracés pour ~9 000 caractères. |
| **Répétition espacée réelle** | Remplacer le compteur à trois états par un algorithme SM-2 (intervalles croissants). |
| **Chinois traditionnel** | Ajouter un champ `traditional` et un bouton d'affichage. |
| **Audio** | Un simple `<audio>` si tu enregistres les prononciations. |

## 8. Limites connues

- **41 caractères** : un premier jeu, pas un cursus.
- La progression est **locale au navigateur** : pas de synchronisation entre appareils, et elle disparaît si tu vides les données du site.
- Pas de répétition espacée à intervalles : « Je sais » monte d'un cran, sans notion de délai.
- En `file://` (version § 5-B), la progression peut ne pas survivre à la fermeture.
