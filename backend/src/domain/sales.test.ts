import { expect, test } from "bun:test";
import { computeRevenue, computeSales, salesBase } from "./sales";

const pc = { id: "pc", name: "PC", marketSizeMillions: 5.7 };
const recent = { id: "swap", name: "Swap", marketSizeMillions: null };

test("salesBase met la taille de marché à l'échelle", () => {
  expect(salesBase(pc)).toBeCloseTo(5.7 * 1000, 6);
});

test("salesBase retombe sur le fallback quand marketSize est null", () => {
  // FALLBACK_MARKET_SIZE = 1.0 -> 1.0 * 1000.
  expect(salesBase(recent)).toBeCloseTo(1000, 6);
});

test("computeSales applique base * note^1.5 et arrondit", () => {
  // base 1000, note 100 -> 100^1.5 = 1000 -> 1_000_000.
  expect(computeSales(1000, 100)).toBe(1_000_000);
  // note 0 -> 0.
  expect(computeSales(1000, 0)).toBe(0);
});

test("computeSales croît plus vite que la note (exposant 1.5)", () => {
  // doubler la note (40 -> 80) multiplie les ventes par 2^1.5 ≈ 2.83.
  const low = computeSales(1000, 40);
  const high = computeSales(1000, 80);
  expect(high / low).toBeCloseTo(2 ** 1.5, 2);
});

test("computeRevenue = copies * prix unitaire (7)", () => {
  expect(computeRevenue(1_000_000)).toBe(7_000_000);
});
