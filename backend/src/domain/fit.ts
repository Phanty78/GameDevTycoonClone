/**
 * Mesures d'adéquation (docs/DESIGN.md §6, ingrédients 2 et 3).
 * Deux fonctions pures, sorties bornées dans [0..1] (1 = parfait), multipliées
 * ensuite dans le reviewScore. Pas d'aléa, pas d'I/O.
 */
import type { Effort } from "@gdt/contracts";

/** Aplatit les 3 phases en { idCurseur -> effort }. */
function flattenEffort(effort: Effort): Record<string, number> {
  return { ...effort.phase1, ...effort.phase2, ...effort.phase3 };
}

/**
 * profilFit : à quel point l'allocation d'effort du joueur colle au profil
 * d'importance du genre. `importance` = genre-sliders.json[genre] : un poids
 * ∈ [0.6..1.0] par curseur (0.6 = peu important, 1.0 = très important).
 *
 * Doit renvoyer un score ∈ [0..1] :
 *   - 1.0  -> le joueur a mis son effort exactement là où le genre le demande
 *   - bas  -> effort gaspillé sur des curseurs sans importance, ou curseurs
 *             importants négligés
 *
 * Méthode (piste B, pénalité par écart) : on compare deux distributions
 * normalisées — la part d'effort réelle de chaque curseur et sa part « idéale »
 * (importance normalisée). La distance L1 entre elles ∈ [0..2] ; fit = 1 - L1/2.
 * Symétrique : négliger un curseur important coûte autant que gaspiller sur un
 * curseur faible.
 */
export function profilFit(
  effort: Effort,
  importance: Record<string, number>,
): number {
  const efforts = flattenEffort(effort);
  const totalEffort = sum(Object.values(efforts));
  const totalImportance = sum(Object.values(importance));
  if (totalEffort === 0 || totalImportance === 0) return 0;

  // Itérer sur l'UNION des clés : un curseur présent dans l'un mais pas l'autre
  // a une part de 0 du côté manquant. Sans ça, l'effort dépensé sur un curseur
  // absent de `importance` serait invisible (non pénalisé) et la borne [0..1]
  // ne tiendrait que si les deux ensembles de clés coïncident.
  const ids = new Set([...Object.keys(efforts), ...Object.keys(importance)]);
  let deviation = 0;
  for (const id of ids) {
    const effortShare = (efforts[id] ?? 0) / totalEffort;
    const idealShare = (importance[id] ?? 0) / totalImportance;
    deviation += Math.abs(effortShare - idealShare);
  }

  // Clamp : garantit le contrat de sortie [0..1] indépendamment du caller.
  return Math.max(0, Math.min(1, 1 - deviation / 2));
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Écart |t| au-delà duquel l'adéquation au ratio tombe à 0 (seuil dataminé GDT). */
const RATIO_BAD_THRESHOLD = 0.5;

/**
 * ratioFit : à quel point le ratio Tech/Design produit colle au ratio idéal du
 * genre (docs/DESIGN.md §6 ingrédient 3, data/constants.json:20).
 *
 * Méthode (piste A, fidèle GDT) : écart signé normalisé
 *   t = (design * ideal - tech) / max(design, tech)
 * où `design * ideal` est le tech « cible ». fit = 1 - |t| / 0.5, ramené à [0..1].
 *   |t| = 0    -> 1   (ratio parfait)
 *   |t| = 0.25 -> 0.5 (seuil "bon" GDT)
 *   |t| >= 0.5 -> 0   (seuil "mauvais" GDT)
 *
 * `max()` au dénominateur évite la division par zéro tant qu'un score est > 0 ;
 * le seul cas non couvert (aucun point du tout) renvoie 0.
 */
export function ratioFit(design: number, tech: number, ideal: number): number {
  const scale = Math.max(design, tech);
  if (scale === 0) return 0; // aucun point alloué = aucun jeu réel

  const t = (design * ideal - tech) / scale;
  return Math.max(0, Math.min(1, 1 - Math.abs(t) / RATIO_BAD_THRESHOLD));
}
