import { sql } from "drizzle-orm";
import { db, pool } from "./client.js";

async function main() {
  console.log("Dropping database schemas...");
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  console.log("Database schema dropped.");
}

main()
  .catch((error) => {
    console.error("Database drop failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
