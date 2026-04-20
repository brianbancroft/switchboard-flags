import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { env } from "../env.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  successResponse,
} from "../lib/api.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import type { AppBindings } from "../lib/types.js";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("switchboard-api"),
  environment: z.string(),
  timestamp: z.string().datetime(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Check API health",
  responses: {
    200: successResponse(healthResponseSchema, "Service is healthy"),
    ...defaultErrorResponses(),
  },
});

export function registerHealthRoute(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(healthRoute, (c) =>
    jsonSuccess(c, {
      status: "ok" as const,
      service: "switchboard-api" as const,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    })
  );
}
