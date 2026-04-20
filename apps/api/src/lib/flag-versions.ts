import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { appEnvironments } from "../db/schema.js";
import { getRedis } from "./redis.js";

function versionKey(appId: string, environmentId: string) {
  return `sb:version:${appId}:${environmentId}`;
}

function payloadKey(apiKeyId: string) {
  return `sb:payload:${apiKeyId}`;
}

/**
 * Bump the flags_version counter for one or all environments of an app.
 * When environmentId is null, bumps every environment of the app (used for
 * app-level changes like creating/deleting a flag).
 */
export async function bumpFlagsVersion(
  appId: string,
  environmentId: string | null
): Promise<void> {
  const updated = await db
    .update(appEnvironments)
    .set({ flagsVersion: sql`${appEnvironments.flagsVersion} + 1` })
    .where(
      environmentId === null
        ? eq(appEnvironments.appId, appId)
        : and(
            eq(appEnvironments.appId, appId),
            eq(appEnvironments.id, environmentId)
          )
    )
    .returning({
      id: appEnvironments.id,
      flagsVersion: appEnvironments.flagsVersion,
    });

  if (updated.length === 0) return;

  const redis = getRedis();
  await Promise.all(
    updated.map((row) =>
      redis.set(versionKey(appId, row.id), String(row.flagsVersion))
    )
  );
}

/**
 * Read the current flags version for an environment. Falls through to the DB
 * on cache miss and populates Redis.
 */
export async function getFlagsVersion(
  appId: string,
  environmentId: string
): Promise<string> {
  const redis = getRedis();
  const cached = await redis.get(versionKey(appId, environmentId));
  if (cached !== null) return cached;

  const [row] = await db
    .select({ flagsVersion: appEnvironments.flagsVersion })
    .from(appEnvironments)
    .where(
      and(
        eq(appEnvironments.appId, appId),
        eq(appEnvironments.id, environmentId)
      )
    )
    .limit(1);

  const version = String(row?.flagsVersion ?? 1);
  await redis.set(versionKey(appId, environmentId), version);
  return version;
}

export type CachedPayload = {
  version: string;
  evaluations: Record<string, unknown>;
};

export async function readPayloadCache(
  apiKeyId: string
): Promise<CachedPayload | null> {
  const raw = await getRedis().get(payloadKey(apiKeyId));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as CachedPayload;
  } catch {
    return null;
  }
}

export async function writePayloadCache(
  apiKeyId: string,
  payload: CachedPayload
): Promise<void> {
  await getRedis().set(payloadKey(apiKeyId), JSON.stringify(payload));
}
