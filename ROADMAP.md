# Feuille de route — Cartes 汉字

**État actuel** : 253 fiches (41 écrites à la main en français + 212 importées du HSK 1),
application statique sans dépendance, installable en PWA, progression locale au navigateur.

---

## 1. Contenu

| Priorité | Chantier | Détail | Effort |
|---|---|---|---|
| ★★★ | **Sens en français** | Les 212 fiches importées n'ont qu'une définition **anglaise**. Traduction par lots via une API LLM, l'anglais restant en secours (`meaningEn`). | script + relecture |
| ★★★ | **Niveaux HSK suivants** | Listes déjà téléchargées dans `..\hanzi-db\filtres\` : HSK 2 (125), 3 (284), 4 (441), 5 (431), 6 (413), 7-9 (1 148). Une commande par niveau. | 1 commande |
| ★★ | **Mots d'exemple** pour les fiches importées | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (~120 000 entrées) pour remplir le champ `words`, aujourd'hui vide sur ces fiches. | script |
| ★★ | **Étymologies en français** | Même traitement que les sens : l'indice anglais est souvent une jolie image (« une femme 女 avec un fils 子 »). | avec la traduction |
| ★ | **Chinois traditionnel** | Champ `traditional` + bouton d'affichage. | petit |

## 2. Fonctionnalités

| Priorité | Chantier | Détail | Effort |
|---|---|---|---|
| ★★★ | **Ordre des traits animé** | [hanzi-writer](https://hanziwriter.org) + `graphics.txt` de Make Me a Hanzi (tracés vectoriels pour ~9 000 caractères). Deux modes : démonstration, puis **quiz** (tracer au doigt). C'est le vrai manque pour apprendre à écrire. | moyen |
| ★★★ | **Répétition espacée (SM-2)** | Remplacer le compteur à 3 états par de vrais intervalles : échéance par fiche, file « à revoir aujourd'hui », boîtes de Leitner. | moyen |
| ★★ | **Sauvegarde de la progression** | Export / import d'un fichier JSON : changer de téléphone sans tout perdre. | petit |
| ★★ | **Recherche** | Par caractère, pinyin, sens ou radical. | petit |
| ★ | **Statistiques** | Nombre de fiches apprises, série de jours, progression par catégorie. | petit |
| ★ | **Audio** | Prononciations (fichiers locaux ou synthèse). | moyen |

## 3. Architecture — à trancher avant de grossir

Tout le jeu tient aujourd'hui dans **`data/cards.json`** : 302 Ko pour 253 fiches,
soit environ **1,1 Ko par fiche**.

Les six niveaux HSK représenteraient **~2 000 fiches ≈ 2,2 Mo** : c'est lourd à charger
sur un téléphone, et le mode hors ligne devrait tout mettre en cache.

Deux options le jour où on dépasse ~1 000 fiches :

1. **Un fichier par niveau** (`cards-hsk1.json`, `cards-hsk2.json`…) chargé à la demande — simple, garde le hors ligne.
2. **Un index + des paquets** (chargement par lots de 200 fiches) — plus fluide, plus complexe.

**Recommandation** : l'option 1, quand le besoin arrive. Pas avant.

## 4. Empaquetage APK (plus tard)

Une fois le contenu et les fonctionnalités étoffés, et le site publié en HTTPS :

- **[PWABuilder](https://www.pwabuilder.com)** (en ligne) ou **Bubblewrap** (Node + JDK) produisent un `.apk` signé à partir de la PWA.
- Prérequis déjà en place : site publié (GitHub Pages), `manifest.json` complet, icônes 192/512, `display: standalone`.
- À prévoir : un identifiant d'application (ex. `io.github.mattpiwang.cartes`), une clé de signature à conserver, et une nouvelle version à republier à chaque évolution.

---

## Ordre de travail proposé

1. 📈 **Importer HSK 2** (une commande) — pour sentir la montée en volume et décider de l'architecture.
2. 🇫🇷 **Traduire les sens en français** — le gain de qualité le plus visible.
3. ✍️ **Ordre des traits** — la fonctionnalité la plus utile pour apprendre.
4. 🔁 **SM-2** — pour que la révision devienne efficace.
5. 📦 **APK** — quand le contenu sera suffisant.
