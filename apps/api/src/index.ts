import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { env } from "./env.js";

async function main() {
  const app = await createApp();

  serve(
    {
      fetch: app.fetch,
      hostname: env.API_HOST,
      port: env.API_PORT,
    },
    (info) => {
      console.log(`API running at ${env.API_BASE_URL}`);
      console.log(`Listening on ${info.address}:${info.port}`);
      console.log(`OpenAPI spec at ${env.API_BASE_URL}/openapi.json`);
      console.log(`Redoc at ${env.API_BASE_URL}/docs`);
    }
  );
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
