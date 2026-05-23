/**
 * Hachage de mots de passe (I/O CPU — hors couche domaine de jeu).
 *
 * Fine couche au-dessus de Bun.password : argon2id par défaut (salt inclus dans
 * le hash, pas de colonne salt séparée). Isolé ici pour verrouiller le choix
 * d'algo en un seul endroit et garder un point de remplacement testable.
 */

/** Hache un mot de passe en clair. Lent par conception (anti-bruteforce). */
export function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain);
}

/** Vérifie un mot de passe contre un hash stocké. Paramètres relus du hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}
