import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

loadEnv({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  override: true,
  quiet: true,
});

const booleanEnv = (defaultValue: "true" | "false" = "false") =>
  z
    .string()
    .default(defaultValue)
    .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
  EVALUATE_RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(600),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  DEV_BASIC_AUTH_USERNAME: z.string().optional(),
  DEV_BASIC_AUTH_PASSWORD: z.string().optional(),

  AUTH_PASSWORD_ENABLED: booleanEnv("true"),
  AUTH_GITHUB_ENABLED: booleanEnv(),
  AUTH_GOOGLE_ENABLED: booleanEnv(),
  AUTH_APPLE_ENABLED: booleanEnv(),
  AUTH_META_ENABLED: booleanEnv(),
  AUTH_OIDC_ENABLED: booleanEnv(),
  AUTH_GITHUB_CLIENT_ID: z.string().optional(),
  AUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
  AUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  AUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  AUTH_APPLE_CLIENT_ID: z.string().optional(),
  AUTH_APPLE_CLIENT_SECRET: z.string().optional(),
  AUTH_META_CLIENT_ID: z.string().optional(),
  AUTH_META_CLIENT_SECRET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "environment";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${details}`);
}

const values = parsedEnv.data;
const defaultUiOrigin = "http://localhost:3000";
const parseOriginList = (raw?: string) =>
  raw
    ? raw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
const corsOrigins = parseOriginList(values.CORS_ORIGINS);
const trustedOrigins = parseOriginList(values.BETTER_AUTH_TRUSTED_ORIGINS);

export const env = {
  ...values,
  API_BASE_URL: values.API_BASE_URL ?? `http://localhost:${values.API_PORT}`,
  BETTER_AUTH_SECRET:
    values.BETTER_AUTH_SECRET ??
    "switchboard-local-dev-better-auth-secret-change-me",
  BETTER_AUTH_URL:
    values.BETTER_AUTH_URL ?? `http://localhost:${values.API_PORT}`,
  CORS_ORIGINS:
    corsOrigins.length > 0
      ? corsOrigins
      : trustedOrigins.length > 0
        ? trustedOrigins
        : [defaultUiOrigin],
  BETTER_AUTH_TRUSTED_ORIGINS:
    trustedOrigins.length > 0
      ? trustedOrigins
      : corsOrigins.length > 0
        ? corsOrigins
        : [defaultUiOrigin],
};
