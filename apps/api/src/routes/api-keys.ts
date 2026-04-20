import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys, appEnvironments } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  apiKeyCreateInputSchema,
  apiKeySchema,
  serializeApiKey,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { assertAppPermission } from "../lib/permissions.js";

import { generateApiKeyValue, hashSecret } from "../lib/security.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const apiKeyParamsSchema = paramsSchema.extend({
  apiKeyId: z.string().uuid(),
});

const listApiKeysDataSchema = z.object({
  apiKeys: z.array(apiKeySchema),
});

const apiKeyDataSchema = z.object({
  apiKey: apiKeySchema,
});

const createApiKeyDataSchema = z.object({
  apiKey: apiKeySchema,
  plaintextKey: z.string(),
});

const deleteApiKeyDataSchema = z.object({
  deleted: z.literal(true),
});

const listApiKeysRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/api-keys",
  tags: ["API Keys"],
  summary: "List API keys for an app",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
  },
  responses: {
    200: successResponse(listApiKeysDataSchema, "App API keys"),
    ...defaultErrorResponses(),
  },
});

const createApiKeyRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/api-keys",
  tags: ["API Keys"],
  summary: "Create an API key",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: apiKeyCreateInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(createApiKeyDataSchema, "API key created"),
    ...defaultErrorResponses(),
  },
});

const getApiKeyRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/api-keys/{apiKeyId}",
  tags: ["API Keys"],
  summary: "Get an API key record",
  security: [{ bearerAuth: [] }],
  request: {
    params: apiKeyParamsSchema,
  },
  responses: {
    200: successResponse(apiKeyDataSchema, "API key details"),
    ...defaultErrorResponses(),
  },
});

const deleteApiKeyRoute = createRoute({
  method: "delete",
  path: "/api/v1/apps/{appId}/api-keys/{apiKeyId}",
  tags: ["API Keys"],
  summary: "Delete an API key",
  security: [{ bearerAuth: [] }],
  request: {
    params: apiKeyParamsSchema,
  },
  responses: {
    200: successResponse(deleteApiKeyDataSchema, "API key deleted"),
    ...defaultErrorResponses(),
  },
});

async function getApiKeyOrThrow(appId: string, apiKeyId: string) {
  const apiKey = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.appId, appId), eq(apiKeys.id, apiKeyId)),
  });

  if (!apiKey) {
    throw new AppError(404, "API_KEY_NOT_FOUND", "API key not found");
  }

  return apiKey;
}

export function registerApiKeyRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listApiKeysRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = paramsSchema.parse(c.req.param());

    const keys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.appId, params.appId))
      .orderBy(asc(apiKeys.createdAt));

    return jsonSuccess(c, {
      apiKeys: keys.map(serializeApiKey),
    });
  });

  openapi(createApiKeyRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, apiKeyCreateInputSchema);

    const env = await db.query.appEnvironments.findFirst({
      where: and(
        eq(appEnvironments.appId, params.appId),
        eq(appEnvironments.id, body.environmentId)
      ),
    });
    if (!env) {
      throw new AppError(404, "ENVIRONMENT_NOT_FOUND", "Environment not found");
    }

    const plaintextKey = generateApiKeyValue();

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        appId: params.appId,
        environmentId: body.environmentId,
        description: body.description ?? null,
        hashedKey: hashSecret(plaintextKey),
        scopes: body.scopes,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      .returning();

    if (!apiKey) {
      throw new AppError(
        500,
        "API_KEY_CREATE_FAILED",
        "Failed to create API key"
      );
    }

    return jsonSuccess(
      c,
      {
        apiKey: serializeApiKey(apiKey),
        plaintextKey,
      },
      201
    );
  });

  openapi(getApiKeyRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = apiKeyParamsSchema.parse(c.req.param());
    const apiKey = await getApiKeyOrThrow(params.appId, params.apiKeyId);

    return jsonSuccess(c, {
      apiKey: serializeApiKey(apiKey),
    });
  });

  openapi(deleteApiKeyRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "manager");
    const params = apiKeyParamsSchema.parse(c.req.param());
    await getApiKeyOrThrow(params.appId, params.apiKeyId);

    await db
      .delete(apiKeys)
      .where(
        and(eq(apiKeys.appId, params.appId), eq(apiKeys.id, params.apiKeyId))
      );

    return jsonSuccess(c, {
      deleted: true as const,
    });
  });
}
