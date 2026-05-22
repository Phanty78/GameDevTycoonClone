# Données de jeu (dataminées)

Tables de référence pour la couche domaine (calcul des scores). Issues du datamining
communautaire de Game Dev Tycoon. Usage **perso/éducatif** pour ce clone — non redistribuées
comme produit officiel.

## Fichiers

| Fichier | Contenu |
|---|---|
| `genres.json` | 6 genres + ratio Tech/Design idéal (`idealTechDesignRatio`) |
| `topics.json` | 51 sujets + matrice d'affinité genre (1.0 = great, 0.6 = mauvais combo) + adéquation audience |
| `sliders.json` | 9 curseurs de dev, en 3 phases, avec part Design/Tech (`designShare`) |
| `genre-sliders.json` | Importance de chaque curseur par genre (0.6–1.0) |
| `platforms.json` | ~29 plateformes : pondérations genre/audience, techLevel, dates, licence, marché |
| `constants.json` | Tailles de jeu + constantes des algorithmes (game score, review, ventes) |

> L'affinité genre×sujet (ancien `combos.json`) est désormais **dans `topics.json`** (`topic.genre[indexGenre]`).

## Comment c'est utilisé (côté domaine)

1. L'effort du joueur (9 curseurs) × `designShare` → `designScore` et `techScore`.
2. Ratio T/D produit comparé à `idealTechDesignRatio` du genre → bonus/pénalité.
3. Importance des curseurs (`genre-sliders.json`) → pénalité si on pousse un curseur sans importance / si on néglige un important.
4. Affinité genre×sujet (`topics.json` → `genre[]`) → great combo = haute.
5. Aléa ±5 % (cf. `docs/DESIGN.md` §6).

`platforms.json` et `constants.json` servent surtout post-MVP (ventes détaillées, audiences, époques).

## Sources

- **gdt-calc** (`gdtcalc.js`) — source la plus riche : 50 topics, 26 plateformes (pondérations genre/audience + techLevel), `developmentFocus` 9 curseurs par genre, `techDesignRatio`, `sizeConstants`, formules score/review.
  `raw.githubusercontent.com/rollersteaam/gdt-calc/master/`
- **Wiki Fandom via `api.php?action=parse`** (le HTML renvoie 403, l'API non) — dates/licence/audience des plateformes, Sales Algorithm, Raw Data.
- **GDTPlus** (`Kieran6670/GDTPlus`) — `startAmount`/`unitsSold`/`licencePrize` réels de 13 plateformes.
- **gdt-modAPI** (`greenheartgames/gdt-modAPI`) — schéma officiel des champs (plateformes, topics).
- **GDT-Expansion-Pack** (`BasvanE`) — confirmation du schéma + valeurs.
- attackofthefanboy.com, greenheart forum, steam — recoupements combos/sliders/audience.

## Lacunes connues (à compléter / calibrer)

- **Plateformes récentes** (`oya`, `mbox-one`, `swap`, `playsystem-5`) : pondérations genre/audience inconnues (absentes de gdt-calc) → `null`, voir `_gap`.
- **`sliders.json` (split Design/Tech)** : valeurs largement citées mais **approximatives** ; gdt-calc ne stocke pas ce split (il suppose les curseurs optimaux). Source alternative (Steam dev-stage) donne des splits proches mais non identiques. À trancher au calibrage.
- **Genre×audience** : GDT n'a **pas** de matrice dure genre×audience ; l'adéquation passe par `topic.audience` et `platform.audienceWeightings`.
- **Valeurs `topics.json`** : assemblées depuis gdt-calc, à vérifier ponctuellement.
- **`constants.json`** : `Raw_Data_for_Sales_Algorithm` taggé v1.3.9 ; les versions récentes (1.6.x) peuvent différer légèrement.
- **Sujets d'extension** (~70 de plus) existent via mods, non inclus (hors base game).
