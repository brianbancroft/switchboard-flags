import type {
  App,
  AppEnvironment,
  AppProductionAddress,
} from "../db/schema.js";

export type AppEnvironmentSnapshot = {
  name: string;
  address: string | null;
  enabled: boolean;
  position: number;
};

function normalizedName(value: string) {
  return value.trim().toLowerCase();
}

export function isDefaultEnvironmentName(value: string) {
  const normalized = normalizedName(value);
  return (
    normalized === "production" ||
    normalized === "staging" ||
    normalized === "nightly"
  );
}

export function deriveLegacyAddressesFromEnvironments(
  environments: AppEnvironmentSnapshot[]
) {
  const staging = environments.find(
    (environment) => normalizedName(environment.name) === "staging"
  );
  const nightly = environments.find(
    (environment) => normalizedName(environment.name) === "nightly"
  );
  const production = environments.filter(
    (environment) => normalizedName(environment.name) === "production"
  );

  return {
    stagingAddress: staging?.address ?? null,
    nightlyAddress: nightly?.address ?? null,
    productionAddresses: production
      .filter((environment) => environment.address)
      .map((environment) => ({
        label: environment.name,
        address: environment.address as string,
      })),
  };
}

export function mergeAppEnvironments(
  app: App,
  productionAddresses: AppProductionAddress[],
  persistedEnvironments: AppEnvironment[] = []
) {
  const merged = [...persistedEnvironments]
    .sort((left, right) => left.position - right.position)
    .map((environment) => ({
      id: environment.id,
      appId: environment.appId,
      name: environment.name,
      address: environment.address,
      enabled: environment.enabled,
      isDev: environment.isDev,
      position: environment.position,
      createdAt: environment.createdAt,
      updatedAt: environment.updatedAt,
    }));

  const seen = new Set(
    merged.map((environment) => normalizedName(environment.name))
  );

  const legacyDefaults = [
    ...productionAddresses.map((productionAddress) => ({
      name: productionAddress.label,
      address: productionAddress.address,
      enabled: true,
    })),
    {
      name: "staging",
      address: app.stagingAddress,
      enabled: true,
    },
    {
      name: "nightly",
      address: app.nightlyAddress,
      enabled: true,
    },
  ];

  let nextPosition = merged.length;
  for (const environment of legacyDefaults) {
    const key = normalizedName(environment.name);
    if (seen.has(key) || environment.address === null) {
      continue;
    }

    merged.push({
      id: `${app.id}:${environment.name}`,
      appId: app.id,
      name: environment.name,
      address: environment.address,
      enabled: environment.enabled,
      isDev: false,
      position: nextPosition,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    });
    seen.add(key);
    nextPosition += 1;
  }

  return merged;
}
