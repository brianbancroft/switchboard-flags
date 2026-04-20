import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  defaultErrorResponses,
  jsonError,
  jsonSuccess,
  successResponse,
} from "../lib/api.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import type { AppBindings } from "../lib/types.js";

const databaseHealthOkSchema = z.object({
  status: z.literal("ok"),
  database: z.literal("connected"),
  checkedAt: z.string().datetime(),
});

const _databaseHealthErrorSchema = z.object({
  status: z.literal("error"),
  database: z.literal("unavailable"),
  checkedAt: z.string().datetime(),
  message: z.string(),
});

const databaseHealthRoute = createRoute({
  method: "get",
  path: "/db/health",
  tags: ["System"],
  summary: "Check database connectivity",
  responses: {
    200: successResponse(
      databaseHealthOkSchema,
      "Database connection is healthy"
    ),
    ...defaultErrorResponses({
      503: "Database is unavailable",
    }),
  },
});

export function registerDatabaseHealthRoute(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(databaseHealthRoute, async (c) => {
    const checkedAt = new Date().toISOString();

    try {
      await db.execute(sql`select 1`);

      return jsonSuccess(c, {
        status: "ok",
        database: "connected",
        checkedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown database error";

      return jsonError(
        c,
        503,
        "DATABASE_UNAVAILABLE",
        "Database is unavailable",
        {
          status: "error" as const,
          database: "unavailable" as const,
          checkedAt,
          message,
        }
      );
    }
  });
}
