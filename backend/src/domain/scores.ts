/**
 * Accumulation Design / Tech (docs/DESIGN.md §6, ingrédient 1).
 *
 * Chaque curseur génère des points : une fraction `designShare` part en Design,
 * le reste (1 - designShare) en Tech. L'effort alloué par le joueur pondère la
 * quantité. Fonction pure : aucun aléa, aucune I/O — l'aléa n'intervient qu'au
 * reviewScore. C'est le socle testable de toute la note.
 */
import type { Effort } from "@gdt/contracts";
import type { SlidersTable } from "./tables";

export interface DesignTech {
  design: number;
  tech: number;
}

/** Aplatit les 3 phases en une table { idCurseur -> effort }. */
function flattenEffort(effort: Effort): Record<string, number> {
  return { ...effort.phase1, ...effort.phase2, ...effort.phase3 };
}

/**
 * Somme pondérée des points sur les 9 curseurs.
 * On itère sur la TABLE (sliders.json), pas sur l'input : un curseur absent
 * de l'effort compte 0, jamais d'exception.
 */
export function accumulateScores(
  effort: Effort,
  sliders: SlidersTable,
): DesignTech {
  const efforts = flattenEffort(effort);
  let design = 0;
  let tech = 0;

  for (const phase of sliders.phases) {
    for (const slider of phase.sliders) {
      const points = efforts[slider.id] ?? 0;
      design += points * slider.designShare;
      tech += points * (1 - slider.designShare);
    }
  }

  return { design, tech };
}
