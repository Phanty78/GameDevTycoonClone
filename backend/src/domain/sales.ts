/**
 * Ventes et revenu (docs/DESIGN.md §6).
 *
 *   sales   = salesBase(platform) * reviewScore ^ 1.5
 *   revenue = sales * prixUnitaire
 *
 * Fonctions pures. Les valeurs numériques (SALES_SCALE, FALLBACK, prix) sont
 * À CALIBRER (point ouvert du DESIGN) — isolées en constantes nommées.
 */
import type { PlatformsTable } from "./tables";

type PlatformRow = PlatformsTable["platforms"][number];

/** Exposant de la note sur les ventes (§6) : récompense fortement les bons jeux. */
const REVIEW_EXPONENT = 1.5;

/** Taille de marché (millions) prise pour une plateforme sans donnée renseignée. */
const FALLBACK_MARKET_SIZE = 1.0;

/** Facteur d'échelle ventes — à calibrer pour des volumes plausibles. */
const SALES_SCALE = 1000;

/** Prix unitaire (MVP : taille de jeu unique `small`, constants.json gameSizes). */
const UNIT_PRICE = 7;

/**
 * Base de ventes d'une plateforme : sa taille de marché dataminée, mise à
 * l'échelle. `marketSizeMillions` peut être null -> repli sur une valeur neutre.
 */
export function salesBase(platform: PlatformRow): number {
  const marketSize = platform.marketSizeMillions ?? FALLBACK_MARKET_SIZE;
  return marketSize * SALES_SCALE;
}

/** Nombre de copies vendues (entier) : base × note^1.5. */
export function computeSales(base: number, reviewScore: number): number {
  return Math.round(base * reviewScore ** REVIEW_EXPONENT);
}

/** Revenu (entier) : copies × prix unitaire. */
export function computeRevenue(sales: number): number {
  return Math.round(sales * UNIT_PRICE);
}
