import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  appEnvironments,
  appMembers,
  appProductionAddresses,
  apps,
} from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  deriveLegacyAddressesFromEnvironments,
  mergeAppEnvironments,
} from "../lib/app-environments.js";
import {
  appCreateInputSchema,
  appSchema,
  appUpdateInputSchema,
  serializeApp,
} from "../lib/contracts.js";
import { invalidateDbOriginsCache } from "../lib/cors-origins.js";
import { AppError } from "../lib/errors.js";
import { bumpFlagsVersion } from "../lib/flag-versions.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { assertAppPermission, listAccessibleApps } from "../lib/permissions.js";
import type { AppBindings } from "../lib/types.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const appIdParamsSchema = z.object({
  appId: z.string().uuid(),
});

const listAppsDataSchema = z.object({
  apps: z.array(appSchema),
});

const appDataSchema = z.object({
  app: appSchema,
});

const deleteAppDataSchema = z.object({
  deleted: z.literal(true),
});

const listAppsRoute = createRoute({
  method: "get",
  path: "/api/v1/apps",
  tags: ["Apps"],
  summary: "List apps visible to the authenticated UI user",
  security: [{ bearerAuth: [] }],
  responses: {
    200: successResponse(listAppsDataSchema, "Accessible apps"),
    ...defaultErrorResponses(),
  },
});

const createAppRoute = createRoute({
  method: "post",
  path: "/api/v1/apps",
  tags: ["Apps"],
  summary: "Create a new app",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: appCreateInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(appDataSchema, "App created"),
    ...defaultErrorResponses(),
  },
});

const getAppRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}",
  tags: ["Apps"],
  summary: "Get one app",
  security: [{ bearerAuth: [] }],
  request: {
    params: appIdParamsSchema,
  },
  responses: {
    200: successResponse(appDataSchema, "App details"),
    ...defaultErrorResponses(),
  },
});

const updateAppRoute = createRoute({
  method: "patch",
  path: "/api/v1/apps/{appId}",
  tags: ["Apps"],
  summary: "Update app metadata",
  security: [{ bearerAuth: [] }],
  request: {
    params: appIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: appUpdateInputSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(appDataSchema, "App updated"),
    ...defaultErrorResponses(),
  },
});

const deleteAppRoute = createRoute({
  method: "delete",
  path: "/api/v1/apps/{appId}",
  tags: ["Apps"],
  summary: "Delete an app",
  security: [{ bearerAuth: [] }],
  request: {
    params: appIdParamsSchema,
  },
  responses: {
    200: successResponse(deleteAppDataSchema, "App deleted"),
    ...defaultErrorResponses(),
  },
});

async function loadProductionAddressesByAppIds(appIds: string[]) {
  if (appIds.length === 0) {
    return new Map<string, (typeof appProductionAddresses.$inferSelect)[]>();
  }

  const rows = await db
    .select()
    .from(appProductionAddresses)
    .where(inArray(appProductionAddresses.appId, appIds));

  const addressesByAppId = new Map<
    string,
    (typeof appProductionAddresses.$inferSelect)[]
  >();

  for (const row of rows) {
    const current = addressesByAppId.get(row.appId) ?? [];
    current.push(row);
    addressesByAppId.set(row.appId, current);
  }

  return addressesByAppId;
}

async function loadAppEnvironmentsByAppIds(appIds: string[]) {
  if (appIds.length === 0) {
    return new Map<string, (typeof appEnvironments.$inferSelect)[]>();
  }

  const rows = await db
    .select()
    .from(appEnvironments)
    .where(inArray(appEnvironments.appId, appIds))
    .orderBy(asc(appEnvironments.appId), asc(appEnvironments.position));

  const environmentsByAppId = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const current = environmentsByAppId.get(row.appId) ?? [];
    current.push(row);
    environmentsByAppId.set(row.appId, current);
  }

  return environmentsByAppId;
}

function normalizeCreateEnvironments(
  body: z.infer<typeof appCreateInputSchema>
) {
  const normalized =
    body.environments && body.environments.length > 0
      ? body.environments.map((environment, index) => ({
          name: environment.name.trim(),
          address: environment.address ?? null,
          enabled: environment.enabled ?? true,
          position: index,
        }))
      : [
          {
            name: "production",
            address: null,
            enabled: true,
            position: 0,
          },
          {
            name: "staging",
            address: body.stagingAddress ?? null,
            enabled: true,
            position: 1,
          },
          {
            name: "nightly",
            address: body.nightlyAddress ?? null,
            enabled: true,
            position: 2,
          },
        ];

  const seen = new Set<string>();
  for (const environment of normalized) {
    if (!environment.name) {
      throw new AppError(
        400,
        "INVALID_ENVIRONMENT_NAME",
        "Environment names cannot be empty"
      );
    }

    const key = environment.name.toLowerCase();
    if (seen.has(key)) {
      throw new AppError(
        400,
        "DUPLICATE_ENVIRONMENT_NAME",
        `Environment "${environment.name}" is duplicated`
      );
    }
    seen.add(key);
  }

  return normalized;
}

async function syncDefaultEnvironment(
  tx: DbTransaction,
  input: {
    appId: string;
    name: string;
    address: string | null;
  }
) {
  const existing = await tx.query.appEnvironments.findFirst({
    where: (environment, { and, eq }) =>
      and(eq(environment.appId, input.appId), eq(environment.name, input.name)),
  });

  if (existing) {
    await tx
      .update(appEnvironments)
      .set({
        address: input.address,
      })
      .where(eq(appEnvironments.id, existing.id));
    return;
  }

  await tx.insert(appEnvironments).values({
    appId: input.appId,
    name: input.name,
    address: input.address,
    enabled: true,
    position:
      input.name === "production" ? 0 : input.name === "staging" ? 1 : 2,
  });
}

function validateEnvironmentNames(environments: Array<{ name: string }>) {
  const seen = new Set<string>();
  for (const environment of environments) {
    if (!environment.name) {
      throw new AppError(
        400,
        "INVALID_ENVIRONMENT_NAME",
        "Environment names cannot be empty"
      );
    }
    const key = environment.name.toLowerCase();
    if (seen.has(key)) {
      throw new AppError(
        400,
        "DUPLICATE_ENVIRONMENT_NAME",
        `Environment "${environment.name}" is duplicated`
      );
    }
    seen.add(key);
  }
}

async function syncEnvironments(
  tx: DbTransaction,
  appId: string,
  incoming: Array<{
    name: string;
    address?: string | null;
    enabled?: boolean;
  }>
) {
  const normalized = incoming.map((environment, index) => ({
    name: environment.name.trim(),
    address: environment.address ?? null,
    enabled: environment.enabled ?? true,
    position: index,
  }));

  validateEnvironmentNames(normalized);

  const existing = await tx
    .select()
    .from(appEnvironments)
    .where(eq(appEnvironments.appId, appId))
    .orderBy(asc(appEnvironments.position));

  const existingByName = new Map(
    existing.map((row) => [row.name.toLowerCase(), row])
  );

  const incomingNames = normalized.map((environment) =>
    environment.name.toLowerCase()
  );

  // Delete environments no longer in the incoming list; always preserve the dev environment
  const toDelete = existing.filter(
    (row) => !row.isDev && !incomingNames.includes(row.name.toLowerCase())
  );
  if (toDelete.length > 0) {
    await tx.delete(appEnvironments).where(
      inArray(
        appEnvironments.id,
        toDelete.map((row) => row.id)
      )
    );
  }

  // Upsert remaining environments
  for (const environment of normalized) {
    const match = existingByName.get(environment.name.toLowerCase());
    if (match) {
      await tx
        .update(appEnvironments)
        .set({
          name: environment.name,
          address: environment.address,
          enabled: environment.enabled,
          position: environment.position,
        })
        .where(eq(appEnvironments.id, match.id));
    } else {
      await tx.insert(appEnvironments).values({
        appId,
        name: environment.name,
        address: environment.address,
        enabled: environment.enabled,
        position: environment.position,
      });
    }
  }

  return normalized;
}

export function registerEnvironmentRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listAppsRoute, async (c) => {
    const rows = await listAccessibleApps(c.get("user"));
    const addressesByAppId = await loadProductionAddressesByAppIds(
      rows.map(({ environment }) => environment.id)
    );
    const environmentsByAppId = await loadAppEnvironmentsByAppIds(
      rows.map(({ environment }) => environment.id)
    );

    return jsonSuccess(c, {
      apps: rows.map(({ environment, membershipRole }) =>
        serializeApp(environment, {
          environments: mergeAppEnvironments(
            environment,
            addressesByAppId.get(environment.id) ?? [],
            environmentsByAppId.get(environment.id) ?? []
          ),
          membershipRole: membershipRole ?? null,
          isOwner: environment.ownerId === c.get("user").id,
          productionAddresses: addressesByAppId.get(environment.id) ?? [],
        })
      ),
    });
  });

  openapi(createAppRoute, async (c) => {
    const body = await parseJsonBody(c, appCreateInputSchema);
    const user = c.get("user");
    const normalizedEnvironments = normalizeCreateEnvironments(body);
    const legacyAddresses = deriveLegacyAddressesFromEnvironments(
      normalizedEnvironments
    );

    const createdApp = await db.transaction(async (tx) => {
      const [newApp] = await tx
        .insert(apps)
        .values({
          name: body.name,
          description: body.description ?? null,
          ownerId: user.id,
          stagingAddress: legacyAddresses.stagingAddress,
          nightlyAddress: legacyAddresses.nightlyAddress,
        })
        .returning();

      if (!newApp) {
        throw new Error("App insert returned no row");
      }

      await tx.insert(appMembers).values({
        appId: newApp.id,
        userId: user.id,
        role: "admin",
      });

      const insertedEnvironments = await tx
        .insert(appEnvironments)
        .values([
          // Dev environment is always created first at position -1
          {
            appId: newApp.id,
            name: "dev",
            address: null,
            enabled: true,
            isDev: true,
            position: -1,
          },
          ...normalizedEnvironments.map((environment) => ({
            appId: newApp.id,
            name: environment.name,
            address: environment.address,
            enabled: environment.enabled,
            isDev: false,
            position: environment.position,
          })),
        ])
        .returning();

      const insertedProductionAddresses =
        legacyAddresses.productionAddresses.length > 0
          ? await tx
              .insert(appProductionAddresses)
              .values(
                legacyAddresses.productionAddresses.map(
                  (productionAddress) => ({
                    appId: newApp.id,
                    label: productionAddress.label,
                    address: productionAddress.address,
                  })
                )
              )
              .returning()
          : [];

      return {
        app: newApp,
        environments: insertedEnvironments,
        productionAddresses: insertedProductionAddresses,
      };
    });

    invalidateDbOriginsCache();

    return jsonSuccess(
      c,
      {
        app: serializeApp(createdApp.app, {
          environments: mergeAppEnvironments(
            createdApp.app,
            createdApp.productionAddresses,
            createdApp.environments
          ),
          membershipRole: "admin",
          isOwner: true,
          productionAddresses: createdApp.productionAddresses,
        }),
      },
      201
    );
  });

  openapi(getAppRoute, async (c) => {
    const [addresses, environments] = await Promise.all([
      db.query.appProductionAddresses.findMany({
        where: eq(appProductionAddresses.appId, c.get("appAccess").app.id),
      }),
      db.query.appEnvironments.findMany({
        where: eq(appEnvironments.appId, c.get("appAccess").app.id),
        orderBy: (environment, { asc }) => [asc(environment.position)],
      }),
    ]);

    return jsonSuccess(c, {
      app: serializeApp(c.get("appAccess").app, {
        environments: mergeAppEnvironments(
          c.get("appAccess").app,
          addresses,
          environments
        ),
        membershipRole: c.get("appAccess").membershipRole,
        isOwner: c.get("appAccess").isOwner,
        productionAddresses: addresses,
      }),
    });
  });

  openapi(updateAppRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = appIdParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, appUpdateInputSchema);

    const updatedApp = await db.transaction(async (tx) => {
      if (body.environments !== undefined) {
        const synced = await syncEnvironments(
          tx,
          params.appId,
          body.environments
        );
        const legacyAddresses = deriveLegacyAddressesFromEnvironments(synced);

        const [updated] = await tx
          .update(apps)
          .set({
            ...(body.name === undefined ? {} : { name: body.name }),
            ...(body.description === undefined
              ? {}
              : { description: body.description }),
            stagingAddress: legacyAddresses.stagingAddress,
            nightlyAddress: legacyAddresses.nightlyAddress,
          })
          .where(eq(apps.id, params.appId))
          .returning();

        if (!updated) {
          throw new Error("App update returned no row");
        }

        return updated;
      }

      const [updated] = await tx
        .update(apps)
        .set({
          ...(body.name === undefined ? {} : { name: body.name }),
          ...(body.description === undefined
            ? {}
            : { description: body.description }),
          ...(body.stagingAddress === undefined
            ? {}
            : { stagingAddress: body.stagingAddress }),
          ...(body.nightlyAddress === undefined
            ? {}
            : { nightlyAddress: body.nightlyAddress }),
        })
        .where(eq(apps.id, params.appId))
        .returning();

      if (!updated) {
        throw new Error("App update returned no row");
      }

      if (body.stagingAddress !== undefined) {
        await syncDefaultEnvironment(tx, {
          appId: params.appId,
          name: "staging",
          address: body.stagingAddress,
        });
      }

      if (body.nightlyAddress !== undefined) {
        await syncDefaultEnvironment(tx, {
          appId: params.appId,
          name: "nightly",
          address: body.nightlyAddress,
        });
      }

      return updated;
    });

    if (!updatedApp) {
      throw new Error("App update returned no row");
    }

    invalidateDbOriginsCache();
    await bumpFlagsVersion(params.appId, null);

    const [addresses, environments] = await Promise.all([
      db.query.appProductionAddresses.findMany({
        where: eq(appProductionAddresses.appId, params.appId),
      }),
      db.query.appEnvironments.findMany({
        where: eq(appEnvironments.appId, params.appId),
        orderBy: (environment, { asc }) => [asc(environment.position)],
      }),
    ]);

    return jsonSuccess(c, {
      app: serializeApp(updatedApp, {
        environments: mergeAppEnvironments(updatedApp, addresses, environments),
        membershipRole: c.get("appAccess").membershipRole,
        isOwner: c.get("appAccess").isOwner,
        productionAddresses: addresses,
      }),
    });
  });

  openapi(deleteAppRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "admin");
    const params = appIdParamsSchema.parse(c.req.param());

    await db.delete(apps).where(eq(apps.id, params.appId));
    invalidateDbOriginsCache();

    return jsonSuccess(c, {
      deleted: true as const,
    });
  });
}
