/**
 * Note critique (docs/DESIGN.md §6, ingrédients 4 et 5).
 *
 *   reviewScore = round( 100 * affinité * profil * ratio * aléa )
 *
 * `profil` et `ratio` viennent de fit.ts, `affinité` de la table des sujets.
 * L'aléa est INJECTÉ en paramètre (valeur déjà tirée dans [0.95, 1.05]) : la
 * fonction reste pure et déterministe. Le tirage vit côté impur (route API).
 */
import type { TopicsTable } from "./tables";

type TopicRow = TopicsTable["topics"][number];

/** Borne basse / haute de l'aléa multiplicatif (§6 ingrédient 5). */
export const ALEA_MIN = 0.95;
export const ALEA_MAX = 1.05;

/**
 * Affinité genre × sujet : lit `topic.genre[index]`. L'index DOIT être résolu
 * via `genreOrder` (topics._meta.genreOrder), surtout pas via l'ordre de
 * genres.json où strategy/simulation sont inversés. On force donc `genreOrder`
 * en argument : aucun appelant ne peut indexer avec le mauvais ordre.
 */
export function affinity(
  topic: TopicRow,
  genreId: string,
  genreOrder: string[],
): number {
  const idx = genreOrder.indexOf(genreId);
  if (idx === -1) throw new Error(`Genre inconnu dans genreOrder: ${genreId}`);

  const value = topic.genre[idx];
  if (value === undefined) {
    throw new Error(`Affinité absente: topic=${topic.id}, genre=${genreId}`);
  }
  return value;
}

/**
 * Note critique finale. Tous les facteurs sont déjà calculés ailleurs :
 *   - affinité ∈ [0.6..1.0]   (affinity)
 *   - profil   ∈ [0..1]       (profilFit)
 *   - ratio    ∈ [0..1]       (ratioFit)
 *   - alea     ∈ [0.95..1.05] (tiré côté impur, injecté ici)
 * Plafonné à 100 : sur l'échelle /100, l'aléa pourrait sinon pousser à 105.
 */
export function reviewScore(
  affinityValue: number,
  profil: number,
  ratio: number,
  alea: number,
): number {
  const raw = 100 * affinityValue * profil * ratio * alea;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Tire l'aléa multiplicatif dans [ALEA_MIN, ALEA_MAX]. SEUL point non
 * déterministe : `rng` est injecté (défaut Math.random) pour rester testable.
 * Vit côté impur — la route API l'appelle puis passe la valeur à reviewScore.
 */
export function drawAlea(rng: () => number = Math.random): number {
  return ALEA_MIN + rng() * (ALEA_MAX - ALEA_MIN);
}

/** Seuils -> texte d'ambiance, du meilleur au pire. Calibrables. */
const REVIEW_LABELS: { min: number; label: string }[] = [
  { min: 90, label: "Chef-d'œuvre" },
  { min: 75, label: "Très bon accueil" },
  { min: 60, label: "Bon accueil" },
  { min: 40, label: "Accueil mitigé" },
  { min: 0, label: "Mauvais accueil" },
];

/**
 * Texte d'ambiance dérivé du reviewScore (GameResult.review, §5). Aucun calcul
 * de jeu : pur habillage. Le premier seuil atteint (liste décroissante) gagne.
 */
export function reviewText(score: number): string {
  const match = REVIEW_LABELS.find((entry) => score >= entry.min);
  return match?.label ?? "Mauvais accueil";
}
