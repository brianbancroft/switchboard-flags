import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appConfiguration, oidcProviders } from "../db/schema.js";
import { env } from "../env.js";
import { decrypt } from "./security.js";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000000";

export type OidcProviderConfig = {
  slug: string;
  name: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
};

export type AuthConfig = {
  passwordEnabled: boolean;
  githubEnabled: boolean;
  googleEnabled: boolean;
  appleEnabled: boolean;
  metaEnabled: boolean;
  oidcEnabled: boolean;
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  appleClientId?: string;
  appleClientSecret?: string;
  metaClientId?: string;
  metaClientSecret?: string;
  oidcProviders: OidcProviderConfig[];
};

let cached: AuthConfig | null = null;

function decryptOptional(value: string | null): string | undefined {
  if (!value) return undefined;
  return decrypt(value, env.BETTER_AUTH_SECRET);
}

export async function getAuthConfig(): Promise<AuthConfig> {
  if (cached) return cached;

  const [row] = await db
    .select()
    .from(appConfiguration)
    .where(eq(appConfiguration.id, SINGLETON_ID))
    .limit(1);

  if (!row) {
    cached = {
      passwordEnabled: true,
      githubEnabled: false,
      googleEnabled: false,
      appleEnabled: false,
      metaEnabled: false,
      oidcEnabled: false,
      oidcProviders: [],
    };
    return cached;
  }

  const providers = row.authOidcEnabled
    ? await db
        .select()
        .from(oidcProviders)
        .where(eq(oidcProviders.enabled, true))
    : [];

  cached = {
    passwordEnabled: row.authPasswordEnabled,
    githubEnabled: row.authGithubEnabled,
    googleEnabled: row.authGoogleEnabled,
    appleEnabled: row.authAppleEnabled,
    metaEnabled: row.authMetaEnabled,
    oidcEnabled: row.authOidcEnabled,
    githubClientId: decryptOptional(row.githubClientId),
    githubClientSecret: decryptOptional(row.githubClientSecret),
    googleClientId: decryptOptional(row.googleClientId),
    googleClientSecret: decryptOptional(row.googleClientSecret),
    appleClientId: decryptOptional(row.appleClientId),
    appleClientSecret: decryptOptional(row.appleClientSecret),
    metaClientId: decryptOptional(row.metaClientId),
    metaClientSecret: decryptOptional(row.metaClientSecret),
    oidcProviders: providers.map((p) => ({
      slug: p.slug,
      name: p.name,
      issuerUrl: p.issuerUrl,
      clientId: decrypt(p.clientId, env.BETTER_AUTH_SECRET),
      clientSecret: decrypt(p.clientSecret, env.BETTER_AUTH_SECRET),
    })),
  };

  return cached;
}

export async function refreshAuthConfig(): Promise<AuthConfig> {
  cached = null;
  return getAuthConfig();
}

export type PublicAuthConfig = {
  passwordEnabled: boolean;
  githubEnabled: boolean;
  googleEnabled: boolean;
  appleEnabled: boolean;
  metaEnabled: boolean;
  oidcEnabled: boolean;
  oidcProviders: { slug: string; name: string }[];
};

export function getPublicAuthConfig(config: AuthConfig): PublicAuthConfig {
  return {
    passwordEnabled: config.passwordEnabled,
    githubEnabled: config.githubEnabled,
    googleEnabled: config.googleEnabled,
    appleEnabled: config.appleEnabled,
    metaEnabled: config.metaEnabled,
    oidcEnabled: config.oidcEnabled,
    oidcProviders: config.oidcProviders.map((p) => ({
      slug: p.slug,
      name: p.name,
    })),
  };
}
