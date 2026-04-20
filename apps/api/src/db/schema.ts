import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const appMemberRoleEnum = pgEnum("environment_member_role", [
  "admin",
  "manager",
  "developer",
]);

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FlagValueType = "boolean" | "string" | "number" | "json";

export type FeatureFlagRule = {
  attribute: string;
  operator:
    | "eq"
    | "ne"
    | "in"
    | "not_in"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "contains"
    | "starts_with"
    | "ends_with";
  value: JsonValue;
};

export type FeatureFlagConfig = {
  type: FlagValueType;
  defaultValue: JsonValue;
  rules: FeatureFlagRule[];
};

export type ApiKeyScope =
  | "app:read"
  | "app:write"
  | "app:admin"
  | "flags:read"
  | "flags:write"
  | "flags:override"
  | "apiKeys:read"
  | "apiKeys:write";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    username: text("username"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    isMegaAdmin: boolean("is_mega_admin").default(false).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("users_email_unique_idx").on(table.email),
    uniqueIndex("users_username_unique_idx").on(table.username),
    index("users_mega_admin_idx").on(table.isMegaAdmin),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("sessions_token_unique_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_unique_idx").on(
      table.providerId,
      table.accountId
    ),
    index("accounts_user_id_idx").on(table.userId),
  ]
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("verifications_identifier_value_unique_idx").on(
      table.identifier,
      table.value
    ),
    index("verifications_expires_at_idx").on(table.expiresAt),
  ]
);

export const apps = pgTable(
  "apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    // The API should always create or update the matching membership row as admin.
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    stagingAddress: text("staging_address"),
    nightlyAddress: text("nightly_address"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("apps_name_unique_idx").on(table.name),
    index("apps_owner_id_idx").on(table.ownerId),
  ]
);

/** @deprecated Use `apps` */
export const environments = apps;

export const appProductionAddresses = pgTable(
  "app_production_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("app_production_addresses_app_label_unique_idx").on(
      table.appId,
      table.label
    ),
    uniqueIndex("app_production_addresses_app_address_unique_idx").on(
      table.appId,
      table.address
    ),
    index("app_production_addresses_app_id_idx").on(table.appId),
  ]
);

/** @deprecated Use `appProductionAddresses` */
export const environmentProductionAddresses = appProductionAddresses;

export const appEnvironments = pgTable(
  "app_environments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    address: text("address"),
    enabled: boolean("enabled").default(true).notNull(),
    isDev: boolean("is_dev").default(false).notNull(),
    position: integer("position").default(0).notNull(),
    flagsVersion: bigint("flags_version", { mode: "number" })
      .notNull()
      .default(1),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("app_environments_app_name_unique_idx").on(
      table.appId,
      table.name
    ),
    // Enforce at most one dev environment per app
    uniqueIndex("app_environments_app_dev_unique_idx")
      .on(table.appId)
      .where(sql`${table.isDev} = true`),
    index("app_environments_app_id_idx").on(table.appId),
    index("app_environments_app_position_idx").on(table.appId, table.position),
  ]
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    description: text("description"),
    config: jsonb("config")
      .$type<FeatureFlagConfig>()
      .notNull()
      .default(
        sql`'{"type":"boolean","defaultValue":false,"rules":[]}'::jsonb`
      ),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("feature_flags_app_name_unique_idx").on(
      table.appId,
      table.name
    ),
    unique("feature_flags_app_id_id_unique").on(table.appId, table.id),
    index("feature_flags_app_id_idx").on(table.appId),
    check(
      "feature_flags_name_format_check",
      sql`${table.name} ~ '^[a-z]+(?:_[a-z]+)*$'`
    ),
  ]
);

export const appMembers = pgTable(
  "app_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: appMemberRoleEnum("role").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("app_members_app_user_unique_idx").on(
      table.appId,
      table.userId
    ),
    index("app_members_app_role_idx").on(table.appId, table.role),
    index("app_members_user_id_idx").on(table.userId),
  ]
);

/** @deprecated Use `appMembers` */
export const environmentMembers = appMembers;

export const flagOverrides = pgTable(
  "flag_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flagId: uuid("flag_id").notNull(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: jsonb("value").$type<JsonValue>().notNull(),
    ...timestamps(),
  },
  (table) => [
    // Evaluation reads are typically scoped by app + user, while
    // management screens often filter by app + flag.
    foreignKey({
      name: "flag_overrides_app_flag_fk",
      columns: [table.appId, table.flagId],
      foreignColumns: [featureFlags.appId, featureFlags.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    uniqueIndex("flag_overrides_app_user_flag_unique_idx").on(
      table.appId,
      table.userId,
      table.flagId
    ),
    index("flag_overrides_app_flag_idx").on(table.appId, table.flagId),
    index("flag_overrides_flag_id_idx").on(table.flagId),
    index("flag_overrides_user_id_idx").on(table.userId),
  ]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    environmentId: uuid("environment_id").references(() => appEnvironments.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    hashedKey: text("hashed_key").notNull(),
    description: text("description"),
    scopes: jsonb("scopes")
      .$type<ApiKeyScope[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("api_keys_hashed_key_unique_idx").on(table.hashedKey),
    index("api_keys_app_id_idx").on(table.appId),
    index("api_keys_app_expires_at_idx").on(table.appId, table.expiresAt),
    index("api_keys_environment_id_idx").on(table.environmentId),
  ]
);

export const appConfiguration = pgTable("app_configuration", {
  id: uuid("id")
    .primaryKey()
    .default(sql`'00000000-0000-0000-0000-000000000000'::uuid`),
  authPasswordEnabled: boolean("auth_password_enabled").default(true).notNull(),
  authGithubEnabled: boolean("auth_github_enabled").default(false).notNull(),
  authGoogleEnabled: boolean("auth_google_enabled").default(false).notNull(),
  authAppleEnabled: boolean("auth_apple_enabled").default(false).notNull(),
  authMetaEnabled: boolean("auth_meta_enabled").default(false).notNull(),
  authOidcEnabled: boolean("auth_oidc_enabled").default(false).notNull(),
  githubClientId: text("github_client_id"),
  githubClientSecret: text("github_client_secret"),
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"),
  appleClientId: text("apple_client_id"),
  appleClientSecret: text("apple_client_secret"),
  metaClientId: text("meta_client_id"),
  metaClientSecret: text("meta_client_secret"),
  ...timestamps(),
});

export const oidcProviders = pgTable(
  "oidc_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    issuerUrl: text("issuer_url").notNull(),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("oidc_providers_slug_unique_idx").on(table.slug)]
);

export const flagEnvironmentValues = pgTable(
  "flag_environment_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flagId: uuid("flag_id").notNull(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => appEnvironments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: jsonb("value").$type<JsonValue>().notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "flag_env_values_app_flag_fk",
      columns: [table.appId, table.flagId],
      foreignColumns: [featureFlags.appId, featureFlags.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    uniqueIndex("flag_env_values_flag_env_unique_idx").on(
      table.flagId,
      table.environmentId
    ),
    index("flag_env_values_app_flag_idx").on(table.appId, table.flagId),
  ]
);

export const flagAuditLog = pgTable(
  "flag_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actionType: text("action_type").notNull().default("flag_value_changed"),
    flagId: uuid("flag_id").references(() => featureFlags.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    flagName: text("flag_name"),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    environmentId: uuid("environment_id").references(() => appEnvironments.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    oldValue: jsonb("old_value").$type<JsonValue | null>(),
    newValue: jsonb("new_value").$type<JsonValue | null>(),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("flag_audit_log_flag_id_idx").on(table.flagId),
    index("flag_audit_log_app_id_changed_at_idx").on(
      table.appId,
      table.changedAt
    ),
  ]
);

export const devOverrides = pgTable(
  "dev_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    environments: jsonb("environments")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("dev_overrides_user_app_unique_idx").on(
      table.userId,
      table.appId
    ),
    index("dev_overrides_user_id_idx").on(table.userId),
    index("dev_overrides_app_id_idx").on(table.appId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  ownedApps: many(apps),
  appMemberships: many(appMembers),
  flagOverrides: many(flagOverrides),
  devOverrides: many(devOverrides),
  flagEnvironmentValues: many(flagEnvironmentValues),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const appsRelations = relations(apps, ({ one, many }) => ({
  owner: one(users, {
    fields: [apps.ownerId],
    references: [users.id],
  }),
  environments: many(appEnvironments),
  productionAddresses: many(appProductionAddresses),
  featureFlags: many(featureFlags),
  members: many(appMembers),
  flagOverrides: many(flagOverrides),
  devOverrides: many(devOverrides),
  apiKeys: many(apiKeys),
}));

export const appEnvironmentsRelations = relations(
  appEnvironments,
  ({ one }) => ({
    app: one(apps, {
      fields: [appEnvironments.appId],
      references: [apps.id],
    }),
  })
);

export const appProductionAddressesRelations = relations(
  appProductionAddresses,
  ({ one }) => ({
    app: one(apps, {
      fields: [appProductionAddresses.appId],
      references: [apps.id],
    }),
  })
);

export const featureFlagsRelations = relations(
  featureFlags,
  ({ one, many }) => ({
    app: one(apps, {
      fields: [featureFlags.appId],
      references: [apps.id],
    }),
    overrides: many(flagOverrides),
    environmentValues: many(flagEnvironmentValues),
    auditLog: many(flagAuditLog),
  })
);

export const flagEnvironmentValuesRelations = relations(
  flagEnvironmentValues,
  ({ one }) => ({
    flag: one(featureFlags, {
      fields: [flagEnvironmentValues.appId, flagEnvironmentValues.flagId],
      references: [featureFlags.appId, featureFlags.id],
    }),
    environment: one(appEnvironments, {
      fields: [flagEnvironmentValues.environmentId],
      references: [appEnvironments.id],
    }),
    changedByUser: one(users, {
      fields: [flagEnvironmentValues.changedByUserId],
      references: [users.id],
    }),
  })
);

export const flagAuditLogRelations = relations(flagAuditLog, ({ one }) => ({
  flag: one(featureFlags, {
    fields: [flagAuditLog.appId, flagAuditLog.flagId],
    references: [featureFlags.appId, featureFlags.id],
  }),
  environment: one(appEnvironments, {
    fields: [flagAuditLog.environmentId],
    references: [appEnvironments.id],
  }),
  changedByUser: one(users, {
    fields: [flagAuditLog.changedByUserId],
    references: [users.id],
  }),
}));

export const appMembersRelations = relations(appMembers, ({ one }) => ({
  app: one(apps, {
    fields: [appMembers.appId],
    references: [apps.id],
  }),
  user: one(users, {
    fields: [appMembers.userId],
    references: [users.id],
  }),
}));

export const flagOverridesRelations = relations(flagOverrides, ({ one }) => ({
  app: one(apps, {
    fields: [flagOverrides.appId],
    references: [apps.id],
  }),
  flag: one(featureFlags, {
    fields: [flagOverrides.appId, flagOverrides.flagId],
    references: [featureFlags.appId, featureFlags.id],
  }),
  user: one(users, {
    fields: [flagOverrides.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  app: one(apps, {
    fields: [apiKeys.appId],
    references: [apps.id],
  }),
  environment: one(appEnvironments, {
    fields: [apiKeys.environmentId],
    references: [appEnvironments.id],
  }),
}));

export const devOverridesRelations = relations(devOverrides, ({ one }) => ({
  user: one(users, {
    fields: [devOverrides.userId],
    references: [users.id],
  }),
  app: one(apps, {
    fields: [devOverrides.appId],
    references: [apps.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthSessionRecord = typeof sessions.$inferSelect;
export type NewAuthSessionRecord = typeof sessions.$inferInsert;
export type AuthAccount = typeof accounts.$inferSelect;
export type NewAuthAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type AppEnvironment = typeof appEnvironments.$inferSelect;
export type NewAppEnvironment = typeof appEnvironments.$inferInsert;
export type AppProductionAddress = typeof appProductionAddresses.$inferSelect;
export type NewAppProductionAddress =
  typeof appProductionAddresses.$inferInsert;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
export type AppMember = typeof appMembers.$inferSelect;
export type NewAppMember = typeof appMembers.$inferInsert;
export type FlagOverride = typeof flagOverrides.$inferSelect;
export type NewFlagOverride = typeof flagOverrides.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AppConfiguration = typeof appConfiguration.$inferSelect;
export type NewAppConfiguration = typeof appConfiguration.$inferInsert;
export type OidcProvider = typeof oidcProviders.$inferSelect;
export type NewOidcProvider = typeof oidcProviders.$inferInsert;
export type DevOverride = typeof devOverrides.$inferSelect;
export type NewDevOverride = typeof devOverrides.$inferInsert;
export type FlagEnvironmentValue = typeof flagEnvironmentValues.$inferSelect;
export type NewFlagEnvironmentValue = typeof flagEnvironmentValues.$inferInsert;
export type FlagAuditLogEntry = typeof flagAuditLog.$inferSelect;
export type NewFlagAuditLogEntry = typeof flagAuditLog.$inferInsert;

// Deprecated aliases for backwards compatibility during migration
/** @deprecated Use `App` */
export type Environment = App;
/** @deprecated Use `NewApp` */
export type NewEnvironment = NewApp;
/** @deprecated Use `AppProductionAddress` */
export type EnvironmentProductionAddress = AppProductionAddress;
/** @deprecated Use `NewAppProductionAddress` */
export type NewEnvironmentProductionAddress = NewAppProductionAddress;
/** @deprecated Use `AppMember` */
export type EnvironmentMember = AppMember;
/** @deprecated Use `NewAppMember` */
export type NewEnvironmentMember = NewAppMember;
