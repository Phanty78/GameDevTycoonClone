import { Hono } from "hono";

/**
 * Point d'entrée de l'API. Squelette : seule la route de santé existe.
 * Les routes de jeu (auth, /games, /leaderboard — DESIGN.md §5) viennent ensuite.
 * Toute la logique de jeu vivra dans une couche domaine pure, jamais exposée au front.
 */
const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};
