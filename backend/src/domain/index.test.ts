import { expect, test } from "bun:test";
import type { CreateGameInput } from "@gdt/contracts";
import { computeGame, resolveInput } from "./index";
import type { GameTables } from "./tables";

/** Tables minimales et "neutres" pour des assertions exactes :
 *  - designShare 0.5 partout -> design = tech
 *  - idealRatio 1.0          -> ratioFit parfait quand design = tech
 *  - importance plate        -> profilFit parfait quand effort uniforme
 *  - affinité 1.0            -> facteur neutre
 *  - marketSize 1.0          -> salesBase = 1000
 */
const ids = [
  "engine",
  "gameplay",
  "story",
  "dialogue",
  "levelDesign",
  "ai",
  "worldDesign",
  "graphics",
  "sound",
];
const tables: GameTables = {
  sliders: {
    phases: [
      {
        phase: 1,
        sliders: ids
          .slice(0, 3)
          .map((id) => ({ id, name: id, designShare: 0.5 })),
      },
      {
        phase: 2,
        sliders: ids
          .slice(3, 6)
          .map((id) => ({ id, name: id, designShare: 0.5 })),
      },
      {
        phase: 3,
        sliders: ids
          .slice(6, 9)
          .map((id) => ({ id, name: id, designShare: 0.5 })),
      },
    ],
  },
  genres: {
    genres: [{ id: "action", name: "Action", idealTechDesignRatio: 1.0 }],
  },
  genreSliders: {
    byGenre: { action: Object.fromEntries(ids.map((id) => [id, 1])) },
  },
  topics: {
    _meta: {
      genreOrder: ["action"],
      audienceOrder: ["young", "everyone", "mature"],
    },
    topics: [
      { id: "space", name: "Espace", genre: [1.0], audience: [1, 1, 1] },
    ],
  },
  platforms: { platforms: [{ id: "pc", name: "PC", marketSizeMillions: 1.0 }] },
};

const validInput: CreateGameInput = {
  name: "Test",
  genre: "action",
  topic: "space",
  platform: "pc",
  effort: {
    phase1: { engine: 100 / 3, gameplay: 100 / 3, story: 100 / 3 },
    phase2: { dialogue: 100 / 3, levelDesign: 100 / 3, ai: 100 / 3 },
    phase3: { worldDesign: 100 / 3, graphics: 100 / 3, sound: 100 / 3 },
  },
};

test("resolveInput réussit sur un input valide", () => {
  const res = resolveInput(validInput, tables);
  expect(res.ok).toBe(true);
});

test("resolveInput renvoie unknown_genre / topic / platform", () => {
  expect(resolveInput({ ...validInput, genre: "mmo" }, tables)).toEqual({
    ok: false,
    error: "unknown_genre",
  });
  expect(resolveInput({ ...validInput, topic: "nope" }, tables)).toEqual({
    ok: false,
    error: "unknown_topic",
  });
  expect(resolveInput({ ...validInput, platform: "nope" }, tables)).toEqual({
    ok: false,
    error: "unknown_platform",
  });
});

test("computeGame : cas neutre déterministe (rng = 0.5 -> aléa 1.0)", () => {
  const res = resolveInput(validInput, tables);
  if (!res.ok) throw new Error("setup invalide");

  const out = computeGame(res.input, tables, () => 0.5);
  // design = tech = 150 ; profil = ratio = affinité = aléa(1.0) = 1 -> note 100.
  expect(out.designScore).toBe(150);
  expect(out.techScore).toBe(150);
  expect(out.reviewScore).toBe(100);
  // salesBase 1000 ; 1000 * 100^1.5 = 1_000_000 ; revenue = *7.
  expect(out.sales).toBe(1_000_000);
  expect(out.revenue).toBe(7_000_000);
  expect(out.review).toBe("Chef-d'œuvre");
});

test("computeGame est déterministe à rng fixé", () => {
  const res = resolveInput(validInput, tables);
  if (!res.ok) throw new Error("setup invalide");
  const a = computeGame(res.input, tables, () => 0.3);
  const b = computeGame(res.input, tables, () => 0.3);
  expect(a).toEqual(b);
});
