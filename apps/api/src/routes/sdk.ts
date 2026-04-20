import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  featureFlags,
  flagEnvironmentValues,
  type JsonValue,
} from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  successResponse,
} from "../lib/api.js";
import { jsonValueSchema } from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { evaluateFlagValue } from "../lib/evaluate.js";
import {
  getFlagsVersion,
  readPayloadCache,
  writePayloadCache,
} from "../lib/flag-versions.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { validateCallerUrl } from "../lib/sdk-auth.js";
import type { AppBindings } from "../lib/types.js";

const querySchema = z.object({
  url: z.string().url().optional(),
});

const versionDataSchema = z.object({
  version: z.string(),
});

const payloadDataSchema = z.object({
  version: z.string(),
  evaluations: z.record(z.string(), jsonValueSchema),
});

const versionRoute = createRoute({
  method: "get",
  path: "/api/v1/sdk/version",
  tags: ["SDK"],
  summary: "Get the current flags version for the authenticated token",
  description:
    "Returns a monotonic version string that changes whenever any flag, rule, per-env value, or environment configuration visible to this token's environment is modified. Use this as a cheap way to decide whether to re-fetch /sdk/payload.",
  security: [{ apiKeyAuth: [] }],
  request: { query: querySchema },
  responses: {
    200: successResponse(versionDataSchema, "Current flags version"),
    ...defaultErrorResponses(),
  },
});

const payloadRoute = createRoute({
  method: "get",
  path: "/api/v1/sdk/payload",
  tags: ["SDK"],
  summary: "Get the full flag payload for the authenticated token",
  description:
    "Returns a flat `{ flagName: value }` object for every flag in the token's environment, along with the version it was computed at. Backed by a per-token Redis cache keyed on the flags version — repeat calls are near-free until something changes.",
  security: [{ apiKeyAuth: [] }],
  request: { query: querySchema },
  responses: {
    200: successResponse(payloadDataSchema, "Flag payload"),
    ...defaultErrorResponses(),
  },
});

function requireApiKeyCredential(
  credential: { kind: "apiKey"; id: string; environmentId: string | null }
    | { kind: "basic"; appId: string }
): { apiKeyId: string; environmentId: string } {
  if (credential.kind !== "apiKey") {
    throw new AppError(
      401,
      "API_KEY_REQUIRED",
      "SDK routes require an API key, not HTTP Basic auth"
    );
  }
  if (!credential.environmentId) {
    throw new AppError(
      403,
      "ENVIRONMENT_REQUIRED",
      "This API key is not scoped to an environment"
    );
  }
  return {
    apiKeyId: credential.id,
    environmentId: credential.environmentId,
  };
}

async function computePayload(
  appId: string,
  environmentId: string
): Promise<Record<string, JsonValue>> {
  const [flags, envValues] = await Promise.all([
    db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.appId, appId))
      .orderBy(asc(featureFlags.name)),
    db
      .select()
      .from(flagEnvironmentValues)
      .where(
        and(
          eq(flagEnvironmentValues.appId, appId),
          eq(flagEnvironmentValues.environmentId, environmentId)
        )
      ),
  ]);

  const envValueByFlagId = new Map(
    envValues.map((row) => [row.flagId, row.value])
  );

  const out: Record<string, JsonValue> = {};
  for (const flag of flags) {
    const envValue = envValueByFlagId.get(flag.id);
    const config =
      envValue === undefined
        ? flag.config
        : { ...flag.config, defaultValue: envValue };
    const result = evaluateFlagValue({ config, attributes: {} });
    out[flag.name] = result.value;
  }
  return out;
}

export function registerSdkRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(versionRoute, async (c) => {
    const query = querySchema.parse(c.req.query());
    const credential = c.get("sdkCredential");
    const sdkApp = c.get("sdkApp");
    const { environmentId } = requireApiKeyCredential(credential);

    await validateCallerUrl(c, sdkApp.id, query.url);

    const version = await getFlagsVersion(sdkApp.id, environmentId);
    return jsonSuccess(c, { version });
  });

  openapi(payloadRoute, async (c) => {
    const query = querySchema.parse(c.req.query());
    const credential = c.get("sdkCredential");
    const sdkApp = c.get("sdkApp");
    const { apiKeyId, environmentId } = requireApiKeyCredential(credential);

    await validateCallerUrl(c, sdkApp.id, query.url);

    const version = await getFlagsVersion(sdkApp.id, environmentId);
    const cached = await readPayloadCache(apiKeyId);
    if (cached && cached.version === version) {
      return jsonSuccess(c, {
        version,
        evaluations: cached.evaluations as Record<string, JsonValue>,
      });
    }

    const evaluations = await computePayload(sdkApp.id, environmentId);
    await writePayloadCache(apiKeyId, { version, evaluations });

    return jsonSuccess(c, { version, evaluations });
  });
}
