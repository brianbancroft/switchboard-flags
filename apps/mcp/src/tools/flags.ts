import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerReadTool, registerWriteTool } from "../lib/register.js";
import {
  featureFlagConfigSchema,
  flagRefSchema,
  writeApprovalSchema,
} from "../lib/schemas.js";

export function registerFlagTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "list_flags",
    "List feature flags for an app by id or exact name.",
    z.object({
      appId: z.string().uuid().optional(),
      appName: z.string().min(1).max(120).optional(),
    }),
    async (input) => {
      const app = await backend.resolveApp(input);
      const result = await backend.listFlags(app.id);
      return {
        app,
        flags: result.flags,
      };
    }
  );

  registerReadTool(
    server,
    "get_flag",
    "Get one feature flag by app + flag id or name.",
    flagRefSchema,
    async (input) => {
      const app = await backend.resolveApp(input);
      const flag = await backend.resolveFlag({
        app,
        flagId: input.flagId,
        flagName: input.flagName,
      });

      return {
        app,
        flag,
      };
    }
  );

  registerWriteTool(
    server,
    "create_flag",
    "Create a feature flag after explicit user approval. Flag names must use lowercase snake_case.",
    z.object({
      appId: z.string().uuid().optional(),
      appName: z.string().min(1).max(120).optional(),
      name: z.string().regex(/^[a-z]+(?:_[a-z]+)*$/, {
        message: "name must use snake_case",
      }),
      description: z.string().min(1).max(500).nullable().optional(),
      config: featureFlagConfigSchema,
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: false,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      return backend.createFlag(app.id, {
        name: input.name,
        description: input.description ?? null,
        config: input.config,
      });
    }
  );

  registerWriteTool(
    server,
    "update_flag",
    "Update a feature flag after explicit user approval.",
    flagRefSchema.extend({
      name: z
        .string()
        .regex(/^[a-z]+(?:_[a-z]+)*$/, {
          message: "name must use snake_case",
        })
        .optional(),
      description: z.string().min(1).max(500).nullable().optional(),
      config: featureFlagConfigSchema.optional(),
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

      return backend.updateFlag(app.id, flag.id, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.config === undefined ? {} : { config: input.config }),
      });
    }
  );

  registerWriteTool(
    server,
    "delete_flag",
    "Delete a feature flag after explicit user approval.",
    flagRefSchema.extend({
      approval: writeApprovalSchema,
    }),
    {
      destructiveHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      const flag = await backend.resolveFlag({
        app,
        flagId: input.flagId,
        flagName: input.flagName,
      });

      return backend.deleteFlag(app.id, flag.id);
    }
  );
}
