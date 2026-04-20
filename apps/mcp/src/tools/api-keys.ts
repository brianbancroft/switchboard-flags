import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerReadTool, registerWriteTool } from "../lib/register.js";
import {
  apiKeyScopeSchema,
  appRefSchema,
  writeApprovalSchema,
} from "../lib/schemas.js";

export function registerApiKeyTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "list_api_keys",
    "List API keys for an app. Plaintext key values are never returned except at creation time.",
    appRefSchema,
    async (input) => {
      const app = await backend.resolveApp(input);
      const result = await backend.listApiKeys(app.id);
      return {
        app,
        apiKeys: result.apiKeys,
      };
    }
  );

  registerWriteTool(
    server,
    "create_api_key",
    "Create an app API key after explicit user approval.",
    appRefSchema.extend({
      description: z.string().min(1).max(500).nullable().optional(),
      scopes: z.array(apiKeyScopeSchema).min(1),
      expiresAt: z.string().datetime().nullable().optional(),
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: false,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      return backend.createApiKey(app.id, {
        description: input.description ?? null,
        scopes: input.scopes,
        expiresAt: input.expiresAt ?? null,
      });
    }
  );

  registerWriteTool(
    server,
    "delete_api_key",
    "Delete an app API key after explicit user approval.",
    appRefSchema.extend({
      apiKeyId: z.string().uuid(),
      approval: writeApprovalSchema,
    }),
    {
      destructiveHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      await backend.resolveApiKey({
        appId: app.id,
        apiKeyId: input.apiKeyId,
      });
      return backend.deleteApiKey(app.id, input.apiKeyId);
    }
  );
}
