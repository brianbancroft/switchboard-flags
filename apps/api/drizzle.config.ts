import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

loadEnv({
  path: fileURLToPath(new URL("./.env", import.meta.url)),
  override: true,
  quiet: true,
});

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/switchboard",
  },
  strict: true,
  verbose: true,
});
