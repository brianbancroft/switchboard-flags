import { isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { appEnvironments, appProductionAddresses } from "../db/schema.js";

const CACHE_TTL_MS = 30_000;

let cached: { origins: Set<string>; expiresAt: number } | null = null;
let inflight: Promise<Set<string>> | null = null;

function originFromUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    // Origin is scheme://host[:port] — never include path/query/hash
    return parsed.origin;
  } catch {
    return null;
  }
}

async function loadFromDb(): Promise<Set<string>> {
  const [envs, prodAddrs] = await Promise.all([
    db
      .select({ address: appEnvironments.address })
      .from(appEnvironments)
      .where(isNotNull(appEnvironments.address)),
    db
      .select({ address: appProductionAddresses.address })
      .from(appProductionAddresses),
  ]);

  const out = new Set<string>();
  for (const row of [...envs, ...prodAddrs]) {
    if (!row.address) continue;
    const origin = originFromUrl(row.address);
    if (origin) out.add(origin);
  }
  return out;
}

/**
 * Return the current set of database-configured origins (environment + production
 * addresses, normalized to bare origins). Cached for 30 seconds so CORS
 * middleware doesn't hit the DB on every request.
 */
export async function getDbConfiguredOrigins(): Promise<Set<string>> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.origins;
  if (inflight) return inflight;

  inflight = loadFromDb()
    .then((origins) => {
      cached = { origins, expiresAt: Date.now() + CACHE_TTL_MS };
      return origins;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Force the next call to re-query the database. */
export function invalidateDbOriginsCache(): void {
  cached = null;
}

/**
 * Is this origin a "dev" origin — localhost, 127.0.0.1, or *.local (at any port)?
 */
export function isDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Decide whether an incoming Origin header should be allowed.
 *   - Always allow localhost / 127.0.0.1 / *.local (for dev).
 *   - Allow origins in the static env-configured list.
 *   - Allow any origin matching an app environment or production address.
 */
export async function isOriginAllowed(
  origin: string,
  staticOrigins: Set<string>
): Promise<boolean> {
  if (isDevOrigin(origin)) return true;
  if (staticOrigins.has(origin)) return true;
  const dbOrigins = await getDbConfiguredOrigins();
  return dbOrigins.has(origin);
}
