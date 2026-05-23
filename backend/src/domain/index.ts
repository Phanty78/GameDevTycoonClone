/**
 * Orchestrateur de la couche domaine (docs/DESIGN.md §6).
 *
 * Deux temps, façon « parse, don't validate » :
 *   1. resolveInput : SEULE porte d'échec. Résout les ids bruts (genre/topic/
 *      platform) en lignes typées, ou renvoie une erreur. Garantit que tout ce
 *      dont computeGame a besoin existe.
 *   2. computeGame  : fonction TOTALE et déterministe (rng injecté). Aucune
 *      branche d'erreur : enchaîne les briques pures et renvoie un ComputedGame.
 *
 * computeGame ne produit PAS gameId ni newBalance (concerns DB/état joueur) :
 * la route les ajoute pour former le GameResult du contrat.
 */
import type { CreateGameInput, Effort } from "@gdt/contracts";
import { profilFit, ratioFit } from "./fit";
import { affinity, drawAlea, reviewScore, reviewText } from "./review";
import { computeRevenue, computeSales, salesBase } from "./sales";
import { accumulateScores } from "./scores";
import type {
  GameTables,
  GenresTable,
  PlatformsTable,
  TopicsTable,
} from "./tables";

type GenreRow = GenresTable["genres"][number];
type TopicRow = TopicsTable["topics"][number];
type PlatformRow = PlatformsTable["platforms"][number];

/** Input dont chaque référence a été résolue : computeGame ne peut plus échouer. */
export interface ResolvedInput {
  name: string;
  effort: Effort;
  genre: GenreRow;
  topic: TopicRow;
  platform: PlatformRow;
  /** Importance des curseurs pour ce genre (genre-sliders), résolue ici une fois. */
  importance: Record<string, number>;
}

export type ResolveError =
  | "unknown_genre"
  | "unknown_topic"
  | "unknown_platform";

export type ResolveResult =
  | { ok: true; input: ResolvedInput }
  | { ok: false; error: ResolveError };

/** Sortie du domaine : ce qui se calcule purement (sans gameId ni newBalance). */
export interface ComputedGame {
  designScore: number;
  techScore: number;
  reviewScore: number;
  sales: number;
  revenue: number;
  review: string;
}

/**
 * Résout les ids bruts en lignes des tables. Le genre est validé contre TROIS
 * tables (genres, genre-sliders, ordre des topics) car computeGame s'appuie sur
 * les trois — sans quoi sa totalité ne serait pas garantie.
 */
export function resolveInput(
  input: CreateGameInput,
  tables: GameTables,
): ResolveResult {
  const genre = tables.genres.genres.find((g) => g.id === input.genre);
  if (!genre) return { ok: false, error: "unknown_genre" };

  // Le genre doit aussi exister dans genre-sliders ET dans l'ordre des topics :
  // les deux sont indispensables au calcul (importance + affinité).
  const importance = tables.genreSliders.byGenre[genre.id];
  const inGenreOrder = tables.topics._meta.genreOrder.includes(genre.id);
  if (!importance || !inGenreOrder)
    return { ok: false, error: "unknown_genre" };

  const topic = tables.topics.topics.find((t) => t.id === input.topic);
  if (!topic) return { ok: false, error: "unknown_topic" };

  const platform = tables.platforms.platforms.find(
    (p) => p.id === input.platform,
  );
  if (!platform) return { ok: false, error: "unknown_platform" };

  return {
    ok: true,
    input: {
      name: input.name,
      effort: input.effort,
      genre,
      topic,
      platform,
      importance,
    },
  };
}

/**
 * Calcule la note et les ventes d'un jeu. Total et déterministe : `rng` est
 * injecté (défaut Math.random) pour des tests reproductibles.
 */
export function computeGame(
  resolved: ResolvedInput,
  tables: GameTables,
  rng: () => number = Math.random,
): ComputedGame {
  const { design, tech } = accumulateScores(resolved.effort, tables.sliders);

  const profil = profilFit(resolved.effort, resolved.importance);
  const ratio = ratioFit(design, tech, resolved.genre.idealTechDesignRatio);
  const aff = affinity(
    resolved.topic,
    resolved.genre.id,
    tables.topics._meta.genreOrder,
  );
  const score = reviewScore(aff, profil, ratio, drawAlea(rng));

  const sales = computeSales(salesBase(resolved.platform), score);

  return {
    designScore: Math.round(design),
    techScore: Math.round(tech),
    reviewScore: score,
    sales,
    revenue: computeRevenue(sales),
    review: reviewText(score),
  };
}
