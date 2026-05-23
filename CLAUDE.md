# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

Clone web de **Game Dev Tycoon**. Squelette monorepo + **couche domaine** + **DB Drizzle** + **auth JWT** en place (étapes 3 à 5 du §10). Le plan d'implémentation complet est dans `docs/DESIGN.md` §10.

Avant d'écrire du code, lire `docs/DESIGN.md` : c'est la source de vérité pour l'architecture, le modèle de données, les routes API et les formules de jeu.

**Avancement (§10)** : 1 squelette ✅ · 2 données `/data` ✅ · 3 couche domaine ✅ · 4 DB Drizzle ✅ · 5 auth ✅ · 6 `POST /games` ⏳ · 7 leaderboard + cron · 8 front.

La **couche domaine** vit dans `backend/src/domain/` (pure, sans I/O, testée en priorité) :
`scores.ts` (Design/Tech) · `fit.ts` (`profilFit` méthode pénalité-par-écart, `ratioFit` méthode fidèle-GDT) · `review.ts` (`affinity`, `reviewScore`, `drawAlea`, `reviewText`) · `sales.ts` · `index.ts` (`resolveInput` → `computeGame`). Pattern « parse, don't validate » : `resolveInput` est la seule porte d'échec (renvoie un `Result`), `computeGame` est **total et déterministe** (l'aléa est injecté via `rng`). `computeGame` ne produit pas `gameId`/`newBalance` (concerns DB) — la route les ajoute.
⚠️ L'affinité genre×sujet (`topics.json`) s'indexe via `topics._meta.genreOrder`, **jamais** via l'ordre de `genres.json` (strategy/simulation y sont inversés). `affinity()` force `genreOrder` en argument pour verrouiller ça.
Valeurs **à calibrer** isolées en constantes nommées : `SALES_SCALE`, `FALLBACK_MARKET_SIZE` (`sales.ts`), `REVIEW_LABELS` (`review.ts`).

La **DB** vit dans `backend/src/db/` : `schema.ts` (4 tables : `users`, `seasons`, `games`, `scores`) + `index.ts` (client Drizzle, échoue tôt si `DATABASE_URL` manque). C'est de l'**I/O** → la couche domaine ne l'importe pas. PK `serial`. Argent (`balance`/`sales`/`revenue`/`value`) en `bigint` mode number (un `int4` plafonnerait), scores en `integer`, `effort` en `jsonb` typé `$type<Effort>()`. FK `userId` en `ON DELETE CASCADE`. `games` **sans** `seasonId` (purgée au reset) ; `scores` porte `seasonId` + contrainte unique `(userId, seasonId)` (1 ligne/saison, upsert). Migrations versionnées dans `backend/drizzle/` (généré, ignoré par Biome). Postgres dev via `docker-compose.yml` (`DATABASE_URL=postgres://gdt:gdt@localhost:5432/gdt`). Capital de départ : `STARTING_BALANCE = 100_000` (constante exportée de `schema.ts`, défaut SQL de `users.balance`, **à calibrer**).

L'**auth** vit dans `backend/src/auth/` (I/O) : `passwords.ts` (`Bun.password`, argon2id), `tokens.ts` (`signToken`, JWT HS256, `JWT_EXPIRY_SECONDS` = 7 j, claim `exp`), `middleware.ts` (`requireAuth()` = middleware `hono/jwt` ; `getUserId(c)` lit `sub`), `routes.ts` (`POST /auth/register` → 201 `{userId}`, `POST /auth/login` → `{token}`). Sécurité : mdp jamais en clair/renvoyé ; login renvoie une **erreur générique** (anti-énumération de comptes) ; email pris → 409 (via `isUniqueViolation`, qui inspecte `error.cause.code === 23505` car Drizzle enveloppe l'erreur pg). Secret : `JWT_SECRET` (`.env`). Ids exposés en `string` côté contrat (`String(id)`) bien que PK `serial`.

⚠️ Le **runtime back** (comme drizzle) doit voir le `.env` **racine** : on lance donc le serveur depuis la racine (`bun run --hot backend/src/index.ts`), cwd = racine → Bun charge le `.env` racine en dev ; en prod l'env est injecté par la plateforme.

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

## Erreurs & secrets

- **Remontée d'erreurs centralisée** : `backend/src/lib/errors.ts` → `reportError(error, context?, deps?)` poste sur un webhook Discord. **Best-effort** : ne jette jamais (une panne du reporter ne doit pas masquer l'erreur d'origine). Webhook absent = remontée désactivée. C'est de l'**I/O** → la couche domaine ne l'importe pas ; appelée dans les `catch` des routes.
- **Secrets via `.env`** (chargé automatiquement par Bun). `.env` est **gitignoré** ; `.env.example` (commité, sans valeur) documente les variables. Webhook erreurs : `DISCORD_ERROR_WEBHOOK`.
- **Ne jamais commiter de secret.** Toute valeur sensible passe par `.env` + une entrée dans `.env.example`.

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
- **Préfixe de type** : commencer par un tag en majuscules suivi de ` - `, ex. `FIX - ...`, `REF - ...`, `FEAT - ...`.
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

DB (depuis `backend/`, après `docker compose up -d` à la racine) :

| Commande | Effet |
|---|---|
| `docker compose up -d` | Lance le Postgres de dev (racine) |
| `bun run db:generate` | Génère une migration SQL depuis `schema.ts` (offline) |
| `bun run db:migrate` | Applique les migrations en attente (charge le `.env` racine) |
| `bun run db:push` | Pousse le schéma directement sans migration (prototypage) |

⚠️ `db:migrate`/`db:push` chargent le `.env` **racine** via `bun --env-file=../.env` (le script tourne dans `backend/`, où Bun ne verrait pas le `.env` racine seul). `db:generate` n'a pas besoin de la DB.

Routes back : `GET /health` → `{ "status": "ok" }` · `POST /auth/register` · `POST /auth/login` (DESIGN §5).
