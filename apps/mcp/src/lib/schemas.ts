import type { JsonValue } from "@repo/api-sdk";
import { z } from "zod";

export const appRoleSchema = z.enum(["admin", "manager", "developer"]);
export const environmentRoleSchema = appRoleSchema;
export const appAddressSchema = z.string().url().max(500);
export const environmentAddressSchema = appAddressSchema;

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

export const featureFlagRuleSchema = z.object({
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
});

export const featureFlagConfigSchema = z.object({
  type: flagValueTypeSchema,
  defaultValue: jsonValueSchema,
  rules: z.array(featureFlagRuleSchema).default([]),
});

export const appRefSchema = z
  .object({
    appId: z.string().uuid().optional(),
    appName: z.string().min(1).max(120).optional(),
    environmentId: z.string().uuid().optional(),
    environmentName: z.string().min(1).max(120).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.appId ||
          value.appName ||
          value.environmentId ||
          value.environmentName
      ),
    "Provide appId or appName"
  );
export const environmentRefSchema = appRefSchema;

export const flagRefSchema = appRefSchema
  .extend({
    flagId: z.string().uuid().optional(),
    flagName: z
      .string()
      .regex(/^[a-z]+(?:_[a-z]+)*$/, {
        message: "flagName must use snake_case",
      })
      .optional(),
  })
  .refine((value) => Boolean(value.flagId || value.flagName), {
    message: "Provide flagId or flagName",
    path: ["flagName"],
  });

export const writeApprovalSchema = z.object({
  confirmed: z
    .literal(true)
    .describe(
      "Set this to true only after the human user explicitly approved the write action in the current conversation."
    ),
  reason: z
    .string()
    .min(8)
    .max(500)
    .describe("Short note describing the user's approval or intent."),
});
