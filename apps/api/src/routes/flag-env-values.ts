import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  appEnvironments,
  featureFlags,
  flagAuditLog,
  flagEnvironmentValues,
  users,
} from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  flagAuditLogEntrySchema,
  flagEnvValueSchema,
  flagEnvValueSetInputSchema,
  serializeFlagAuditLogEntry,
  serializeFlagEnvValue,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { bumpFlagsVersion } from "../lib/flag-versions.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { assertAppPermission } from "../lib/permissions.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
  flagId: z.string().uuid(),
});

const envValueParamsSchema = paramsSchema.extend({
  environmentId: z.string().uuid(),
});

const listEnvValuesDataSchema = z.object({
  envValues: z.array(flagEnvValueSchema),
});

const envValueDataSchema = z.object({
  envValue: flagEnvValueSchema,
});

const listAuditLogDataSchema = z.object({
  entries: z.array(flagAuditLogEntrySchema),
});

const listEnvValuesRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/flags/{flagId}/env-values",
  tags: ["Feature Flags"],
  summary: "List per-environment values for a flag",
  security: [{ bearerAuth: [] }],
  request: { params: paramsSchema },
  responses: {
    200: successResponse(listEnvValuesDataSchema, "Flag environment values"),
    ...defaultErrorResponses(),
  },
});

const setEnvValueRoute = createRoute({
  method: "put",
  path: "/api/v1/apps/{appId}/flags/{flagId}/env-values/{environmentId}",
  tags: ["Feature Flags"],
  summary: "Set per-environment value for a flag",
  security: [{ bearerAuth: [] }],
  request: {
    params: envValueParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: flagEnvValueSetInputSchema },
      },
    },
  },
  responses: {
    200: successResponse(envValueDataSchema, "Flag environment value set"),
    ...defaultErrorResponses(),
  },
});

const listAuditLogRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/flags/{flagId}/audit-log",
  tags: ["Feature Flags"],
  summary: "Fetch audit log for a flag",
  security: [{ bearerAuth: [] }],
  request: { params: paramsSchema },
  responses: {
    200: successResponse(listAuditLogDataSchema, "Flag audit log"),
    ...defaultErrorResponses(),
  },
});

async function getFlagOrThrow(appId: string, flagId: string) {
  const flag = await db.query.featureFlags.findFirst({
    where: and(eq(featureFlags.appId, appId), eq(featureFlags.id, flagId)),
  });
  if (!flag)
    throw new AppError(404, "FLAG_NOT_FOUND", "Feature flag not found");
  return flag;
}

async function getEnvironmentOrThrow(appId: string, environmentId: string) {
  const env = await db.query.appEnvironments.findFirst({
    where: and(
      eq(appEnvironments.appId, appId),
      eq(appEnvironments.id, environmentId)
    ),
  });
  if (!env)
    throw new AppError(404, "ENVIRONMENT_NOT_FOUND", "Environment not found");
  return env;
}

export function registerFlagEnvValueRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listEnvValuesRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());
    await getFlagOrThrow(params.appId, params.flagId);

    const rows = await db
      .select()
      .from(flagEnvironmentValues)
      .where(
        and(
          eq(flagEnvironmentValues.appId, params.appId),
          eq(flagEnvironmentValues.flagId, params.flagId)
        )
      );

    // Batch-load users
    const userIds = [
      ...new Set(
        rows.map((r) => r.changedByUserId).filter(Boolean) as string[]
      ),
    ];
    const userMap = new Map<
      string,
      { id: string; name: string | null; email: string }
    >();
    if (userIds.length > 0) {
      const fetched = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of fetched) userMap.set(u.id, u);
    }

    return jsonSuccess(c, {
      envValues: rows.map((r) =>
        serializeFlagEnvValue(
          r,
          r.changedByUserId ? (userMap.get(r.changedByUserId) ?? null) : null
        )
      ),
    });
  });

  openapi(setEnvValueRoute, async (c) => {
    const params = envValueParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, flagEnvValueSetInputSchema);

    const flag = await getFlagOrThrow(params.appId, params.flagId);
    const environment = await getEnvironmentOrThrow(
      params.appId,
      params.environmentId
    );

    // Developers can only toggle flags in dev environments; non-dev envs
    // (staging, production, nightly, ...) require manager or higher.
    assertAppPermission(
      c.get("appAccess"),
      environment.isDev ? "developer" : "manager"
    );

    const userId = c.get("user").id;

    // Read existing value for audit log
    const existing = await db.query.flagEnvironmentValues.findFirst({
      where: and(
        eq(flagEnvironmentValues.flagId, params.flagId),
        eq(flagEnvironmentValues.environmentId, params.environmentId)
      ),
    });

    // Upsert the env value
    const [row] = await db
      .insert(flagEnvironmentValues)
      .values({
        flagId: params.flagId,
        appId: params.appId,
        environmentId: params.environmentId,
        value: body.value,
        changedByUserId: userId,
      })
      .onConflictDoUpdate({
        target: [
          flagEnvironmentValues.flagId,
          flagEnvironmentValues.environmentId,
        ],
        set: {
          value: body.value,
          changedByUserId: userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error("Upsert returned no row");

    // Write audit log entry
    await db.insert(flagAuditLog).values({
      actionType: "flag_value_changed",
      flagId: params.flagId,
      flagName: flag.name,
      appId: params.appId,
      environmentId: params.environmentId,
      changedByUserId: userId,
      oldValue: existing?.value ?? null,
      newValue: body.value,
    });

    await bumpFlagsVersion(params.appId, params.environmentId);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true },
    });

    return jsonSuccess(c, {
      envValue: serializeFlagEnvValue(row, user ?? null),
    });
  });

  openapi(listAuditLogRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());
    await getFlagOrThrow(params.appId, params.flagId);

    const entries = await db
      .select()
      .from(flagAuditLog)
      .where(
        and(
          eq(flagAuditLog.appId, params.appId),
          eq(flagAuditLog.flagId, params.flagId)
        )
      )
      .orderBy(desc(flagAuditLog.changedAt))
      .limit(200);

    const userIds = [
      ...new Set(
        entries.map((e) => e.changedByUserId).filter(Boolean) as string[]
      ),
    ];
    const userMap = new Map<
      string,
      { id: string; name: string | null; email: string }
    >();
    if (userIds.length > 0) {
      const fetched = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of fetched) userMap.set(u.id, u);
    }

    return jsonSuccess(c, {
      entries: entries.map((e) =>
        serializeFlagAuditLogEntry(
          e,
          e.changedByUserId ? (userMap.get(e.changedByUserId) ?? null) : null
        )
      ),
    });
  });
}
