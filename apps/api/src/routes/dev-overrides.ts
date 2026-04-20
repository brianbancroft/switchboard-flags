import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  appEnvironments,
  type DevOverride,
  devOverrides,
} from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  devOverrideSchema,
  devOverrideToggleInputSchema,
  serializeDevOverride,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { assertAppPermission } from "../lib/permissions.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const devOverrideDataSchema = z.object({
  devOverride: devOverrideSchema,
});

const getDevOverrideRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/dev-overrides",
  tags: ["DevOverrides"],
  summary: "Get the current user's dev override preferences for an app",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
  },
  responses: {
    200: successResponse(devOverrideDataSchema, "Dev override preferences"),
    ...defaultErrorResponses(),
  },
});

const toggleDevOverrideRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/dev-overrides/toggle",
  tags: ["DevOverrides"],
  summary: "Toggle an environment in or out of the dev override set",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: devOverrideToggleInputSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(devOverrideDataSchema, "Dev override updated"),
    ...defaultErrorResponses(),
  },
});

export function registerDevOverrideRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(getDevOverrideRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = paramsSchema.parse(c.req.param());
    const userId = c.get("user").id;

    const existing = await db.query.devOverrides.findFirst({
      where: and(
        eq(devOverrides.userId, userId),
        eq(devOverrides.appId, params.appId)
      ),
    });

    if (!existing) {
      // Return a synthetic empty record — no row needed until the first toggle
      const now = new Date().toISOString();
      return jsonSuccess(c, {
        devOverride: {
          id: "",
          userId,
          appId: params.appId,
          environments: [] as string[],
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    return jsonSuccess(c, { devOverride: serializeDevOverride(existing) });
  });

  openapi(toggleDevOverrideRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, devOverrideToggleInputSchema);
    const userId = c.get("user").id;

    // Validate the environment belongs to this app
    const env = await db.query.appEnvironments.findFirst({
      where: and(
        eq(appEnvironments.appId, params.appId),
        eq(appEnvironments.id, body.environmentId)
      ),
    });
    if (!env) {
      throw new AppError(404, "ENVIRONMENT_NOT_FOUND", "Environment not found");
    }

    const existing = await db.query.devOverrides.findFirst({
      where: and(
        eq(devOverrides.userId, userId),
        eq(devOverrides.appId, params.appId)
      ),
    });

    const envSet = new Set(existing?.environments ?? []);
    if (envSet.has(body.environmentId)) {
      envSet.delete(body.environmentId);
    } else {
      envSet.add(body.environmentId);
    }
    const updatedEnvironments = [...envSet];

    let record: DevOverride | undefined;
    if (existing) {
      const [updated] = await db
        .update(devOverrides)
        .set({ environments: updatedEnvironments })
        .where(eq(devOverrides.id, existing.id))
        .returning();
      record = updated;
    } else {
      const [inserted] = await db
        .insert(devOverrides)
        .values({
          userId,
          appId: params.appId,
          environments: updatedEnvironments,
        })
        .returning();
      record = inserted;
    }

    if (!record) {
      throw new Error("Dev override upsert returned no row");
    }

    return jsonSuccess(c, { devOverride: serializeDevOverride(record) });
  });
}
