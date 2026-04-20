import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerReadTool, registerWriteTool } from "../lib/register.js";
import {
  appAddressSchema,
  appRefSchema,
  writeApprovalSchema,
} from "../lib/schemas.js";

export function registerEnvironmentTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "list_apps",
    "List apps visible to the configured Switchboard user context.",
    z.object({}),
    async () => {
      const apps = await backend.listApps();
      return { apps };
    }
  );

  registerReadTool(
    server,
    "get_app",
    "Get one app by id or exact name, including permission hints returned by the API.",
    appRefSchema,
    async (input) => {
      const app = await backend.resolveApp(input);
      return { app };
    }
  );

  registerWriteTool(
    server,
    "create_app",
    "Create a new app. Only call this after the user explicitly approved the write.",
    z.object({
      name: z.string().min(1).max(120),
      description: z.string().min(1).max(500).nullable().optional(),
      stagingAddress: appAddressSchema.nullable().optional(),
      nightlyAddress: appAddressSchema.nullable().optional(),
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: false,
    },
    async (input) =>
      backend.createApp({
        name: input.name,
        description: input.description ?? null,
        stagingAddress: input.stagingAddress ?? null,
        nightlyAddress: input.nightlyAddress ?? null,
      })
  );

  registerWriteTool(
    server,
    "update_app",
    "Update app metadata. Only call this after the user explicitly approved the write.",
    appRefSchema.extend({
      name: z.string().min(1).max(120).optional(),
      description: z.string().min(1).max(500).nullable().optional(),
      stagingAddress: appAddressSchema.nullable().optional(),
      nightlyAddress: appAddressSchema.nullable().optional(),
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      return backend.updateApp(app.id, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
        ...(input.stagingAddress === undefined
          ? {}
          : { stagingAddress: input.stagingAddress }),
        ...(input.nightlyAddress === undefined
          ? {}
          : { nightlyAddress: input.nightlyAddress }),
      });
    }
  );

  registerWriteTool(
    server,
    "delete_app",
    "Delete an app. This is destructive and should only be called after explicit user approval.",
    appRefSchema.extend({
      approval: writeApprovalSchema,
    }),
    {
      destructiveHint: true,
      idempotentHint: false,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      return backend.deleteApp(app.id);
    }
  );
}
