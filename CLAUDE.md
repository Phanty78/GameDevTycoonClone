# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

Clone web de **Game Dev Tycoon**. Le dépôt est en phase de **cadrage** : il ne contient pour l'instant que la conception (`docs/DESIGN.md`) et les **données de jeu dataminées** (`/data`). Aucun code applicatif n'existe encore — le plan d'implémentation est détaillé dans `docs/DESIGN.md` §10.

Avant d'écrire du code, lire `docs/DESIGN.md` : c'est la source de vérité pour l'architecture, le modèle de données, les routes API et les formules de jeu.

## Stack cible (à mettre en place)

Monorepo TypeScript tout-Bun :

| Couche | Choix |
|---|---|
| Runtime / build | **Bun** (runtime back + bundler front, pas de Vite au départ) |
| Front | **React + TypeScript** (UI minimale : formulaires + texte, aucune règle de jeu) |
| Back | **Hono** sur Bun, **JWT** pour l'auth |
| ORM / DB | **Drizzle** + **PostgreSQL** (Docker en dev, Railway en prod) |
| Lint / format | **Biome** (remplace ESLint + Prettier) |
| Tests | **`bun:test`** — couche domaine testée en priorité |

Structure de dépôt (à plat, workspaces Bun ; le §7 du DESIGN proposait `/apps` + `/packages`,
on a tranché pour du plat — la résolution se fait par nom de paquet, pas par emplacement) :

```
/backend          API Hono/Bun + couche domaine (règles du jeu)   — @gdt/backend
/frontend         client React + TS (bundler Bun, pas de Vite)    — @gdt/frontend
/contracts        types partagés (inputs API, payloads) — PAS de logique — @gdt/contracts
/data             tables de jeu dataminées (JSON, déjà présentes)
/docs/DESIGN.md   source de vérité
/doc/niveau.md    suivi pédagogique (mode précepteur) — interne
```

Front et back importent les types via `@gdt/contracts` (workspace), jamais en chemin relatif.

## Règles d'architecture non négociables

Ces invariants pilotent tout le reste — les respecter dans tout code écrit :

- **Le back est autoritaire.** Toute la logique de jeu (formules, aléa, scores) vit côté back et n'est **jamais** exposée au front. C'est l'anti-triche central. Le front n'envoie que des *choix* et n'affiche que le payload renvoyé.
- **Couche domaine sans I/O.** Le calcul (design/tech/review/sales/revenue) est isolé dans une couche pure : pas de réseau, pas de DB. Elle prend `choix joueur + tables /data` → renvoie un résultat. C'est le seul endroit des règles, testable unitairement avec `bun:test`.
- **`packages/contracts` ne contient que des types**, pas de logique. Front et back partagent les contrats (inputs/payloads), pas l'algorithme.
- **`Game` n'a pas de `seasonId`** : la table est entièrement vidée à chaque reset de saison. Seul `Score` porte la saison (hall of fame). Voir le modèle de données et les règles de cycle de vie en §4.
- **Reset de saison** = transaction unique idempotente (clôturer saison active → vider `Game` → créer nouvelle saison). Déclenché par un cron Railway externe, pas in-process.

## Règles de style de code

- **Fonction ≤ 60 lignes.** Une fonction ne dépasse jamais 60 lignes. Au-delà, découper en sous-fonctions nommées.
- **Pas de fichiers trop gros.** Éviter les fichiers longs et difficiles à comprendre. Découper par responsabilité.
- **Génération fonction par fonction.** Lors de la génération de code, produire une fonction à la fois, en expliquant pourquoi cette fonction existe, à quoi elle sert, et en justifiant chaque élément.
- **Simplicité avant tout.** Garder le code le plus simple et épuré possible. La suringénierie est bannie.

## Versionnage

- **Dépendances** : notation **`MAJEUR.*.*`** (ex. `react: "19.*.*"`, `hono: "4.*.*"`). On fige la version majeure, mineur et patch en `*` (suivent les dernières). Exceptions : `workspace:*` (paquets internes `@gdt/*`) et `latest` restent tels quels.
- **Version du programme** (`version` des `package.json`) : reste en SemVer classique, démarre à `0.0.1`.
- **Demande de commit** : penser à incrémenter la `version` du/des `package.json` concernés avant de committer.

## Commits

- **Message court, style caveman** : phrase brève, fragments OK, pas de fioritures.
- **Jamais de co-auteur** : ne jamais ajouter de ligne `Co-Authored-By` ni mentionner Claude/Claude Code comme co-auteur.

## Données de jeu (`/data`)

Tables de référence consommées par la couche domaine. Toutes dataminées de GDT (sources et lacunes dans `data/README.md`). Valeurs **à calibrer** (cf. `_comment` en tête de chaque fichier).

| Fichier | Rôle dans le calcul |
|---|---|
| `sliders.json` | 9 curseurs (3 phases × 3), `designShare` = fraction Design générée (reste = Tech) |
| `genres.json` | 6 genres + `idealTechDesignRatio` (Tech ÷ Design visé) |
| `genre-sliders.json` | importance de chaque curseur par genre (0.6–1.0), clés = id des sliders |
| `topics.json` | 51 sujets + affinité `genre[]` (1.0 great combo, 0.6 mauvais) + audience |
| `platforms.json` | ~29 plateformes (pondérations, techLevel, dates) — surtout post-MVP |
| `constants.json` | tailles de jeu + constantes des formules — surtout post-MVP |

Esquisse de la formule (à calibrer, `docs/DESIGN.md` §6) :

```
designScore = Σ_i ( effort_i * designShare_i )
techScore   = Σ_i ( effort_i * (1 - designShare_i) )
reviewScore = round( 100 * affinité * profil * ratio * aléa )   // aléa ∈ [0.95, 1.05]
sales       = salesBase(platform) * (reviewScore ^ 1.5)
revenue     = sales * prixUnitaire
```

## Commandes

Squelette monorepo en place (`bun install` à la racine câble les 3 workspaces).

| Commande (racine) | Effet |
|---|---|
| `bun install` | Installe et lie tous les workspaces |
| `bun run dev:back` | Lance l'API Hono (hot reload, `PORT` env, défaut 3000) |
| `bun run dev:front` | Lance le front React (bundler Bun, hot reload) |
| `bun run test` | `bun test` sur tous les paquets (couche domaine en priorité) |
| `bun run lint` | `biome check .` |
| `bun run format` | `biome format --write .` |
| `bun run typecheck` | `tsc --noEmit` sur tous les paquets |

Route de santé back : `GET /health` → `{ "status": "ok" }`. Drizzle/Postgres pas encore branchés
(étape 4 du §10) — commandes `bunx drizzle-kit …` à ajouter à ce moment-là.
