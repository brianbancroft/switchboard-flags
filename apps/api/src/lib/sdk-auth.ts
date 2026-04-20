import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appEnvironments, appProductionAddresses } from "../db/schema.js";
import { mergeAppEnvironments } from "./app-environments.js";
import { isDevEnvironmentAddress } from "./contracts.js";
import { AppError } from "./errors.js";
import type { AppBindings } from "./types.js";

/**
 * Enforce that the caller URL is allowed for the current SDK credential.
 *
 * - Dev tokens (env.isDev === true): only accept localhost/127.0.0.1/*.local.
 * - Non-dev tokens: URL must match one of the app's enabled environment addresses.
 *
 * Returns `addressMatched` — always true on success; throws 403 on mismatch.
 * Pass `url = undefined` to skip validation (the caller didn't provide an origin).
 */
export async function validateCallerUrl(
  c: Context<AppBindings>,
  appId: string,
  url: string | undefined
): Promise<boolean> {
  if (!url) return true;

  const credential = c.get("sdkCredential");
  const isDevToken =
    credential.kind === "apiKey" && credential.isDevEnvironment;

  if (isDevToken) {
    if (!isDevEnvironmentAddress(url)) {
      throw new AppError(
        403,
        "ADDRESS_NOT_ALLOWED",
        "Dev tokens only accept localhost or *.local addresses"
      );
    }
    return true;
  }

  const environment = c.get("sdkApp");
  const [productionAddresses, environments] = await Promise.all([
    db.query.appProductionAddresses.findMany({
      where: eq(appProductionAddresses.appId, appId),
    }),
    db.query.appEnvironments.findMany({
      where: eq(appEnvironments.appId, appId),
      orderBy: (appEnvironment, { asc }) => [asc(appEnvironment.position)],
    }),
  ]);

  const matches = mergeAppEnvironments(
    environment,
    productionAddresses,
    environments
  )
    .filter(
      (appEnvironment) =>
        appEnvironment.enabled && Boolean(appEnvironment.address)
    )
    .map((appEnvironment) => appEnvironment.address as string);

  if (!matches.includes(url)) {
    throw new AppError(
      403,
      "ADDRESS_NOT_ALLOWED",
      "The caller URL does not match a registered app address"
    );
  }

  return true;
}
