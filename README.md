# GameDevTycoonClone

**Projet d'apprentissage** : reproduction web de *Game Dev Tycoon*, en TypeScript/Bun.
Ce n'est pas un jeu jouable aujourd'hui : le domaine de simulation et l'authentification sont écrits, l'interface reste un squelette.

## Ce qui fonctionne

- Domaine de simulation isolé du framework : notes, ventes, affinités genre/thème, tables de données.
- 29 cas de test écrits avec `bun:test` (5 fichiers).
- API : `GET /health`, `POST /auth/register`, `POST /auth/login` (JWT, mots de passe hachés via `Bun.password`).
- PostgreSQL + Drizzle, migrations versionnées.

## Ce qui reste à faire

- Écrans de jeu, formulaire de création, leaderboard.
- Endpoints `POST/GET /games` et `/leaderboard` (prévus dans `docs/DESIGN.md`).
- Licence : aucune n'est définie à ce jour.
- CI : `typecheck` + `bun test` + `biome check`.

## Stack

TypeScript, Bun, Hono, React, PostgreSQL, Drizzle, Biome.

## Lancer le projet

```bash
bun install
docker compose up -d
cp .env.example .env          # adapter DATABASE_URL
cd backend && bun run db:migrate && cd ..
bun run dev:back              # API sur http://localhost:3000
bun run dev:front             # front React
```

## Tests et vérifications

```bash
bun test
bun run typecheck
bun run lint
```

## Structure

- `backend/` — API Hono, domaine, auth, accès base
- `contracts/` — types partagés
- `frontend/` — coquille React (aucune règle de jeu côté client)
- `data/` — données de jeu (genres, sujets, plateformes)
- `docs/` — notes de conception
