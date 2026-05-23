/**
 * Configuration drizzle-kit (génération de migrations + push).
 * Les migrations SQL sont versionnées dans backend/drizzle/.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
