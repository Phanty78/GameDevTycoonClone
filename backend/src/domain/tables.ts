/**
 * Types des tables de référence (/data) consommées par la couche domaine.
 * Décrivent la FORME du JSON dataminé, pas la logique. La logique vit dans les
 * autres fichiers du domaine ; ces tables sont injectées en argument (domaine pur,
 * aucune lecture fichier ici). Voir docs/DESIGN.md §6 et data/README.md.
 */

/** Un curseur d'effort : designShare = fraction des points générés en Design. */
export interface Slider {
  id: string;
  name: string;
  designShare: number;
}

/** sliders.json : 9 curseurs répartis en 3 phases. */
export interface SlidersTable {
  phases: { phase: number; sliders: Slider[] }[];
}

/** genres.json : idealTechDesignRatio = Tech ÷ Design visé pour le genre. */
export interface GenresTable {
  genres: { id: string; name: string; idealTechDesignRatio: number }[];
}

/** genre-sliders.json : importance ∈ [0.6..1.0] de chaque curseur, par genre. */
export interface GenreSlidersTable {
  byGenre: Record<string, Record<string, number>>;
}

/**
 * topics.json : `genre` et `audience` sont des TABLEAUX indexés par l'ordre
 * déclaré dans `_meta` — surtout pas par l'ordre de genres.json (strategy et
 * simulation y sont inversés). Toujours résoudre l'index via _meta.genreOrder.
 */
export interface TopicsTable {
  _meta: { genreOrder: string[]; audienceOrder: string[] };
  topics: { id: string; name: string; genre: number[]; audience: number[] }[];
}

/**
 * platforms.json : type MINIMAL volontaire. Au MVP, seule `marketSizeMillions`
 * sert (base de ventes, §6). `marketSizeMillions` peut être `null` (plateformes
 * récentes non renseignées) — le type force l'appelant à gérer ce cas.
 * Les pondérations genre/audience sont post-MVP et délibérément non typées ici :
 * l'adéquation au genre est déjà capturée dans reviewScore (pas de double compte).
 */
export interface PlatformsTable {
  platforms: { id: string; name: string; marketSizeMillions: number | null }[];
}

/** Toutes les tables /data injectées ensemble dans la couche domaine. */
export interface GameTables {
  sliders: SlidersTable;
  genres: GenresTable;
  genreSliders: GenreSlidersTable;
  topics: TopicsTable;
  platforms: PlatformsTable;
}
