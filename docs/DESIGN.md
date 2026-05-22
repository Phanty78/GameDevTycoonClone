# Game Dev Tycoon Clone — Document de conception (MVP)

> Statut : cadrage validé. Décisions prises en brainstorm intégrées.
> Reste ouvert : calibrage fin des formules + récupération des données dataminées (§6, §9).

---

## 1. Vision et périmètre du MVP

Clone web de Game Dev Tycoon. Chaque joueur gère un studio et développe des jeux.
Compétition entre joueurs via un **leaderboard réinitialisé chaque semaine** (saisons).

Le MVP doit être **jouable en l'état, sans graphisme** : une interface minimale (formulaires + texte)
suffit à boucler une partie complète.

### Objectif du MVP

Permettre à un joueur authentifié de :
1. Créer une partie (studio).
2. Développer **un** jeu : nom, genre, sujet, plateforme + allocation d'effort.
3. Recevoir des scores (Design, Technique, note) et un revenu calculés **côté serveur**.
4. Voir son meilleur revenu de la saison apparaître dans le leaderboard.

Hors périmètre MVP (étapes ultérieures) : employés, recherche/déblocages, moteur de jeu custom,
coûts récurrents/salaires, plateformes multiples simultanées, événements riches, graphismes.

---

## 2. Besoins (ce qui pilote l'architecture)

| Besoin | Conséquence architecturale |
|---|---|
| Comptes joueurs | Authentification + table `users` |
| Parties persistées par compte | DB serveur (Postgres) |
| Compétition / leaderboard | Table `scores` rattachée à une `season` |
| Reset hebdomadaire | Concept de **saison** + job cron |
| Hall of fame (saisons passées) | Scores **archivés** par saison, jeux **effacés** |
| Anti-triche | **Logique de jeu 100 % côté back, jamais exposée au front** |
| Pas de multijoueur temps réel | API REST suffit, pas de WebSocket |

---

## 3. Architecture en couches

Front et back **séparés**. Le back est **autoritaire** : il détient tout l'algorithme.
Le front n'envoie que des *choix* et n'affiche que ce que le back renvoie.

```
┌─────────────────────────────────────────────┐
│ FRONT (React, navigateur)                     │
│  - UI minimale : formulaires + affichage      │
│  - Aucune règle de jeu, aucune formule        │
│  - Envoie les choix du joueur                 │
└───────────────┬───────────────────────────────┘
                │ HTTP REST (JSON), routes authentifiées
┌───────────────▼───────────────────────────────┐
│ BACK (API Hono sur Bun)                        │
│  - Auth (JWT)                                  │
│  - Couche DOMAINE : règles + formules          │  ← le cœur, jamais exposé
│  - Orchestration : valide input → calcule →    │
│    persiste → renvoie payload d'affichage      │
└───────────────┬───────────────────────────────┘
                │ Drizzle ORM
┌───────────────▼───────────────────────────────┐
│ DONNÉES (PostgreSQL)                           │
│  users, games, scores, seasons                 │
└────────────────────────────────────────────────┘
```

### Couche domaine (back) — isolée

Le calcul est concentré dans une couche **sans I/O** (ni réseau, ni DB) : elle prend les choix du
joueur + les tables de données du jeu et renvoie un résultat. Testable unitairement. C'est le seul
endroit où vivent les règles. L'aléa (§6) y est appliqué au moment du calcul.

---

## 4. Modèle de données

```
User
  id            (pk)
  email         (unique)
  passwordHash
  createdAt

Season
  id            (pk)
  name          ex. "Saison 1"
  startsAt
  endsAt        null = saison en cours
  isActive

Game            (un jeu développé pendant la saison en cours)
  id            (pk)
  userId        (fk -> User, ON DELETE CASCADE)
  name
  genre
  topic
  platform
  effort        (allocation, voir §6)
  designScore   (calculé serveur)
  techScore     (calculé serveur)
  reviewScore   (calculé serveur, dérivé de design/tech vs ratio du genre)
  sales         (calculé serveur)
  revenue       (calculé serveur)
  createdAt
  -- PAS de seasonId : la table Game est entièrement vidée à chaque reset de saison.

Score           (entrée leaderboard, persistante = hall of fame)
  id            (pk)
  userId        (fk -> User, ON DELETE CASCADE)
  seasonId      (fk -> Season)
  value         (nombre abstrait ; au MVP = meilleur revenue de la saison)
  createdAt
```

### Règles de cycle de vie

- **Suppression de compte** : `ON DELETE CASCADE` sur `Game.userId` et `Score.userId` → tout part.
- **Reset de saison (hebdo)**, dans une **transaction unique** :
  1. Clôturer la saison active (`endsAt = now`, `isActive = false`).
  2. **Vider entièrement la table `Game`**.
  3. Créer une nouvelle saison active.
  Les `Score` sont **conservés** (rattachés à leur saison) → hall of fame.

> Note : `Game` n'a pas de `seasonId` car il est purgé à chaque reset ; aucune ambiguïté de saison
> ne peut subsister. Seul `Score` porte la saison, pour l'archive.

---

## 5. API (REST)

> Routes de jeu **authentifiées** (JWT). La logique n'est jamais renvoyée, seulement le résultat.

| Méthode | Route | Body (front → back) | Réponse (payload d'affichage) |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ userId }` |
| POST | `/auth/login` | `{ email, password }` | `{ token }` |
| POST | `/games` | `{ name, genre, topic, platform, effort }` | résultat calculé (ci-dessous) |
| GET  | `/games` | — | liste des jeux du joueur (saison en cours) |
| GET  | `/leaderboard` | `?seasonId=` (défaut : saison active) | top N `{ rank, playerName, value }` |

### Boucle de gameplay (route clé)

`POST /games` — le joueur soumet ses choix, le back est autoritaire :

```
Front envoie (effort = 9 curseurs sur 3 phases ; chaque phase répartit son temps, total 100 par phase) :
{
  "name": "Mon RPG spatial",
  "genre": "rpg",
  "topic": "space",
  "platform": "pc",
  "effort": {
    "phase1": { "engine": 20, "gameplay": 30, "story": 50 },
    "phase2": { "dialogue": 50, "levelDesign": 40, "ai": 10 },
    "phase3": { "worldDesign": 50, "graphics": 40, "sound": 10 }
  }
}

Back renvoie (payload d'affichage uniquement) :
{
  "gameId": "...",
  "designScore": 82,
  "techScore": 74,
  "reviewScore": 78,
  "sales": 124000,
  "revenue": 1240000,
  "review": "Bon accueil critique.",   // texte d'ambiance dérivé du reviewScore
  "newBalance": 1290000
}
```

Le front affiche les valeurs renvoyées. Il ne sait **pas** comment c'est calculé.

---

## 6. Règles du jeu (MVP) — côté back uniquement

> Structure validée. **À calibrer** avec les données dataminées (§9).

GDT distingue **Design (D)** et **Technologie (T)**. Les **9 curseurs** d'effort (3 phases × 3)
alimentent l'un, l'autre ou les deux selon leur `designShare`. Chaque genre a un **ratio T/D idéal**
et un profil d'importance des curseurs : la note récompense la proximité à ce ratio et au profil.

> Toutes les tables numériques (genres, sujets, curseurs, importance par genre, combos, plateformes)
> vivent dans **`/data`** (voir `data/README.md`). Issues du datamining communautaire.

### Ingrédients (tous depuis `/data`)

1. **Accumulation Design / Tech** — chaque curseur génère du Design selon son `designShare`
   (`data/sliders.json`), le reste en Tech. L'effort alloué par curseur pondère la quantité.
2. **Adéquation du profil de curseurs** — `data/genre-sliders.json` donne l'importance de chaque
   curseur par genre : pénalité si on pousse un curseur sans importance / si on néglige un important.
3. **Adéquation au ratio T/D du genre** — écart entre le ratio T/D produit et `idealTechDesignRatio`
   (`data/genres.json`) → bonus/pénalité.
4. **Affinité genre × sujet** — `data/topics.json` → `topic.genre[genre]` (1.0 = great combo, 0.6 = mauvais).
5. **Aléa borné** — variation multiplicative serrée **`[0.95, 1.05]`** (±5 %), appliquée au calcul.
   Apporte de la variété pour éviter un jeu « résolu », sans fausser le classement.
   *Pas de seed stockée* : le résultat final est persisté directement, donc aucun besoin de
   reproduire le calcul.

### Formule (esquisse à calibrer)

```
// pour chaque curseur i (parmi les 9) :
designScore = Σ_i ( effort_i * designShare_i )
techScore   = Σ_i ( effort_i * (1 - designShare_i) )

profil      = adéquationProfil(effort, importance_curseurs(genre))   // ∈ [0..1]
ratio       = adéquationRatio(techScore / designScore, idealTechDesignRatio(genre))  // ∈ [0..1]
affinité    = topic.genre[genre]                                     // ∈ [0.6..1.0]

reviewScore = round( 100 * affinité * profil * ratio * aléa )         // aléa ∈ [0.95, 1.05]
sales       = salesBase(platform) * (reviewScore ^ 1.5)
revenue     = sales * prixUnitaire
```

### Leaderboard (MVP)

`Score.value = meilleur revenue du joueur sur la saison`. Le champ `value` reste **abstrait** :
la définition pourra évoluer (profit, composite qualité/efficacité) en phase studio, sans changer
le schéma.

---

## 7. Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Front | **React + TypeScript** | Évite une refonte si l'UI grandit. |
| Build front | **Bundler Bun** (pas de Vite au départ) | Tout-Bun, un outil de moins. Vite reste une option si le HMR gêne. |
| Runtime back | **Bun** | Rapide, TS natif. |
| Framework HTTP | **Hono** | Léger, portable, déjà connu. |
| Lint / format | **Biome** | Un seul outil (remplace ESLint + Prettier). |
| ORM | **Drizzle** | TS-first, proche du SQL, léger, bon avec Bun + Postgres, migrations incluses. |
| DB | **PostgreSQL** | Local (Docker) en dev = zéro coût ; Railway en prod. |
| Auth | **JWT** | Stateless, simple pour une API REST. |
| Tests | **`bun:test`** | Intégré, rapide. Couche domaine testée en priorité. |
| Hébergement | **Railway** | Postgres managé + cron natif. |

Langage unique (TS) → on **partage les types** (inputs API, payloads) entre front et back.
La **logique** reste exclusivement back ; seuls les **types/contrats** sont partagés.

### Découpage du dépôt (monorepo)

```
/apps
  /front        # client React + TS
  /back         # API Hono/Bun + couche domaine (règles du jeu)
/packages
  /contracts    # types partagés (inputs API, payloads) — PAS de logique
/data           # tables de jeu dataminées (genres, sujets, combos, poids) en JSON
/docs
  DESIGN.md
```

---

## 8. Reset de saison (cron)

- Cadence : **hebdomadaire**.
- Mécanisme : **cron job Railway** (service planifié séparé), plus robuste qu'un cron in-process.
- Action : transaction unique → clôturer saison active, vider `Game`, créer nouvelle saison.
- Contrainte : **idempotent et transactionnel** (pas d'état moitié-resetté en cas de crash).

---

## 9. Données dataminées (étape dédiée)

La communauté a daté-miné GDT (wiki Fandom + repos GitHub) : combos genre×sujet, poids des
curseurs par genre, ratios D/T, plateformes.

**Plan :** recherche web → extraction → normalisation en JSON dans `/data` → calibrage des formules
du §6. Données de fan-datamining d'un jeu commercial : usage perso/éducatif, non redistribuées
comme produit officiel.

---

## 10. Plan d'implémentation du MVP

1. **Squelette monorepo** + `/packages/contracts` (types des inputs/payloads).
2. **Récupération + normalisation des données** dataminées dans `/data` (§9).
3. **Couche domaine** (back, pure) : formules `design/tech/review/sales/revenue` + aléa + tests `bun:test`.
4. **DB + migrations Drizzle** : `users`, `seasons`, `games`, `scores` (FK cascade).
5. **Auth** : register / login (JWT).
6. **Route `POST /games`** : valide input → domaine → persiste → upsert `Score` → renvoie payload.
7. **Leaderboard** (`GET /leaderboard`) + **job cron** de reset de saison.
8. **Front React minimal** : login, formulaire de jeu, affichage du résultat, leaderboard.
9. **Boucle jouable de bout en bout**, sans graphisme.

---

## Points encore ouverts

- [ ] Calibrage fin des poids/ratios des formules (§6) — dépend du datamining (§9).
- [ ] Liste exacte genres / sujets / plateformes du MVP — issue du datamining (§9).
- [ ] Métrique leaderboard post-MVP (profit ? composite ?) — schéma déjà neutre via `Score.value`.
