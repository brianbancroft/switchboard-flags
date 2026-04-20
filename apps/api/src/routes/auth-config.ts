import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appConfiguration, oidcProviders } from "../db/schema.js";
import { env } from "../env.js";
import {
  defaultErrorResponses,
  jsonError,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import { refreshAuthConfig } from "../lib/app-config.js";
import { AppError } from "../lib/errors.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { decrypt, encrypt } from "../lib/security.js";
import type { AppBindings } from "../lib/types.js";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000000";

function requireMegaAdmin(user: { isMegaAdmin: boolean }) {
  if (!user.isMegaAdmin) {
    throw new AppError(403, "FORBIDDEN", "Mega admin access required");
  }
}

function encryptOptional(value: string | undefined | null): string | null {
  if (!value) return null;
  return encrypt(value, env.BETTER_AUTH_SECRET);
}

function decryptOptional(value: string | null): string | null {
  if (!value) return null;
  return decrypt(value, env.BETTER_AUTH_SECRET);
}

// --- GET /api/v1/auth-config ---

const authConfigResponseSchema = z.object({
  authPasswordEnabled: z.boolean(),
  authGithubEnabled: z.boolean(),
  authGoogleEnabled: z.boolean(),
  authAppleEnabled: z.boolean(),
  authMetaEnabled: z.boolean(),
  authOidcEnabled: z.boolean(),
  githubClientId: z.string().nullable(),
  googleClientId: z.string().nullable(),
  appleClientId: z.string().nullable(),
  metaClientId: z.string().nullable(),
});

const getAuthConfigRoute = createRoute({
  method: "get",
  path: "/api/v1/auth-config",
  tags: ["Auth Config"],
  summary: "Get auth configuration (mega admin only)",
  responses: {
    200: successResponse(authConfigResponseSchema, "Auth configuration"),
    ...defaultErrorResponses(),
  },
});

// --- PUT /api/v1/auth-config ---

const updateAuthConfigBodySchema = z.object({
  authPasswordEnabled: z.boolean().optional(),
  authGithubEnabled: z.boolean().optional(),
  authGoogleEnabled: z.boolean().optional(),
  authAppleEnabled: z.boolean().optional(),
  authMetaEnabled: z.boolean().optional(),
  authOidcEnabled: z.boolean().optional(),
  githubClientId: z.string().nullable().optional(),
  githubClientSecret: z.string().nullable().optional(),
  googleClientId: z.string().nullable().optional(),
  googleClientSecret: z.string().nullable().optional(),
  appleClientId: z.string().nullable().optional(),
  appleClientSecret: z.string().nullable().optional(),
  metaClientId: z.string().nullable().optional(),
  metaClientSecret: z.string().nullable().optional(),
});

const updateAuthConfigRoute = createRoute({
  method: "put",
  path: "/api/v1/auth-config",
  tags: ["Auth Config"],
  summary: "Update auth configuration (mega admin only)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateAuthConfigBodySchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(
      authConfigResponseSchema,
      "Updated auth configuration"
    ),
    ...defaultErrorResponses(),
  },
});

// --- OIDC Providers ---

const oidcProviderResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  issuerUrl: z.string(),
  clientId: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const listOidcProvidersRoute = createRoute({
  method: "get",
  path: "/api/v1/auth-config/oidc-providers",
  tags: ["Auth Config"],
  summary: "List OIDC providers (mega admin only)",
  responses: {
    200: successResponse(z.array(oidcProviderResponseSchema), "OIDC providers"),
    ...defaultErrorResponses(),
  },
});

const createOidcProviderBodySchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  issuerUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

const createOidcProviderRoute = createRoute({
  method: "post",
  path: "/api/v1/auth-config/oidc-providers",
  tags: ["Auth Config"],
  summary: "Create OIDC provider (mega admin only)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createOidcProviderBodySchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(oidcProviderResponseSchema, "Created OIDC provider"),
    ...defaultErrorResponses(),
  },
});

const updateOidcProviderBodySchema = z.object({
  name: z.string().min(1).optional(),
  issuerUrl: z.string().url().optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const oidcProviderParamsSchema = z.object({
  providerId: z.string().uuid(),
});

const updateOidcProviderRoute = createRoute({
  method: "patch",
  path: "/api/v1/auth-config/oidc-providers/{providerId}",
  tags: ["Auth Config"],
  request: {
    params: oidcProviderParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateOidcProviderBodySchema,
        },
      },
    },
  },
  summary: "Update OIDC provider (mega admin only)",
  responses: {
    200: successResponse(oidcProviderResponseSchema, "Updated OIDC provider"),
    ...defaultErrorResponses(),
  },
});

const deleteOidcProviderRoute = createRoute({
  method: "delete",
  path: "/api/v1/auth-config/oidc-providers/{providerId}",
  tags: ["Auth Config"],
  request: {
    params: oidcProviderParamsSchema,
  },
  summary: "Delete OIDC provider (mega admin only)",
  responses: {
    200: successResponse(z.object({ deleted: z.boolean() }), "Deleted"),
    ...defaultErrorResponses(),
  },
});

// --- Helpers ---

function formatProviderResponse(row: typeof oidcProviders.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    issuerUrl: row.issuerUrl,
    clientId: decrypt(row.clientId, env.BETTER_AUTH_SECRET),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatConfigResponse(row: typeof appConfiguration.$inferSelect) {
  return {
    authPasswordEnabled: row.authPasswordEnabled,
    authGithubEnabled: row.authGithubEnabled,
    authGoogleEnabled: row.authGoogleEnabled,
    authAppleEnabled: row.authAppleEnabled,
    authMetaEnabled: row.authMetaEnabled,
    authOidcEnabled: row.authOidcEnabled,
    githubClientId: decryptOptional(row.githubClientId),
    googleClientId: decryptOptional(row.googleClientId),
    appleClientId: decryptOptional(row.appleClientId),
    metaClientId: decryptOptional(row.metaClientId),
  };
}

// --- Registration ---

export function registerAuthConfigRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  // GET auth config
  openapi(getAuthConfigRoute, async (c) => {
    requireMegaAdmin(c.get("user"));

    const [row] = await db
      .select()
      .from(appConfiguration)
      .where(eq(appConfiguration.id, SINGLETON_ID))
      .limit(1);

    if (!row) {
      return jsonError(
        c,
        404,
        "NOT_FOUND",
        "Auth configuration not initialized"
      );
    }

    return jsonSuccess(c, formatConfigResponse(row));
  });

  // PUT auth config
  openapi(updateAuthConfigRoute, async (c) => {
    requireMegaAdmin(c.get("user"));

    const body = await parseJsonBody(c, updateAuthConfigBodySchema);

    const set: Record<string, unknown> = { updatedAt: new Date() };

    if (body.authPasswordEnabled !== undefined)
      set.authPasswordEnabled = body.authPasswordEnabled;
    if (body.authGithubEnabled !== undefined)
      set.authGithubEnabled = body.authGithubEnabled;
    if (body.authGoogleEnabled !== undefined)
      set.authGoogleEnabled = body.authGoogleEnabled;
    if (body.authAppleEnabled !== undefined)
      set.authAppleEnabled = body.authAppleEnabled;
    if (body.authMetaEnabled !== undefined)
      set.authMetaEnabled = body.authMetaEnabled;
    if (body.authOidcEnabled !== undefined)
      set.authOidcEnabled = body.authOidcEnabled;
    if (body.githubClientId !== undefined)
      set.githubClientId = encryptOptional(body.githubClientId);
    if (body.githubClientSecret !== undefined)
      set.githubClientSecret = encryptOptional(body.githubClientSecret);
    if (body.googleClientId !== undefined)
      set.googleClientId = encryptOptional(body.googleClientId);
    if (body.googleClientSecret !== undefined)
      set.googleClientSecret = encryptOptional(body.googleClientSecret);
    if (body.appleClientId !== undefined)
      set.appleClientId = encryptOptional(body.appleClientId);
    if (body.appleClientSecret !== undefined)
      set.appleClientSecret = encryptOptional(body.appleClientSecret);
    if (body.metaClientId !== undefined)
      set.metaClientId = encryptOptional(body.metaClientId);
    if (body.metaClientSecret !== undefined)
      set.metaClientSecret = encryptOptional(body.metaClientSecret);

    const [updated] = await db
      .update(appConfiguration)
      .set(set)
      .where(eq(appConfiguration.id, SINGLETON_ID))
      .returning();

    if (!updated) {
      return jsonError(
        c,
        404,
        "NOT_FOUND",
        "Auth configuration not initialized"
      );
    }

    await refreshAuthConfig();

    return jsonSuccess(c, formatConfigResponse(updated));
  });

  // LIST OIDC providers
  openapi(listOidcProvidersRoute, async (c) => {
    requireMegaAdmin(c.get("user"));

    const rows = await db.select().from(oidcProviders);
    return jsonSuccess(c, rows.map(formatProviderResponse));
  });

  // CREATE OIDC provider
  openapi(createOidcProviderRoute, async (c) => {
    requireMegaAdmin(c.get("user"));

    const body = await parseJsonBody(c, createOidcProviderBodySchema);

    const [created] = await db
      .insert(oidcProviders)
      .values({
        name: body.name,
        slug: body.slug,
        issuerUrl: body.issuerUrl,
        clientId: encrypt(body.clientId, env.BETTER_AUTH_SECRET),
        clientSecret: encrypt(body.clientSecret, env.BETTER_AUTH_SECRET),
        enabled: body.enabled,
      })
      .returning();

    if (!created) {
      throw new AppError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to create OIDC provider"
      );
    }

    await refreshAuthConfig();

    return jsonSuccess(c, formatProviderResponse(created), 201);
  });

  // UPDATE OIDC provider
  openapi(updateOidcProviderRoute, async (c) => {
    requireMegaAdmin(c.get("user"));

    const { providerId } = oidcProviderParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, updateOidcProviderBodySchema);

    const set: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) set.name = body.name;
    if (body.issuerUrl !== undefined) set.issuerUrl = body.issuerUrl;
    if (body.clientId !== undefined)
      set.clientId = encrypt(body.clientId, env.BETTER_AUTH_SECRET);
    if (body.clientSecret !== undefined)
      set.clientSecret = encrypt(body.clientSecret, env.BETTER_AUTH_SECRET);
    if (body.enabled !== undefined) set.enabled = body.enabled;

    const [updated] = await db
      .update(oidcProviders)
      .set(set)
      .where(eq(oidcProviders.id, providerId))
      .returning();

    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "OIDC provider not found");
    }

    await refreshAuthConfig();

    return jsonSuccess(c, formatProviderResponse(updated));
  });

  // DELETE OIDC provider
  openapi(deleteOidcProviderRoute, async (c) => {
    requireMegaAdmin(c.get("user"));

    const { providerId } = oidcProviderParamsSchema.parse(c.req.param());

    const [deleted] = await db
      .delete(oidcProviders)
      .where(eq(oidcProviders.id, providerId))
      .returning();

    if (!deleted) {
      throw new AppError(404, "NOT_FOUND", "OIDC provider not found");
    }

    await refreshAuthConfig();

    return jsonSuccess(c, { deleted: true });
  });
}
