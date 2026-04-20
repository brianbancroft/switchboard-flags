import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { featureFlags, flagAuditLog } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  featureFlagCreateInputSchema,
  featureFlagSchema,
  featureFlagUpdateInputSchema,
  serializeFeatureFlag,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { bumpFlagsVersion } from "../lib/flag-versions.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { assertAppPermission } from "../lib/permissions.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const flagParamsSchema = paramsSchema.extend({
  flagId: z.string().uuid(),
});

const listFlagsDataSchema = z.object({
  flags: z.array(featureFlagSchema),
});

const flagDataSchema = z.object({
  flag: featureFlagSchema,
});

const deleteFlagDataSchema = z.object({
  deleted: z.literal(true),
});

const listFlagsRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/flags",
  tags: ["Feature Flags"],
  summary: "List feature flags in an app",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
  },
  responses: {
    200: successResponse(listFlagsDataSchema, "App feature flags"),
    ...defaultErrorResponses(),
  },
});

const createFlagRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/flags",
  tags: ["Feature Flags"],
  summary: "Create a feature flag",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: featureFlagCreateInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(flagDataSchema, "Feature flag created"),
    ...defaultErrorResponses(),
  },
});

const getFlagRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/flags/{flagId}",
  tags: ["Feature Flags"],
  summary: "Get a feature flag",
  security: [{ bearerAuth: [] }],
  request: {
    params: flagParamsSchema,
  },
  responses: {
    200: successResponse(flagDataSchema, "Feature flag details"),
    ...defaultErrorResponses(),
  },
});

const updateFlagRoute = createRoute({
  method: "patch",
  path: "/api/v1/apps/{appId}/flags/{flagId}",
  tags: ["Feature Flags"],
  summary: "Update a feature flag",
  security: [{ bearerAuth: [] }],
  request: {
    params: flagParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: featureFlagUpdateInputSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(flagDataSchema, "Feature flag updated"),
    ...defaultErrorResponses(),
  },
});

const deleteFlagRoute = createRoute({
  method: "delete",
  path: "/api/v1/apps/{appId}/flags/{flagId}",
  tags: ["Feature Flags"],
  summary: "Delete a feature flag",
  security: [{ bearerAuth: [] }],
  request: {
    params: flagParamsSchema,
  },
  responses: {
    200: successResponse(deleteFlagDataSchema, "Feature flag deleted"),
    ...defaultErrorResponses(),
  },
});

async function getFlagOrThrow(appId: string, flagId: string) {
  const flag = await db.query.featureFlags.findFirst({
    where: and(eq(featureFlags.appId, appId), eq(featureFlags.id, flagId)),
  });

  if (!flag) {
    throw new AppError(404, "FLAG_NOT_FOUND", "Feature flag not found");
  }

  return flag;
}

export function registerFeatureFlagRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listFlagsRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());
    const flags = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.appId, params.appId))
      .orderBy(asc(featureFlags.name));

    return jsonSuccess(c, {
      flags: flags.map(serializeFeatureFlag),
    });
  });

  openapi(createFlagRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, featureFlagCreateInputSchema);
    const userId = c.get("user").id;

    const [flag] = await db
      .insert(featureFlags)
      .values({
        appId: params.appId,
        name: body.name,
        description: body.description ?? null,
        config: body.config,
      })
      .returning();

    if (!flag) {
      throw new Error("Feature flag insert returned no row");
    }

    await db.insert(flagAuditLog).values({
      actionType: "flag_created",
      flagId: flag.id,
      flagName: flag.name,
      appId: params.appId,
      changedByUserId: userId,
      newValue: flag.config,
    });

    await bumpFlagsVersion(params.appId, null);

    return jsonSuccess(
      c,
      {
        flag: serializeFeatureFlag(flag),
      },
      201
    );
  });

  openapi(getFlagRoute, async (c) => {
    const params = flagParamsSchema.parse(c.req.param());
    const flag = await getFlagOrThrow(params.appId, params.flagId);

    return jsonSuccess(c, {
      flag: serializeFeatureFlag(flag),
    });
  });

  openapi(updateFlagRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = flagParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, featureFlagUpdateInputSchema);
    const userId = c.get("user").id;

    const existing = await getFlagOrThrow(params.appId, params.flagId);

    const [flag] = await db
      .update(featureFlags)
      .set({
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
        ...(body.config === undefined ? {} : { config: body.config }),
      })
      .where(
        and(
          eq(featureFlags.appId, params.appId),
          eq(featureFlags.id, params.flagId)
        )
      )
      .returning();

    if (!flag) {
      throw new Error("Feature flag update returned no row");
    }

    await db.insert(flagAuditLog).values({
      actionType: "flag_updated",
      flagId: flag.id,
      flagName: flag.name,
      appId: params.appId,
      changedByUserId: userId,
      oldValue: {
        name: existing.name,
        description: existing.description,
        config: existing.config,
      },
      newValue: {
        name: flag.name,
        description: flag.description,
        config: flag.config,
      },
    });

    await bumpFlagsVersion(params.appId, null);

    return jsonSuccess(c, {
      flag: serializeFeatureFlag(flag),
    });
  });

  openapi(deleteFlagRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "admin");
    const params = flagParamsSchema.parse(c.req.param());
    const userId = c.get("user").id;
    const flag = await getFlagOrThrow(params.appId, params.flagId);

    // Write audit log BEFORE deleting (FK will SET NULL after deletion)
    await db.insert(flagAuditLog).values({
      actionType: "flag_deleted",
      flagId: flag.id,
      flagName: flag.name,
      appId: params.appId,
      changedByUserId: userId,
      oldValue: flag.config,
    });

    await db
      .delete(featureFlags)
      .where(
        and(
          eq(featureFlags.appId, params.appId),
          eq(featureFlags.id, params.flagId)
        )
      );

    await bumpFlagsVersion(params.appId, null);

    return jsonSuccess(c, {
      deleted: true as const,
    });
  });
}
