import { Hono } from "hono";
import { authRoutes } from "./auth/routes";

/**
 * Point d'entrée de l'API. Routes d'auth montées (DESIGN.md §5) ; les routes de
 * jeu (/games, /leaderboard) viennent ensuite, protégées par requireAuth.
 * Toute la logique de jeu vit dans une couche domaine pure, jamais exposée au front.
 */
const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};
