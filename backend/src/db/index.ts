/**
 * Client base de données (I/O — hors couche domaine pure).
 *
 * Expose une instance Drizzle unique, partagée par les routes. La connexion se
 * fait via DATABASE_URL (cf. .env.example). On échoue tôt et clairement si la
 * variable manque, plutôt que de laisser une erreur réseau opaque plus tard.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL manquante : copier .env.example vers .env.");
}

const pool = new Pool({ connectionString });

/** Instance Drizzle typée par le schéma : `db.query.users`, `db.insert(...)`, etc. */
export const db = drizzle(pool, { schema });

export { schema };
