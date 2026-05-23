/**
 * Routes d'authentification (DESIGN.md §5) : POST /auth/register, /auth/login.
 *
 * Sécurité :
 *   - mot de passe jamais stocké en clair (hashPassword) ni renvoyé.
 *   - login renvoie une erreur GÉNÉRIQUE (email inconnu et mauvais mot de passe
 *     indistinguables) → pas d'énumération de comptes.
 *   - erreur attendue (validation, email pris, identifiants) → statut dédié ;
 *     erreur inattendue → reportError + 500 (l'erreur d'origine n'est pas masquée).
 */
import type {
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
} from "@gdt/contracts";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { reportError } from "../lib/errors";
import { hashPassword, verifyPassword } from "./passwords";
import { signToken } from "./tokens";

export const authRoutes = new Hono();

/** Lit le corps JSON ou null si illisible (corps absent / JSON malformé). */
async function readJson<T>(c: { req: { json: () => Promise<T> } }) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/** Valide des identifiants d'inscription. Renvoie un message d'erreur ou null. */
function validateRegister(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Corps de requête invalide.";
  const { email, password } = body as Partial<RegisterInput>;
  if (typeof email !== "string" || typeof password !== "string") {
    return "email et password requis.";
  }
  if (!email.includes("@")) return "Email invalide.";
  if (password.length < 8) return "Mot de passe : 8 caractères minimum.";
  return null;
}

/** Code SQLSTATE d'une violation de contrainte unique Postgres. */
const PG_UNIQUE_VIOLATION = "23505";

/** Lit un éventuel code SQLSTATE sur une valeur inconnue. */
function sqlstate(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code: unknown }).code;
  }
  return undefined;
}

/**
 * Vrai si l'erreur est une violation de contrainte unique (email pris). Drizzle
 * enveloppe l'erreur pg dans un DrizzleQueryError : le code vit sur `.cause`.
 */
function isUniqueViolation(error: unknown): boolean {
  if (sqlstate(error) === PG_UNIQUE_VIOLATION) return true;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return sqlstate(cause) === PG_UNIQUE_VIOLATION;
}

authRoutes.post("/register", async (c) => {
  const body = await readJson<RegisterInput>(c);
  const invalid = validateRegister(body);
  if (invalid) return c.json({ error: invalid }, 400);

  const { email, password } = body as RegisterInput;
  try {
    const passwordHash = await hashPassword(password);
    const [row] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id });
    const result: RegisterResult = { userId: String(row?.id) };
    return c.json(result, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: "Email déjà utilisé." }, 409);
    }
    await reportError(error, "POST /auth/register");
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

authRoutes.post("/login", async (c) => {
  const body = await readJson<LoginInput>(c);
  const email = (body as Partial<LoginInput> | null)?.email;
  const password = (body as Partial<LoginInput> | null)?.password;
  if (typeof email !== "string" || typeof password !== "string") {
    return c.json({ error: "email et password requis." }, 400);
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    // Message générique quel que soit le champ fautif : anti-énumération.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.json({ error: "Identifiants invalides." }, 401);
    }
    const result: LoginResult = { token: await signToken(user.id) };
    return c.json(result, 200);
  } catch (error) {
    await reportError(error, "POST /auth/login");
    return c.json({ error: "Erreur serveur." }, 500);
  }
});
