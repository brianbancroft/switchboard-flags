import { and, eq, gt, isNull, or } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { db } from "../db/client.js";
import type { ApiKeyScope } from "../db/schema.js";
import { apiKeys, appEnvironments, apps, users } from "../db/schema.js";
import { getAuth } from "../lib/auth.js";
import { scopeAllows } from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { loadAppAccess } from "../lib/permissions.js";
import { hashSecret, parseBasicAuthHeader } from "../lib/security.js";
import type { AppBindings } from "../lib/types.js";

const appParamSchema = z.object({
  appId: z.string().uuid(),
});

function resolveApiKey(headers: Headers) {
  const directHeader =
    headers.get("x-api-key") ?? headers.get("x-switchboard-api-key");
  if (directHeader) {
    return directHeader;
  }

  const authorization = headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return null;
}

export const requireUiUser = createMiddleware<AppBindings>(async (c, next) => {
  const forwardedUserId = c.req.header("x-switchboard-user-id");

  if (forwardedUserId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, forwardedUserId),
    });

    if (!user) {
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "UI authentication is required"
      );
    }

    c.set("user", user);
    c.set("authType", "ui");
    await next();
    return;
  }

  const session = await getAuth().api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    throw new AppError(401, "UNAUTHENTICATED", "UI authentication is required");
  }

  c.set("user", {
    ...session.user,
    image: session.user.image ?? null,
    username: (session.user as { username?: string | null }).username ?? null,
    isMegaAdmin: false,
  });
  c.set("authType", "ui");
  await next();
});

export const requireAppAccess = createMiddleware<AppBindings>(
  async (c, next) => {
    const params = appParamSchema.parse(c.req.param());
    const access = await loadAppAccess(params.appId, c.get("user"));
    c.set("appAccess", access);
    await next();
  }
);

/** @deprecated Use `requireAppAccess` */
export const requireEnvironmentAccess = requireAppAccess;

export function requireSdkAccess(acceptedScopes: ApiKeyScope[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const { appId } = appParamSchema.parse(c.req.param());
    const rawApiKey = resolveApiKey(c.req.raw.headers);

    if (rawApiKey) {
      const hashedKey = hashSecret(rawApiKey);
      const [record] = await db
        .select({
          apiKey: apiKeys,
          app: apps,
          environment: appEnvironments,
        })
        .from(apiKeys)
        .innerJoin(apps, eq(apps.id, apiKeys.appId))
        .leftJoin(
          appEnvironments,
          eq(appEnvironments.id, apiKeys.environmentId)
        )
        .where(
          and(
            eq(apiKeys.appId, appId),
            eq(apiKeys.hashedKey, hashedKey),
            or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date()))
          )
        )
        .limit(1);

      if (!record) {
        throw new AppError(
          401,
          "INVALID_API_KEY",
          "API key is invalid or expired"
        );
      }

      if (!scopeAllows(record.apiKey.scopes, acceptedScopes)) {
        throw new AppError(
          403,
          "INSUFFICIENT_SCOPE",
          "The API key does not include a required scope for this endpoint"
        );
      }

      c.set("sdkApp", record.app);
      c.set("sdkCredential", {
        kind: "apiKey",
        id: record.apiKey.id,
        appId: record.apiKey.appId,
        environmentId: record.apiKey.environmentId,
        isDevEnvironment: record.environment?.isDev ?? false,
        scopes: record.apiKey.scopes,
      });
      c.set("authType", "apiKey");

      void db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, record.apiKey.id))
        .catch((error) => {
          console.warn(
            JSON.stringify({
              level: "warn",
              requestId: c.get("requestId"),
              message: "Failed to update api_keys.last_used_at",
              error,
            })
          );
        });

      await next();
      return;
    }

    const basicAuth = parseBasicAuthHeader(c.req.header("authorization"));

    if (!basicAuth) {
      throw new AppError(
        401,
        "SDK_AUTH_REQUIRED",
        "Provide an API key or HTTP Basic credentials",
        {
          headers: {
            "www-authenticate": 'Basic realm="Switchboard SDK"',
          },
        }
      );
    }

    throw new AppError(
      401,
      "BASIC_AUTH_NOT_ALLOWED",
      "HTTP Basic Auth is not supported for apps",
      {
        headers: {
          "www-authenticate": 'Basic realm="Switchboard SDK"',
        },
      }
    );
  });
}

/**
 * SDK-token-only middleware for routes where the token itself is the identity
 * (no appId in the URL). The app and environment are resolved from the token.
 */
export function requireSdkToken(acceptedScopes: ApiKeyScope[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const rawApiKey = resolveApiKey(c.req.raw.headers);
    if (!rawApiKey) {
      throw new AppError(
        401,
        "SDK_AUTH_REQUIRED",
        "Provide an API key via Authorization: Bearer or x-api-key header"
      );
    }

    const hashedKey = hashSecret(rawApiKey);
    const [record] = await db
      .select({
        apiKey: apiKeys,
        app: apps,
        environment: appEnvironments,
      })
      .from(apiKeys)
      .innerJoin(apps, eq(apps.id, apiKeys.appId))
      .leftJoin(
        appEnvironments,
        eq(appEnvironments.id, apiKeys.environmentId)
      )
      .where(
        and(
          eq(apiKeys.hashedKey, hashedKey),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date()))
        )
      )
      .limit(1);

    if (!record) {
      throw new AppError(401, "INVALID_API_KEY", "API key is invalid or expired");
    }

    if (!scopeAllows(record.apiKey.scopes, acceptedScopes)) {
      throw new AppError(
        403,
        "INSUFFICIENT_SCOPE",
        "The API key does not include a required scope for this endpoint"
      );
    }

    c.set("sdkApp", record.app);
    c.set("sdkCredential", {
      kind: "apiKey",
      id: record.apiKey.id,
      appId: record.apiKey.appId,
      environmentId: record.apiKey.environmentId,
      isDevEnvironment: record.environment?.isDev ?? false,
      scopes: record.apiKey.scopes,
    });
    c.set("authType", "apiKey");

    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.apiKey.id))
      .catch((error) => {
        console.warn(
          JSON.stringify({
            level: "warn",
            requestId: c.get("requestId"),
            message: "Failed to update api_keys.last_used_at",
            error,
          })
        );
      });

    await next();
  });
}
