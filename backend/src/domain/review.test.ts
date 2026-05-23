import { expect, test } from "bun:test";
import { ALEA_MAX, ALEA_MIN, affinity, drawAlea, reviewScore } from "./review";

// genreOrder VOLONTAIREMENT distinct de genres.json : simulation avant strategy.
const genreOrder = [
  "action",
  "adventure",
  "rpg",
  "simulation",
  "strategy",
  "casual",
];
const topic = {
  id: "space",
  name: "Espace",
  // index:        action adv  rpg  simu strat casual
  genre: [1.0, 0.6, 0.8, 1.0, 0.7, 0.6],
  audience: [1, 1, 1],
};

test("affinity résout l'index via genreOrder, pas l'ordre de genres.json", () => {
  // simulation est à l'index 3 dans genreOrder -> 1.0 ; strategy à 4 -> 0.7.
  expect(affinity(topic, "simulation", genreOrder)).toBe(1.0);
  expect(affinity(topic, "strategy", genreOrder)).toBe(0.7);
});

test("affinity jette sur genre inconnu", () => {
  expect(() => affinity(topic, "mmo", genreOrder)).toThrow();
});

test("reviewScore = round(100 * affinité * profil * ratio * aléa)", () => {
  // 100 * 1 * 1 * 1 * 1 = 100.
  expect(reviewScore(1, 1, 1, 1)).toBe(100);
  // 100 * 0.8 * 0.5 * 0.5 * 1 = 20.
  expect(reviewScore(0.8, 0.5, 0.5, 1)).toBe(20);
});

test("reviewScore plafonne à 100 même avec aléa haut", () => {
  expect(reviewScore(1, 1, 1, ALEA_MAX)).toBe(100); // brut 105 -> 100
});

test("reviewScore = 0 si un facteur est nul", () => {
  expect(reviewScore(1, 0, 1, 1)).toBe(0);
});

test("drawAlea reste dans [ALEA_MIN, ALEA_MAX] aux bornes du rng", () => {
  expect(drawAlea(() => 0)).toBeCloseTo(ALEA_MIN, 10);
  expect(drawAlea(() => 1)).toBeCloseTo(ALEA_MAX, 10);
  expect(drawAlea(() => 0.5)).toBeCloseTo(1.0, 10);
});
