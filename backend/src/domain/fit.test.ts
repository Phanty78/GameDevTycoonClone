import { expect, test } from "bun:test";
import type { Effort } from "@gdt/contracts";
import { profilFit, ratioFit } from "./fit";

/** Importance plate : les 9 curseurs comptent pareil. */
const flatImportance: Record<string, number> = {
  engine: 1,
  gameplay: 1,
  story: 1,
  dialogue: 1,
  levelDesign: 1,
  ai: 1,
  worldDesign: 1,
  graphics: 1,
  sound: 1,
};

/** Effort réparti uniformément (chaque phase 100 / 3). */
const evenEffort: Effort = {
  phase1: { engine: 100 / 3, gameplay: 100 / 3, story: 100 / 3 },
  phase2: { dialogue: 100 / 3, levelDesign: 100 / 3, ai: 100 / 3 },
  phase3: { worldDesign: 100 / 3, graphics: 100 / 3, sound: 100 / 3 },
};

/** Effort concentré : 1 seul curseur par phase reçoit tout. */
const concentratedEffort: Effort = {
  phase1: { engine: 100, gameplay: 0, story: 0 },
  phase2: { dialogue: 100, levelDesign: 0, ai: 0 },
  phase3: { worldDesign: 100, graphics: 0, sound: 0 },
};

test("profilFit = 1 quand effort et importance ont la même distribution", () => {
  expect(profilFit(evenEffort, flatImportance)).toBeCloseTo(1, 10);
});

test("profilFit pénalise la concentration face à une importance plate", () => {
  // 3 curseurs à 1/3, 6 à 0, vs idéal 1/9 chacun -> L1 = 12/9, fit = 1/3.
  expect(profilFit(concentratedEffort, flatImportance)).toBeCloseTo(1 / 3, 10);
});

test("profilFit borné dans [0..1]", () => {
  const fit = profilFit(concentratedEffort, flatImportance);
  expect(fit).toBeGreaterThanOrEqual(0);
  expect(fit).toBeLessThanOrEqual(1);
});

test("profilFit pénalise l'effort sur un curseur absent de importance", () => {
  // importance ne couvre qu'un curseur ; tout l'effort va ailleurs.
  // L'union des clés rend cet effort visible -> fit faible, et borné.
  const partialImportance: Record<string, number> = { engine: 1 };
  const fit = profilFit(concentratedEffort, partialImportance);
  expect(fit).toBeGreaterThanOrEqual(0);
  expect(fit).toBeLessThanOrEqual(1);
});

test("profilFit reste borné même avec un effort hors profil massif", () => {
  // engine seul important, mais 0 effort dessus et tout sur d'autres curseurs.
  const allElsewhere: Effort = {
    phase1: { engine: 0, gameplay: 50, story: 50 },
    phase2: { dialogue: 50, levelDesign: 50, ai: 0 },
    phase3: { worldDesign: 50, graphics: 50, sound: 0 },
  };
  const fit = profilFit(allElsewhere, { engine: 1 });
  expect(fit).toBeGreaterThanOrEqual(0);
  expect(fit).toBeLessThanOrEqual(1);
});

// --- ratioFit (piste A, fidèle GDT — idéal action = 1.8) ---

test("ratioFit = 1 quand le ratio T/D atteint l'idéal", () => {
  // design 40, tech 72 -> ratio 1.8 -> t = 0.
  expect(ratioFit(40, 72, 1.8)).toBeCloseTo(1, 10);
});

test("ratioFit décroît linéairement avec l'écart (|t| = 0.2 -> 0.6)", () => {
  // design 40, tech 90 -> t = (72-90)/90 = -0.2 -> 1 - 0.2/0.5 = 0.6.
  expect(ratioFit(40, 90, 1.8)).toBeCloseTo(0.6, 10);
});

test("ratioFit tombe à 0 au-delà du seuil 'mauvais' (|t| >= 0.5)", () => {
  // design 40, tech 40 -> t = (72-40)/40 = 0.8 > 0.5 -> 0.
  expect(ratioFit(40, 40, 1.8)).toBe(0);
});

test("ratioFit reste borné dans [0..1] sur cas extrême", () => {
  const fit = ratioFit(1, 1000, 1.8); // tech écrase design
  expect(fit).toBeGreaterThanOrEqual(0);
  expect(fit).toBeLessThanOrEqual(1);
});

test("ratioFit renvoie 0 quand aucun point n'est alloué (design = tech = 0)", () => {
  expect(ratioFit(0, 0, 1.8)).toBe(0);
});
