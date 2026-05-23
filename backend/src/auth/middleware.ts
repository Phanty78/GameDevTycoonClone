/**
 * Protection JWT des routes de jeu (DESIGN.md §5 : /games, etc. authentifiées).
 *
 * S'appuie sur le middleware `jwt` de Hono : lit l'en-tête `Authorization:
 * Bearer <token>`, vérifie signature + expiration, et place le payload décodé
 * dans le contexte. `requireAuth()` construit ce middleware avec notre secret ;
 * `getUserId()` est le seul accès typé au `sub` côté handlers.
 */
import type { Context } from "hono";
import { jwt } from "hono/jwt";
import type { JwtPayload } from "./tokens";

/** Middleware exigeant un JWT valide. Répond 401 si absent/invalide/expiré. */
export function requireAuth() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET manquante : copier .env.example vers .env.");
  }
  return jwt({ secret, alg: "HS256" });
}

/** Id de l'utilisateur authentifié, lu du payload posé par requireAuth(). */
export function getUserId(c: Context): number {
  const payload = c.get("jwtPayload") as JwtPayload | undefined;
  if (!payload) {
    throw new Error(
      "getUserId appelé hors d'une route protégée par requireAuth",
    );
  }
  return payload.sub;
}
