import { z } from "@hono/zod-openapi";
import type {
  ApiKey,
  ApiKeyScope,
  App,
  AppEnvironment,
  AppMember,
  AppProductionAddress,
  DevOverride,
  FeatureFlag,
  FeatureFlagConfig,
  FeatureFlagRule,
  FlagAuditLogEntry,
  FlagEnvironmentValue,
  FlagOverride,
  FlagValueType,
  JsonValue,
  User,
} from "../db/schema.js";

export const appMemberRoleSchema = z.enum(["admin", "manager", "developer"]);
export const environmentMemberRoleSchema = appMemberRoleSchema;

export const apiKeyScopeSchema = z.enum([
  "app:read",
  "app:write",
  "app:admin",
  "flags:read",
  "flags:write",
  "flags:override",
  "apiKeys:read",
  "apiKeys:write",
]);

export const flagValueTypeSchema = z.enum([
  "boolean",
  "string",
  "number",
  "json",
]);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

export const featureFlagRuleSchema: z.ZodType<FeatureFlagRule> = z
  .object({
    attribute: z.string().min(1).max(120),
    operator: z.enum([
      "eq",
      "ne",
      "in",
      "not_in",
      "lt",
      "lte",
      "gt",
      "gte",
      "contains",
      "starts_with",
      "ends_with",
    ]),
    value: jsonValueSchema,
  })
  .superRefine((rule, ctx) => {
    if (
      (rule.operator === "in" || rule.operator === "not_in") &&
      !Array.isArray(rule.value)
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${rule.operator} rules require an array value`,
        path: ["value"],
      });
    }

    if (
      (rule.operator === "lt" ||
        rule.operator === "lte" ||
        rule.operator === "gt" ||
        rule.operator === "gte") &&
      typeof rule.value !== "number"
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${rule.operator} rules require a numeric value`,
        path: ["value"],
      });
    }

    if (
      (rule.operator === "contains" ||
        rule.operator === "starts_with" ||
        rule.operator === "ends_with") &&
      typeof rule.value !== "string"
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${rule.operator} rules require a string value`,
        path: ["value"],
      });
    }
  });

export function isValueCompatibleWithFlagType(
  value: JsonValue,
  type: FlagValueType
): boolean {
  if (type === "json") {
    return true;
  }

  if (type === "boolean") {
    return typeof value === "boolean";
  }

  if (type === "string") {
    return typeof value === "string";
  }

  if (type === "number") {
    return typeof value === "number";
  }

  return false;
}

export const featureFlagConfigSchema: z.ZodType<FeatureFlagConfig> = z
  .object({
    type: flagValueTypeSchema,
    defaultValue: jsonValueSchema,
    rules: z.array(featureFlagRuleSchema).default([]),
  })
  .superRefine((config, ctx) => {
    if (!isValueCompatibleWithFlagType(config.defaultValue, config.type)) {
      ctx.addIssue({
        code: "custom",
        message: `defaultValue must be compatible with the ${config.type} flag type`,
        path: ["defaultValue"],
      });
    }
  });

export const environmentAddressSchema = z.string().url().max(500);
export const appAddressSchema = environmentAddressSchema;

export const devEnvironmentAddressSchema = z
  .string()
  .url()
  .max(500)
  .refine(
    (url) => {
      try {
        const { hostname } = new URL(url);
        return (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname.endsWith(".local")
        );
      } catch {
        return false;
      }
    },
    {
      message:
        "Dev environment address must use localhost, 127.0.0.1, or a *.local domain",
    }
  );

export function isDevEnvironmentAddress(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  isMegaAdmin: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const inviteUserInputSchema = z.object({
  email: z.string().email().max(500),
});

export const productionAddressSchema = z.object({
  id: z.string().uuid(),
  appId: z.string().uuid(),
  label: z.string(),
  address: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const appEnvironmentSchema = z.object({
  id: z.string(),
  appId: z.string().uuid(),
  name: z.string(),
  address: z.string().url().nullable(),
  enabled: z.boolean(),
  isDev: z.boolean(),
  position: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const appSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string().uuid(),
  stagingAddress: z.string().url().nullable(),
  nightlyAddress: z.string().url().nullable(),
  environments: z.array(appEnvironmentSchema),
  productionAddresses: z.array(productionAddressSchema),
  membershipRole: appMemberRoleSchema.nullable(),
  isOwner: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const environmentSchema = appSchema;

export const appMemberSchema = z.object({
  id: z.string().uuid(),
  appId: z.string().uuid(),
  userId: z.string().uuid(),
  role: appMemberRoleSchema,
  user: userSummarySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const environmentMemberSchema = appMemberSchema;

export const featureFlagSchema = z.object({
  id: z.string().uuid(),
  appId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  config: featureFlagConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const flagOverrideSchema = z.object({
  id: z.string().uuid(),
  appId: z.string().uuid(),
  flagId: z.string().uuid(),
  userId: z.string().uuid(),
  value: jsonValueSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const devOverrideSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  appId: z.string().uuid(),
  environments: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const devOverrideToggleInputSchema = z.object({
  environmentId: z.string().uuid(),
});

export const apiKeySchema = z.object({
  id: z.string().uuid(),
  appId: z.string().uuid(),
  environmentId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  scopes: z.array(apiKeyScopeSchema),
  expiresAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const apiKeyWithSecretSchema = z.object({
  apiKey: apiKeySchema,
  plaintextKey: z.string(),
});

export const evaluateFlagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: flagValueTypeSchema,
  value: jsonValueSchema,
  source: z.enum(["default", "override", "rule"]),
  ruleMatched: z.boolean(),
  matchedRule: featureFlagRuleSchema.nullable(),
});

export const evaluateResponseSchema = z.object({
  appId: z.string().uuid(),
  evaluatedAt: z.string().datetime(),
  addressMatched: z.boolean(),
  evaluations: z.record(z.string(), evaluateFlagSchema),
});

export const appCreateInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500).nullable().optional(),
  stagingAddress: environmentAddressSchema.nullable().optional(),
  nightlyAddress: environmentAddressSchema.nullable().optional(),
  environments: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        address: environmentAddressSchema.nullable().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .max(25)
    .optional(),
});
export const environmentCreateInputSchema = appCreateInputSchema;

export const appUpdateInputSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(500).nullable().optional(),
    stagingAddress: environmentAddressSchema.nullable().optional(),
    nightlyAddress: environmentAddressSchema.nullable().optional(),
    environments: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          address: environmentAddressSchema.nullable().optional(),
          enabled: z.boolean().optional(),
        })
      )
      .max(25)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });
export const environmentUpdateInputSchema = appUpdateInputSchema;

export const productionAddressInputSchema = z.object({
  label: z.string().min(1).max(120),
  address: environmentAddressSchema,
});

export const productionAddressUpdateInputSchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    address: environmentAddressSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const environmentMemberCreateInputSchema = z.object({
  userId: z.string().uuid(),
  role: appMemberRoleSchema,
});

export const environmentMemberUpdateInputSchema = z.object({
  role: appMemberRoleSchema,
});

export const featureFlagCreateInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z]+(?:_[a-z]+)*$/, {
      message: "name must use snake_case",
    }),
  description: z.string().min(1).max(500).nullable().optional(),
  config: featureFlagConfigSchema,
});

export const featureFlagUpdateInputSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z]+(?:_[a-z]+)*$/, {
        message: "name must use snake_case",
      })
      .optional(),
    description: z.string().min(1).max(500).nullable().optional(),
    config: featureFlagConfigSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const flagOverrideCreateInputSchema = z.object({
  flagId: z.string().uuid(),
  userId: z.string().uuid(),
  value: jsonValueSchema,
});

export const flagOverrideUpdateInputSchema = z.object({
  value: jsonValueSchema,
});

export const flagOverrideListQuerySchema = z.object({
  flagId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const apiKeyCreateInputSchema = z.object({
  environmentId: z.string().uuid(),
  description: z.string().min(1).max(500).nullable().optional(),
  scopes: z.array(apiKeyScopeSchema).min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const evaluateRequestSchema = z.object({
  flagNames: z
    .array(
      z.string().regex(/^[a-z]+(?:_[a-z]+)*$/, {
        message: "flag names must use snake_case",
      })
    )
    .min(1)
    .max(200)
    .optional(),
  userId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  attributes: z.record(z.string(), jsonValueSchema).default({}),
});

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    image: user.image,
    isMegaAdmin: user.isMegaAdmin,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeApp(
  app: App,
  options: {
    environments: Array<
      Pick<
        AppEnvironment,
        | "id"
        | "appId"
        | "name"
        | "address"
        | "enabled"
        | "isDev"
        | "position"
        | "createdAt"
        | "updatedAt"
      >
    >;
    membershipRole: AppMember["role"] | null;
    isOwner: boolean;
    productionAddresses: AppProductionAddress[];
  }
) {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    ownerId: app.ownerId,
    stagingAddress: app.stagingAddress,
    nightlyAddress: app.nightlyAddress,
    environments: options.environments.map(serializeAppEnvironment),
    productionAddresses: options.productionAddresses.map(
      serializeProductionAddress
    ),
    membershipRole: options.membershipRole,
    isOwner: options.isOwner,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}
export const serializeEnvironment = serializeApp;

export function serializeAppEnvironment(
  environment: Pick<
    AppEnvironment,
    | "id"
    | "appId"
    | "name"
    | "address"
    | "enabled"
    | "isDev"
    | "position"
    | "createdAt"
    | "updatedAt"
  >
) {
  return {
    id: environment.id,
    appId: environment.appId,
    name: environment.name,
    address: environment.address,
    enabled: environment.enabled,
    isDev: environment.isDev,
    position: environment.position,
    createdAt: environment.createdAt.toISOString(),
    updatedAt: environment.updatedAt.toISOString(),
  };
}

export function serializeProductionAddress(
  productionAddress: AppProductionAddress
) {
  return {
    id: productionAddress.id,
    appId: productionAddress.appId,
    label: productionAddress.label,
    address: productionAddress.address,
    createdAt: productionAddress.createdAt.toISOString(),
    updatedAt: productionAddress.updatedAt.toISOString(),
  };
}

export function serializeAppMember(
  member: AppMember,
  user: Pick<User, "id" | "email" | "name" | "image">
) {
  return {
    id: member.id,
    appId: member.appId,
    userId: member.userId,
    role: member.role,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}
export const serializeEnvironmentMember = serializeAppMember;

export function serializeFeatureFlag(flag: FeatureFlag) {
  return {
    id: flag.id,
    appId: flag.appId,
    name: flag.name,
    description: flag.description,
    config: flag.config,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}

export function serializeFlagOverride(override: FlagOverride) {
  return {
    id: override.id,
    appId: override.appId,
    flagId: override.flagId,
    userId: override.userId,
    value: override.value,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  };
}

export function serializeDevOverride(devOverride: DevOverride) {
  return {
    id: devOverride.id,
    userId: devOverride.userId,
    appId: devOverride.appId,
    environments: devOverride.environments,
    createdAt: devOverride.createdAt.toISOString(),
    updatedAt: devOverride.updatedAt.toISOString(),
  };
}

export function serializeApiKey(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    appId: apiKey.appId,
    environmentId: apiKey.environmentId,
    description: apiKey.description,
    scopes: apiKey.scopes,
    expiresAt: toIsoString(apiKey.expiresAt),
    lastUsedAt: toIsoString(apiKey.lastUsedAt),
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString(),
  };
}

export function scopeAllows(
  scopes: ApiKeyScope[],
  acceptedScopes: ApiKeyScope[]
): boolean {
  return scopes.some((scope) => acceptedScopes.includes(scope));
}

export const flagEnvValueUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email(),
});

export const flagEnvValueSchema = z.object({
  id: z.string().uuid(),
  flagId: z.string().uuid(),
  appId: z.string().uuid(),
  environmentId: z.string().uuid(),
  value: z.boolean(),
  changedByUserId: z.string().uuid().nullable(),
  changedByUser: flagEnvValueUserSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const flagAuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  actionType: z.string(),
  flagId: z.string().uuid().nullable(),
  flagName: z.string().nullable(),
  appId: z.string().uuid(),
  environmentId: z.string().uuid().nullable(),
  changedByUserId: z.string().uuid().nullable(),
  changedByUser: flagEnvValueUserSchema.nullable(),
  oldValue: jsonValueSchema.nullable(),
  newValue: jsonValueSchema.nullable(),
  changedAt: z.string().datetime(),
});

export const flagEnvValueSetInputSchema = z.object({
  value: z.boolean(),
});

export function serializeFlagEnvValue(
  row: FlagEnvironmentValue,
  user: Pick<User, "id" | "name" | "email"> | null
) {
  return {
    id: row.id,
    flagId: row.flagId,
    appId: row.appId,
    environmentId: row.environmentId,
    value: row.value,
    changedByUserId: row.changedByUserId,
    changedByUser: user
      ? { id: user.id, name: user.name, email: user.email }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeFlagAuditLogEntry(
  row: FlagAuditLogEntry,
  user: Pick<User, "id" | "name" | "email"> | null
) {
  return {
    id: row.id,
    actionType: row.actionType,
    flagId: row.flagId ?? null,
    flagName: row.flagName ?? null,
    appId: row.appId,
    environmentId: row.environmentId ?? null,
    changedByUserId: row.changedByUserId,
    changedByUser: user
      ? { id: user.id, name: user.name, email: user.email }
      : null,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    changedAt: row.changedAt.toISOString(),
  };
}
