import { pool } from "./client.js";
import { runMigrations } from "./migrations.js";

async function main() {
  console.log("Running database migrations...");
  await runMigrations();
  console.log("Database migrations complete.");
}

main()
  .catch((error) => {
    console.error("Database migration failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
