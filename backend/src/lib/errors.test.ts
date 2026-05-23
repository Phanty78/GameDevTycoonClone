import { expect, test } from "bun:test";
import { reportError } from "./errors";

/** Fabrique un faux fetch qui capture l'appel et renvoie un statut donné. */
function fakeFetch(status = 204) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test("reportError poste le contenu sur le webhook injecté", async () => {
  const { calls, fetchImpl } = fakeFetch();
  await reportError(new Error("boom"), "POST /games", {
    webhookUrl: "https://hook.test/x",
    fetchImpl,
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe("https://hook.test/x");
  const content = (calls[0]?.body as { content: string }).content;
  expect(content).toContain("POST /games");
  expect(content).toContain("boom");
});

test("reportError tronque le contenu sous la limite Discord (2000)", async () => {
  const { calls, fetchImpl } = fakeFetch();
  const huge = new Error("x".repeat(5000));
  await reportError(huge, undefined, {
    webhookUrl: "https://hook.test/x",
    fetchImpl,
  });

  const content = (calls[0]?.body as { content: string }).content;
  expect(content.length).toBeLessThanOrEqual(2000);
});

test("reportError ne fait aucun appel quand le webhook est absent", async () => {
  const { calls, fetchImpl } = fakeFetch();
  await reportError(new Error("boom"), undefined, {
    webhookUrl: "",
    fetchImpl,
  });
  expect(calls).toHaveLength(0);
});

test("reportError ne jette jamais, même si fetch échoue", async () => {
  const fetchImpl = (async () => {
    throw new Error("réseau KO");
  }) as unknown as typeof fetch;

  // Ne doit pas rejeter.
  await expect(
    reportError(new Error("boom"), "ctx", {
      webhookUrl: "https://hook.test/x",
      fetchImpl,
    }),
  ).resolves.toBeUndefined();
});
