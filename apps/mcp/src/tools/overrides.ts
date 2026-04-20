import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerReadTool, registerWriteTool } from "../lib/register.js";
import {
  appRefSchema,
  jsonValueSchema,
  writeApprovalSchema,
} from "../lib/schemas.js";

const flagLookupSchema = z
  .object({
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

export function registerOverrideTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "list_flag_overrides",
    "List flag overrides for an app, optionally filtered by flag and/or userId.",
    appRefSchema.extend({
      flagId: z.string().uuid().optional(),
      flagName: z
        .string()
        .regex(/^[a-z]+(?:_[a-z]+)*$/, {
          message: "flagName must use snake_case",
        })
        .optional(),
      userId: z.string().uuid().optional(),
    }),
    async (input) => {
      const app = await backend.resolveApp(input);
      const flag =
        input.flagId || input.flagName
          ? await backend.resolveFlag({
              app,
              flagId: input.flagId,
              flagName: input.flagName,
            })
          : null;

      const result = await backend.listOverrides(app.id, {
        flagId: flag?.id,
        userId: input.userId,
      });

      return {
        app,
        flag,
        overrides: result.overrides,
      };
    }
  );

  registerWriteTool(
    server,
    "set_flag_override",
    "Create or update a per-user flag override after explicit user approval.",
    appRefSchema.merge(flagLookupSchema).extend({
      userId: z.string().uuid(),
      value: jsonValueSchema,
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      const flag = await backend.resolveFlag({
        app,
        flagId: input.flagId,
        flagName: input.flagName,
      });
      const existingOverride = await backend.findOverride({
        appId: app.id,
        flagId: flag.id,
        userId: input.userId,
      });

      if (existingOverride) {
        const result = await backend.updateOverride(
          app.id,
          existingOverride.id,
          {
            value: input.value,
          }
        );

        return {
          action: "updated" as const,
          app,
          flag,
          override: result.override,
        };
      }

      const result = await backend.createOverride(app.id, {
        flagId: flag.id,
        userId: input.userId,
        value: input.value,
      });

      return {
        action: "created" as const,
        app,
        flag,
        override: result.override,
      };
    }
  );

  registerWriteTool(
    server,
    "delete_flag_override",
    "Delete a flag override after explicit user approval.",
    appRefSchema
      .extend({
        overrideId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        approval: writeApprovalSchema,
      })
      .merge(
        z.object({
          flagId: z.string().uuid().optional(),
          flagName: z
            .string()
            .regex(/^[a-z]+(?:_[a-z]+)*$/, {
              message: "flagName must use snake_case",
            })
            .optional(),
        })
      ),
    {
      destructiveHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);

      if (input.overrideId) {
        return backend.deleteOverride(app.id, input.overrideId);
      }

      if (!(input.userId && (input.flagId || input.flagName))) {
        throw new Error(
          "Provide overrideId, or provide userId plus flagId/flagName to delete an override."
        );
      }

      const flag = await backend.resolveFlag({
        app,
        flagId: input.flagId,
        flagName: input.flagName,
      });
      const existingOverride = await backend.findOverride({
        appId: app.id,
        flagId: flag.id,
        userId: input.userId,
      });

      if (!existingOverride) {
        throw new Error(
          "No matching override was found for that flag/user pair."
        );
      }

      return backend.deleteOverride(app.id, existingOverride.id);
    }
  );
}
