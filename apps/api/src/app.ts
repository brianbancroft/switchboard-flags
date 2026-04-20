import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { getAuth, initAuth } from "./lib/auth.js";
import { isOriginAllowed } from "./lib/cors-origins.js";
import { handleError } from "./lib/errors.js";
import { renderRedocHtml } from "./lib/redoc.js";
import type { AppBindings } from "./lib/types.js";
import {
  requireAppAccess,
  requireSdkAccess,
  requireSdkToken,
  requireUiUser,
} from "./middleware/auth.js";

import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { registerActivityRoutes } from "./routes/activity.js";
import { registerApiKeyRoutes } from "./routes/api-keys.js";
import { registerAuthConfigRoutes } from "./routes/auth-config.js";
import { registerAuthProvidersRoute } from "./routes/auth-providers.js";
import { registerDatabaseHealthRoute } from "./routes/db-health.js";
import { registerDevOverrideRoutes } from "./routes/dev-overrides.js";
import { registerEnvironmentMemberRoutes } from "./routes/environment-members.js";
import { registerEnvironmentRoutes } from "./routes/environments.js";
import { registerEvaluateRoutes } from "./routes/evaluate.js";
import { registerFlagEnvValueRoutes } from "./routes/flag-env-values.js";
import { registerFeatureFlagRoutes } from "./routes/flags.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerOverrideRoutes } from "./routes/overrides.js";
import { registerProductionAddressRoutes } from "./routes/production-addresses.js";
import { registerSdkRoutes } from "./routes/sdk.js";
import { registerUserRoutes } from "./routes/users.js";

export async function createApp() {
  await initAuth();

  const app = new OpenAPIHono<AppBindings>();
  const staticOrigins = new Set([
    env.API_BASE_URL,
    ...env.CORS_ORIGINS,
    ...env.BETTER_AUTH_TRUSTED_ORIGINS,
  ]);

  app.use("*", requestContextMiddleware);
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: async (origin) => {
        if (!origin) {
          return env.CORS_ORIGINS[0] ?? env.API_BASE_URL;
        }

        const allowed = await isOriginAllowed(origin, staticOrigins);
        return allowed ? origin : "";
      },
      allowHeaders: [
        "authorization",
        "content-type",
        "x-api-key",
        "x-request-id",
        "x-switchboard-api-key",
        "x-switchboard-user-id",
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: [
        "x-request-id",
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
        "x-ratelimit-reset",
      ],
      credentials: true,
    })
  );

  registerAuthProvidersRoute(app);

  app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));
  app.use(
    "/api/*",
    createRateLimitMiddleware({
      keyPrefix: "api",
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    })
  );
  app.use("/api/v1/auth-config", requireUiUser);
  app.use("/api/v1/auth-config/*", requireUiUser);
  app.use("/api/v1/users", requireUiUser);
  app.use("/api/v1/users/*", requireUiUser);
  app.use("/api/v1/apps", requireUiUser);
  app.use("/api/v1/apps/:appId", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/flags", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/flags/*", requireUiUser, requireAppAccess);
  app.use(
    "/api/v1/apps/:appId/flags/:flagId/env-values",
    requireUiUser,
    requireAppAccess
  );
  app.use(
    "/api/v1/apps/:appId/flags/:flagId/env-values/*",
    requireUiUser,
    requireAppAccess
  );
  app.use(
    "/api/v1/apps/:appId/flags/:flagId/audit-log",
    requireUiUser,
    requireAppAccess
  );
  app.use("/api/v1/apps/:appId/overrides", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/overrides/*", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/dev-overrides", requireUiUser, requireAppAccess);
  app.use(
    "/api/v1/apps/:appId/dev-overrides/*",
    requireUiUser,
    requireAppAccess
  );
  app.use("/api/v1/apps/:appId/api-keys", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/api-keys/*", requireUiUser, requireAppAccess);
  app.use(
    "/api/v1/apps/:appId/production-addresses",
    requireUiUser,
    requireAppAccess
  );
  app.use(
    "/api/v1/apps/:appId/production-addresses/*",
    requireUiUser,
    requireAppAccess
  );
  app.use("/api/v1/apps/:appId/members", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/members/*", requireUiUser, requireAppAccess);
  app.use("/api/v1/apps/:appId/activity", requireUiUser, requireAppAccess);
  app.use(
    "/api/v1/apps/:appId/evaluate",
    createRateLimitMiddleware({
      keyPrefix: "evaluate",
      maxRequests: env.EVALUATE_RATE_LIMIT_MAX_REQUESTS,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    }),
    requireSdkAccess([
      "flags:read",
      "flags:write",
      "app:read",
      "app:write",
      "app:admin",
    ])
  );
  app.use(
    "/api/v1/sdk/*",
    createRateLimitMiddleware({
      keyPrefix: "sdk",
      maxRequests: env.EVALUATE_RATE_LIMIT_MAX_REQUESTS,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    }),
    requireSdkToken([
      "flags:read",
      "flags:write",
      "app:read",
      "app:write",
      "app:admin",
    ])
  );

  registerHealthRoute(app);
  registerDatabaseHealthRoute(app);
  registerActivityRoutes(app);
  registerAuthConfigRoutes(app);
  registerUserRoutes(app);
  registerEnvironmentRoutes(app);
  registerProductionAddressRoutes(app);
  registerEnvironmentMemberRoutes(app);
  registerFeatureFlagRoutes(app);
  registerFlagEnvValueRoutes(app);
  registerOverrideRoutes(app);
  registerDevOverrideRoutes(app);
  registerApiKeyRoutes(app);
  registerEvaluateRoutes(app);
  registerSdkRoutes(app);

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Switchboard API",
      version: "0.1.0",
      description:
        "Switchboard API for feature flag management with Hono, Drizzle ORM, PostgreSQL, and OpenAPI-first route definitions.",
    },
    servers: [{ url: env.API_BASE_URL }],
  });

  app.get("/docs", (c) =>
    c.html(
      renderRedocHtml({
        title: "Switchboard API Reference",
        specUrl: "/openapi.json",
        headline: "Switchboard API",
        body: "Live API reference generated from the Hono route definitions.",
      })
    )
  );

  app.notFound((c) =>
    c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Not found",
        },
        meta: {
          requestId: c.get("requestId"),
        },
      },
      404
    )
  );

  app.onError(handleError);

  return app;
}
