/**
 * Schéma Drizzle / PostgreSQL (docs/DESIGN.md §4).
 *
 * Invariants non négociables (CLAUDE.md) :
 *   - `games` n'a PAS de seasonId : la table est entièrement vidée à chaque
 *     reset de saison, donc aucune ambiguïté de saison ne peut subsister.
 *   - Seul `scores` porte seasonId (hall of fame, survit au reset).
 *   - FK userId en ON DELETE CASCADE : supprimer un compte efface tout son
 *     contenu en base, sans nettoyage applicatif.
 *
 * Choix de types : argent en bigint (mode number) car un int4 plafonne à
 * ~2,1 Md et le solde cumulé peut dépasser ; scores en integer (petits, déjà
 * arrondis par le domaine) ; effort en jsonb typé via le contrat partagé.
 */
import type { Effort } from "@gdt/contracts";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/** Capital de départ d'un nouveau joueur (à calibrer, cf. docs/DESIGN.md §6). */
export const STARTING_BALANCE = 100_000;

/** Joueur. Le solde est le capital disponible pour développer des jeux. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: bigint("balance", { mode: "number" })
    .notNull()
    .default(STARTING_BALANCE),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Saison de jeu. endsAt null + isActive true = saison en cours (une seule). */
export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
});

/**
 * Jeu développé pendant la saison en cours. Scores/ventes/revenu sont calculés
 * côté serveur (couche domaine) — jamais reçus du front. Purgée à chaque reset.
 */
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  topic: text("topic").notNull(),
  platform: text("platform").notNull(),
  effort: jsonb("effort").$type<Effort>().notNull(),
  designScore: integer("design_score").notNull(),
  techScore: integer("tech_score").notNull(),
  reviewScore: integer("review_score").notNull(),
  sales: bigint("sales", { mode: "number" }).notNull(),
  revenue: bigint("revenue", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Entrée de leaderboard, persistante (hall of fame). Au MVP, value = meilleur
 * revenu de la saison → une seule ligne par (joueur, saison), mise à jour par
 * upsert. La contrainte unique verrouille cette règle au niveau base.
 */
export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    value: bigint("value", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("scores_user_season_unique").on(t.userId, t.seasonId)],
);
