import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { env } from "../env.js";
import { encrypt, generateApiKeyValue, hashSecret } from "../lib/security.js";
import { db, pool } from "./client.js";
import { runMigrations } from "./migrations.js";
import {
  accounts,
  apiKeys,
  appConfiguration,
  appEnvironments,
  appMembers,
  appProductionAddresses,
  apps,
  type FeatureFlagConfig,
  featureFlags,
  users,
} from "./schema.js";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000000";
const DEV_ADMIN_EMAIL = "admin@example.com";

const DEV_USERS = [
  {
    email: "admin@example.com",
    name: "Admin",
    username: "admin",
    password: "password",
    isMegaAdmin: true,
  },
  {
    email: "alice@example.com",
    name: "Alice Chen",
    username: "alice",
    password: "password",
    isMegaAdmin: false,
  },
  {
    email: "bob@example.com",
    name: "Bob Martinez",
    username: "bob",
    password: "password",
    isMegaAdmin: false,
  },
  {
    email: "carol@example.com",
    name: "Carol Okafor",
    username: "carol",
    password: "password",
    isMegaAdmin: false,
  },
  {
    email: "dave@example.com",
    name: "Dave Kim",
    username: "dave",
    password: "password",
    isMegaAdmin: false,
  },
] as const;

const DEV_DEMO_APP = {
  name: "acme-storefront",
  description:
    "Demo app seeded for local development with a few realistic environments and flags.",
  environments: [
    {
      name: "dev",
      address: null,
      enabled: true,
      isDev: true,
      position: -1,
    },
    {
      name: "production",
      address: "https://app.acme.test",
      enabled: true,
      isDev: false,
      position: 0,
    },
    {
      name: "staging",
      address: "https://staging.acme.test",
      enabled: true,
      isDev: false,
      position: 1,
    },
    {
      name: "nightly",
      address: "https://nightly.acme.test",
      enabled: true,
      isDev: false,
      position: 2,
    },
    {
      name: "preview",
      address: "https://preview.acme.test",
      enabled: false,
      isDev: false,
      position: 3,
    },
  ],
  flags: [
    {
      name: "new_checkout",
      description: "Turns on the redesigned checkout flow for internal users.",
      config: {
        type: "boolean",
        defaultValue: false,
        rules: [
          {
            attribute: "email",
            operator: "ends_with",
            value: "@example.com",
          },
        ],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "maintenance_banner",
      description: "Controls the copy shown in the maintenance banner.",
      config: {
        type: "string",
        defaultValue: "Scheduled maintenance Sunday 02:00 UTC",
        rules: [],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "max_dashboard_cards",
      description: "Default number of dashboard cards shown on first load.",
      config: {
        type: "number",
        defaultValue: 6,
        rules: [],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "support_widget",
      description: "JSON config for the embedded support widget.",
      config: {
        type: "json",
        defaultValue: {
          enabled: true,
          provider: "helpdesk",
          placement: "bottom-right",
        },
        rules: [],
      } satisfies FeatureFlagConfig,
    },
  ],
} as const;

const DEV_DASHBOARD_APP = {
  name: "switchboard-dashboard",
  description:
    "Sample Mission Control dashboard for testing feature flags end-to-end.",
  environments: [
    {
      name: "switchboard-dash.local",
      address: "http://switchboard-dash.local:3002",
      enabled: true,
      isDev: true,
      position: 0,
    },
  ],
  flags: [
    {
      name: "show_status_banner",
      description:
        "Toggles the system-status banner at the top of the Command Center page.",
      config: {
        type: "boolean",
        defaultValue: true,
        rules: [],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "dashboard_theme",
      description:
        'Controls the dashboard colour scheme. Values: "default", "neon", "retro".',
      config: {
        type: "string",
        defaultValue: "default",
        rules: [],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "max_chart_points",
      description:
        "Maximum number of data points rendered in traffic charts.",
      config: {
        type: "number",
        defaultValue: 12,
        rules: [],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "enable_incident_alerts",
      description:
        "When enabled, active incidents pulse a red dot in the sidebar.",
      config: {
        type: "boolean",
        defaultValue: false,
        rules: [
          {
            attribute: "email",
            operator: "ends_with",
            value: "@example.com",
          },
        ],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "deployment_view",
      description:
        'Switches between deployment timeline layouts. Values: "timeline", "grid".',
      config: {
        type: "string",
        defaultValue: "timeline",
        rules: [],
      } satisfies FeatureFlagConfig,
    },
    {
      name: "settings_panel_config",
      description:
        "JSON blob controlling which settings panels are visible and their order.",
      config: {
        type: "json",
        defaultValue: {
          panels: [
            "general",
            "notifications",
            "security",
            "integrations",
            "api-keys",
          ],
          showAdvanced: false,
        },
        rules: [],
      } satisfies FeatureFlagConfig,
    },
  ],
} as const;

function encryptOptional(value: string | undefined): string | null {
  if (!value) return null;
  return encrypt(value, env.BETTER_AUTH_SECRET);
}

async function findCredentialAccount(userId: string) {
  return db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, userId),
      eq(accounts.providerId, "credential")
    ),
  });
}

async function ensureDevCredentialUser(input: {
  email: string;
  name: string;
  username: string;
  password: string;
  isMegaAdmin?: boolean;
}) {
  const { hashPassword } = await import("better-auth/crypto");

  let user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (!user) {
    console.log(`Creating dev user ${input.email}...`);
    const [createdUser] = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        username: input.username,
        emailVerified: true,
        isMegaAdmin: input.isMegaAdmin ?? false,
      })
      .returning();

    if (!createdUser) {
      throw new Error(`User insert returned no row for ${input.email}`);
    }

    user = createdUser;
  } else {
    const [updatedUser] = await db
      .update(users)
      .set({
        name: input.name,
        username: input.username,
        emailVerified: true,
        isMegaAdmin: input.isMegaAdmin ?? user.isMegaAdmin,
      })
      .where(eq(users.id, user.id))
      .returning();

    if (updatedUser) {
      user = updatedUser;
    }
  }

  const existingCredentialAccount = await findCredentialAccount(user.id);
  if (!existingCredentialAccount) {
    const hashedPassword = await hashPassword(input.password);
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
    });
  }

  return user;
}

async function seedAppConfiguration() {
  console.log("Seeding app_configuration...");

  await db
    .insert(appConfiguration)
    .values({
      id: SINGLETON_ID,
      authPasswordEnabled: env.AUTH_PASSWORD_ENABLED,
      authGithubEnabled: env.AUTH_GITHUB_ENABLED,
      authGoogleEnabled: env.AUTH_GOOGLE_ENABLED,
      authAppleEnabled: env.AUTH_APPLE_ENABLED,
      authMetaEnabled: env.AUTH_META_ENABLED,
      authOidcEnabled: env.AUTH_OIDC_ENABLED,
      githubClientId: encryptOptional(env.AUTH_GITHUB_CLIENT_ID),
      githubClientSecret: encryptOptional(env.AUTH_GITHUB_CLIENT_SECRET),
      googleClientId: encryptOptional(env.AUTH_GOOGLE_CLIENT_ID),
      googleClientSecret: encryptOptional(env.AUTH_GOOGLE_CLIENT_SECRET),
      appleClientId: encryptOptional(env.AUTH_APPLE_CLIENT_ID),
      appleClientSecret: encryptOptional(env.AUTH_APPLE_CLIENT_SECRET),
      metaClientId: encryptOptional(env.AUTH_META_CLIENT_ID),
      metaClientSecret: encryptOptional(env.AUTH_META_CLIENT_SECRET),
    })
    .onConflictDoUpdate({
      target: appConfiguration.id,
      set: {
        authPasswordEnabled: env.AUTH_PASSWORD_ENABLED,
        authGithubEnabled: env.AUTH_GITHUB_ENABLED,
        authGoogleEnabled: env.AUTH_GOOGLE_ENABLED,
        authAppleEnabled: env.AUTH_APPLE_ENABLED,
        authMetaEnabled: env.AUTH_META_ENABLED,
        authOidcEnabled: env.AUTH_OIDC_ENABLED,
        githubClientId: encryptOptional(env.AUTH_GITHUB_CLIENT_ID),
        githubClientSecret: encryptOptional(env.AUTH_GITHUB_CLIENT_SECRET),
        googleClientId: encryptOptional(env.AUTH_GOOGLE_CLIENT_ID),
        googleClientSecret: encryptOptional(env.AUTH_GOOGLE_CLIENT_SECRET),
        appleClientId: encryptOptional(env.AUTH_APPLE_CLIENT_ID),
        appleClientSecret: encryptOptional(env.AUTH_APPLE_CLIENT_SECRET),
        metaClientId: encryptOptional(env.AUTH_META_CLIENT_ID),
        metaClientSecret: encryptOptional(env.AUTH_META_CLIENT_SECRET),
        updatedAt: new Date(),
      },
    });

  console.log("app_configuration seeded.");
}

async function seedDevUsers() {
  if (env.NODE_ENV !== "development") {
    console.log("Skipping dev user seed (not in development mode).");
    return null;
  }

  let admin = null;
  for (const userInput of DEV_USERS) {
    const user = await ensureDevCredentialUser(userInput);
    if (userInput.email === DEV_ADMIN_EMAIL) {
      admin = user;
    }
    console.log(
      `Dev user @${userInput.username} (${userInput.email}) is ready with password "password".`
    );
  }

  return admin;
}

async function seedDevDemoApp(
  adminUserId: string,
  appDef: typeof DEV_DEMO_APP | typeof DEV_DASHBOARD_APP = DEV_DEMO_APP,
) {
  if (env.NODE_ENV !== "development") {
    console.log("Skipping demo app seed (not in development mode).");
    return;
  }

  console.log(`Seeding demo app ${appDef.name}...`);

  await db.transaction(async (tx) => {
    const existingApp = await tx.query.apps.findFirst({
      where: eq(apps.name, appDef.name),
    });

    let appId = existingApp?.id;

    if (!existingApp) {
      const [createdApp] = await tx
        .insert(apps)
        .values({
          name: appDef.name,
          description: appDef.description,
          ownerId: adminUserId,
          stagingAddress:
            appDef.environments.find(
              (environment) => environment.name === "staging"
            )?.address ?? null,
          nightlyAddress:
            appDef.environments.find(
              (environment) => environment.name === "nightly"
            )?.address ?? null,
        })
        .returning();

      if (!createdApp) {
        throw new Error(`${appDef.name} insert returned no row`);
      }

      appId = createdApp.id;
    } else {
      const [updatedApp] = await tx
        .update(apps)
        .set({
          description: appDef.description,
          ownerId: adminUserId,
          stagingAddress:
            appDef.environments.find(
              (environment) => environment.name === "staging"
            )?.address ?? null,
          nightlyAddress:
            appDef.environments.find(
              (environment) => environment.name === "nightly"
            )?.address ?? null,
        })
        .where(eq(apps.id, existingApp.id))
        .returning();

      appId = updatedApp?.id ?? existingApp.id;
    }

    if (!appId) {
      throw new Error(`${appDef.name} did not resolve to an id`);
    }

    const existingMembership = await tx.query.appMembers.findFirst({
      where: and(
        eq(appMembers.appId, appId),
        eq(appMembers.userId, adminUserId)
      ),
    });

    if (!existingMembership) {
      await tx.insert(appMembers).values({
        appId,
        userId: adminUserId,
        role: "admin",
      });
    } else if (existingMembership.role !== "admin") {
      await tx
        .update(appMembers)
        .set({ role: "admin" })
        .where(eq(appMembers.id, existingMembership.id));
    }

    for (const environment of appDef.environments) {
      const existingEnvironment = await tx.query.appEnvironments.findFirst({
        where: and(
          eq(appEnvironments.appId, appId),
          eq(appEnvironments.name, environment.name)
        ),
      });

      if (!existingEnvironment) {
        await tx.insert(appEnvironments).values({
          appId,
          name: environment.name,
          address: environment.address,
          enabled: environment.enabled,
          isDev: environment.isDev,
          position: environment.position,
        });
      } else {
        await tx
          .update(appEnvironments)
          .set({
            address: environment.address,
            enabled: environment.enabled,
            isDev: environment.isDev,
            position: environment.position,
          })
          .where(eq(appEnvironments.id, existingEnvironment.id));
      }
    }

    const productionEnvironment = appDef.environments.find(
      (environment) => environment.name === "production"
    );

    if (productionEnvironment?.address) {
      const existingProductionAddress =
        await tx.query.appProductionAddresses.findFirst({
          where: and(
            eq(appProductionAddresses.appId, appId),
            eq(appProductionAddresses.label, productionEnvironment.name)
          ),
        });

      if (!existingProductionAddress) {
        await tx.insert(appProductionAddresses).values({
          appId,
          label: productionEnvironment.name,
          address: productionEnvironment.address,
        });
      } else {
        await tx
          .update(appProductionAddresses)
          .set({
            address: productionEnvironment.address,
          })
          .where(eq(appProductionAddresses.id, existingProductionAddress.id));
      }
    }

    for (const flag of appDef.flags) {
      const existingFlag = await tx.query.featureFlags.findFirst({
        where: and(
          eq(featureFlags.appId, appId),
          eq(featureFlags.name, flag.name)
        ),
      });

      if (!existingFlag) {
        await tx.insert(featureFlags).values({
          appId,
          name: flag.name,
          description: flag.description,
          config: flag.config,
        });
      } else {
        await tx
          .update(featureFlags)
          .set({
            description: flag.description,
            config: flag.config,
          })
          .where(eq(featureFlags.id, existingFlag.id));
      }
    }
  });

  console.log(`Demo app ${appDef.name} seeded.`);
}

async function ensureDashboardSdkToken() {
  if (env.NODE_ENV !== "development") return;

  const app = await db.query.apps.findFirst({
    where: eq(apps.name, DEV_DASHBOARD_APP.name),
  });
  if (!app) return;

  const devEnv = await db.query.appEnvironments.findFirst({
    where: and(eq(appEnvironments.appId, app.id), eq(appEnvironments.isDev, true)),
  });
  if (!devEnv) return;

  const existing = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.appId, app.id),
      eq(apiKeys.environmentId, devEnv.id),
      eq(apiKeys.description, "Dashboard demo token (seeded)")
    ),
  });

  const plaintext = existing ? null : generateApiKeyValue();

  if (!existing && plaintext) {
    await db.insert(apiKeys).values({
      appId: app.id,
      environmentId: devEnv.id,
      description: "Dashboard demo token (seeded)",
      hashedKey: hashSecret(plaintext),
      scopes: ["flags:read"],
    });
  }

  if (!plaintext) {
    console.log(
      "Dashboard demo SDK token already exists (unchanged). Plaintext not re-emitted."
    );
    return;
  }

  const seedDir = dirname(fileURLToPath(import.meta.url));
  const dashboardEnvPath = resolve(seedDir, "../../../../apps/dashboard/.env.local");
  await mkdir(dirname(dashboardEnvPath), { recursive: true });
  const body =
    `# Autogenerated by pnpm db:seed — safe to delete to rotate.\n` +
    `SWITCHBOARD_API_URL=http://localhost:4000\n` +
    `SWITCHBOARD_TOKEN=${plaintext}\n` +
    `SWITCHBOARD_CALLER_URL=http://localhost:3002\n`;
  await writeFile(dashboardEnvPath, body, { encoding: "utf8" });
  console.log(`Wrote dashboard SDK token to ${dashboardEnvPath}`);
}

async function main() {
  try {
    console.log("Ensuring database migrations are applied...");
    await runMigrations();
    await seedAppConfiguration();
    const admin = await seedDevUsers();
    if (admin) {
      await seedDevDemoApp(admin.id);
      await seedDevDemoApp(admin.id, DEV_DASHBOARD_APP);
      await ensureDashboardSdkToken();
    }
    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
