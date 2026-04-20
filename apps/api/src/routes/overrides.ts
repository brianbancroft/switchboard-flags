import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { featureFlags, flagOverrides, users } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  flagOverrideCreateInputSchema,
  flagOverrideListQuerySchema,
  flagOverrideSchema,
  flagOverrideUpdateInputSchema,
  isValueCompatibleWithFlagType,
  serializeFlagOverride,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import {
  assertAppPermission,
  assertCanManageOverrideForUser,
  canAccessApp,
} from "../lib/permissions.js";

import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const overrideParamsSchema = paramsSchema.extend({
  overrideId: z.string().uuid(),
});

const listOverridesDataSchema = z.object({
  overrides: z.array(flagOverrideSchema),
});

const overrideDataSchema = z.object({
  override: flagOverrideSchema,
});

const deleteOverrideDataSchema = z.object({
  deleted: z.literal(true),
});

const listOverridesRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/overrides",
  tags: ["Overrides"],
  summary: "List flag overrides in an app",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    query: flagOverrideListQuerySchema,
  },
  responses: {
    200: successResponse(listOverridesDataSchema, "Flag overrides"),
    ...defaultErrorResponses(),
  },
});

const createOverrideRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/overrides",
  tags: ["Overrides"],
  summary: "Create a flag override",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: flagOverrideCreateInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(overrideDataSchema, "Override created"),
    ...defaultErrorResponses(),
  },
});

const updateOverrideRoute = createRoute({
  method: "patch",
  path: "/api/v1/apps/{appId}/overrides/{overrideId}",
  tags: ["Overrides"],
  summary: "Update a flag override",
  security: [{ bearerAuth: [] }],
  request: {
    params: overrideParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: flagOverrideUpdateInputSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(overrideDataSchema, "Override updated"),
    ...defaultErrorResponses(),
  },
});

const deleteOverrideRoute = createRoute({
  method: "delete",
  path: "/api/v1/apps/{appId}/overrides/{overrideId}",
  tags: ["Overrides"],
  summary: "Delete a flag override",
  security: [{ bearerAuth: [] }],
  request: {
    params: overrideParamsSchema,
  },
  responses: {
    200: successResponse(deleteOverrideDataSchema, "Override deleted"),
    ...defaultErrorResponses(),
  },
});

async function getFlagForOverrideOrThrow(appId: string, flagId: string) {
  const flag = await db.query.featureFlags.findFirst({
    where: and(eq(featureFlags.appId, appId), eq(featureFlags.id, flagId)),
  });

  if (!flag) {
    throw new AppError(404, "FLAG_NOT_FOUND", "Feature flag not found");
  }

  return flag;
}

async function ensureUserExists(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }
}

async function getOverrideOrThrow(appId: string, overrideId: string) {
  const override = await db.query.flagOverrides.findFirst({
    where: and(
      eq(flagOverrides.appId, appId),
      eq(flagOverrides.id, overrideId)
    ),
  });

  if (!override) {
    throw new AppError(404, "OVERRIDE_NOT_FOUND", "Flag override not found");
  }

  return override;
}

export function registerOverrideRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listOverridesRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = paramsSchema.parse(c.req.param());
    const query = flagOverrideListQuerySchema.parse(c.req.query());

    const conditions = [eq(flagOverrides.appId, params.appId)];
    if (query.flagId) {
      conditions.push(eq(flagOverrides.flagId, query.flagId));
    }

    const canManageAllOverrides = canAccessApp(c.get("appAccess"), "manager");

    if (
      !canManageAllOverrides &&
      query.userId &&
      query.userId !== c.get("user").id
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Developers can only list their own overrides"
      );
    }

    const effectiveUserId = canManageAllOverrides
      ? query.userId
      : c.get("user").id;

    if (effectiveUserId) {
      conditions.push(eq(flagOverrides.userId, effectiveUserId));
    }

    const overrides = await db
      .select()
      .from(flagOverrides)
      .where(and(...conditions))
      .orderBy(asc(flagOverrides.createdAt));

    return jsonSuccess(c, {
      overrides: overrides.map(serializeFlagOverride),
    });
  });

  openapi(createOverrideRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, flagOverrideCreateInputSchema);
    const flag = await getFlagForOverrideOrThrow(params.appId, body.flagId);
    await ensureUserExists(body.userId);
    assertCanManageOverrideForUser(
      c.get("appAccess"),
      body.userId,
      c.get("user").id
    );

    if (!isValueCompatibleWithFlagType(body.value, flag.config.type)) {
      throw new AppError(
        400,
        "INVALID_OVERRIDE_VALUE",
        `Override value must match the ${flag.config.type} flag type`
      );
    }

    const [override] = await db
      .insert(flagOverrides)
      .values({
        appId: params.appId,
        flagId: body.flagId,
        userId: body.userId,
        value: body.value,
      })
      .returning();

    if (!override) {
      throw new Error("Override insert returned no row");
    }

    return jsonSuccess(
      c,
      {
        override: serializeFlagOverride(override),
      },
      201
    );
  });

  openapi(updateOverrideRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = overrideParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, flagOverrideUpdateInputSchema);
    const currentOverride = await getOverrideOrThrow(
      params.appId,
      params.overrideId
    );
    assertCanManageOverrideForUser(
      c.get("appAccess"),
      currentOverride.userId,
      c.get("user").id
    );
    const flag = await getFlagForOverrideOrThrow(
      params.appId,
      currentOverride.flagId
    );

    if (!isValueCompatibleWithFlagType(body.value, flag.config.type)) {
      throw new AppError(
        400,
        "INVALID_OVERRIDE_VALUE",
        `Override value must match the ${flag.config.type} flag type`
      );
    }

    const [override] = await db
      .update(flagOverrides)
      .set({
        value: body.value,
      })
      .where(
        and(
          eq(flagOverrides.appId, params.appId),
          eq(flagOverrides.id, params.overrideId)
        )
      )
      .returning();

    if (!override) {
      throw new Error("Override update returned no row");
    }

    return jsonSuccess(c, {
      override: serializeFlagOverride(override),
    });
  });

  openapi(deleteOverrideRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = overrideParamsSchema.parse(c.req.param());
    const currentOverride = await getOverrideOrThrow(
      params.appId,
      params.overrideId
    );
    assertCanManageOverrideForUser(
      c.get("appAccess"),
      currentOverride.userId,
      c.get("user").id
    );

    await db
      .delete(flagOverrides)
      .where(
        and(
          eq(flagOverrides.appId, params.appId),
          eq(flagOverrides.id, params.overrideId)
        )
      );

    return jsonSuccess(c, {
      deleted: true as const,
    });
  });
}
