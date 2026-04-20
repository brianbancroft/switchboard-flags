import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { env } from "../env.js";
import type { AuthConfig } from "./app-config.js";
import { getAuthConfig } from "./app-config.js";

export type Auth = ReturnType<typeof buildAuth>;

let _auth: Auth | null = null;

function buildAuth(config: AuthConfig) {
  const socialProviders: Record<
    string,
    { clientId: string; clientSecret: string }
  > = {};

  if (
    config.githubEnabled &&
    config.githubClientId &&
    config.githubClientSecret
  ) {
    socialProviders.github = {
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
    };
  }
  if (
    config.googleEnabled &&
    config.googleClientId &&
    config.googleClientSecret
  ) {
    socialProviders.google = {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    };
  }
  if (config.appleEnabled && config.appleClientId && config.appleClientSecret) {
    socialProviders.apple = {
      clientId: config.appleClientId,
      clientSecret: config.appleClientSecret,
    };
  }
  if (config.metaEnabled && config.metaClientId && config.metaClientSecret) {
    socialProviders.facebook = {
      clientId: config.metaClientId,
      clientSecret: config.metaClientSecret,
    };
  }

  const plugins = [];

  if (config.oidcEnabled && config.oidcProviders.length > 0) {
    plugins.push(
      sso({
        defaultSSO: config.oidcProviders.map((p) => ({
          providerId: p.slug,
          domain: new URL(p.issuerUrl).hostname,
          issuer: p.issuerUrl,
          oidcConfig: {
            clientId: p.clientId,
            clientSecret: p.clientSecret,
            issuer: p.issuerUrl,
            discoveryEndpoint: `${p.issuerUrl}/.well-known/openid-configuration`,
            pkce: true,
          },
        })),
      })
    );
  }

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: config.passwordEnabled,
    },
    socialProviders,
    plugins,
    user: {
      modelName: "users",
      additionalFields: {
        isMegaAdmin: {
          type: "boolean",
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      modelName: "sessions",
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
  });
}

export async function initAuth(): Promise<Auth> {
  const config = await getAuthConfig();
  _auth = buildAuth(config);
  return _auth;
}

export function getAuth(): Auth {
  if (!_auth) throw new Error("Auth not initialized — call initAuth() first");
  return _auth;
}
