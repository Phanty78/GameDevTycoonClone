/**
 * Émission de jetons JWT (auth). HS256 via le helper de Hono.
 *
 * Le secret vient de JWT_SECRET (cf. .env.example) ; on échoue tôt et clairement
 * s'il manque, plutôt que de signer avec une valeur vide. L'expiration est
 * portée par le claim standard `exp` (vérifié par le middleware).
 */
import { sign } from "hono/jwt";

/** Durée de validité d'un token : 7 jours (cf. décision produit). */
export const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** Contenu de notre JWT : `sub` = id utilisateur, `exp` = expiration (epoch s). */
export interface JwtPayload {
  sub: number;
  exp: number;
  // Index signature : compatibilité avec le type JWTPayload du helper Hono.
  [key: string]: unknown;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET manquante : copier .env.example vers .env.");
  }
  return secret;
}

/** Signe un token pour un utilisateur, expirant dans JWT_EXPIRY_SECONDS. */
export function signToken(userId: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS;
  const payload: JwtPayload = { sub: userId, exp };
  return sign(payload, getSecret());
}
