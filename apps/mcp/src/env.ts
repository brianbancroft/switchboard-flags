import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  try {
    loadEnv({
      path: fileURLToPath(new URL("../../../.env", import.meta.url)),
      quiet: true,
    });
    loadEnv({
      path: fileURLToPath(new URL("../.env", import.meta.url)),
      override: true,
      quiet: true,
    });
  } catch {
    // dotenv path resolution may fail when running outside the monorepo
  }
}

function parseJsonRecord(
  raw: string | undefined,
  label: string
): Record<string, string> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return z.record(z.string(), z.string()).parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`${label} must be valid JSON object: ${message}`);
  }
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SWITCHBOARD_API_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),
  SWITCHBOARD_API_UI_USER_ID: z.string().uuid().optional(),
  SWITCHBOARD_API_DEFAULT_HEADERS_JSON: z.string().optional(),
  SWITCHBOARD_EVALUATE_API_KEYS_JSON: z.string().optional(),
  SWITCHBOARD_DEV_BASIC_AUTH_USERNAME: z.string().optional(),
  SWITCHBOARD_DEV_BASIC_AUTH_PASSWORD: z.string().optional(),
  MCP_HTTP_HOST: z.string().default("127.0.0.1"),
  MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  MCP_HTTP_PATH: z.string().default("/mcp"),
  MCP_ALLOWED_HOSTS: z.string().optional(),
  MCP_AUTH_TOKEN: z.string().min(16).optional(),
  SWITCHBOARD_API_TOKEN: z.string().optional(),
});

const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])
);

const parsedEnv = envSchema.safeParse(rawEnv);

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

export const env = {
  ...values,
  MCP_ALLOWED_HOSTS: values.MCP_ALLOWED_HOSTS
    ? values.MCP_ALLOWED_HOSTS.split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined,
  SWITCHBOARD_API_DEFAULT_HEADERS: parseJsonRecord(
    values.SWITCHBOARD_API_DEFAULT_HEADERS_JSON,
    "SWITCHBOARD_API_DEFAULT_HEADERS_JSON"
  ),
  SWITCHBOARD_EVALUATE_API_KEYS: parseJsonRecord(
    values.SWITCHBOARD_EVALUATE_API_KEYS_JSON,
    "SWITCHBOARD_EVALUATE_API_KEYS_JSON"
  ),
};
