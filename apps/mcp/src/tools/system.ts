import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { tryGetUserContext } from "../lib/context.js";
import { registerReadTool } from "../lib/register.js";

export function registerSystemTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "who_am_i",
    "Return the authenticated user's identity. Use this to confirm which Switchboard user the MCP session is operating as.",
    z.object({}),
    async () => {
      const ctx = tryGetUserContext();

      if (ctx?.user) {
        return {
          authenticated: true,
          authMethod: ctx.auth.kind,
          user: {
            id: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.name,
            image: ctx.user.image,
          },
        };
      }

      const sessionUser = await backend.getSession();
      if (sessionUser) {
        return {
          authenticated: true,
          authMethod: ctx?.auth.kind ?? "unknown",
          user: {
            id: sessionUser.id,
            email: sessionUser.email,
            name: sessionUser.name,
            image: sessionUser.image,
          },
        };
      }

      if (ctx?.auth.kind === "ui-user-id") {
        return {
          authenticated: true,
          authMethod: "ui-user-id",
          user: {
            id: ctx.auth.userId,
            note: "Authenticated via static user ID header. User details not resolved.",
          },
        };
      }

      return {
        authenticated: false,
        message:
          "No authenticated user context. Provide a better-auth session token as a Bearer token.",
      };
    }
  );

  registerReadTool(
    server,
    "get_switchboard_health",
    "Check whether the Switchboard Hono API is responding.",
    z.object({}),
    async () => backend.getHealth()
  );

  registerReadTool(
    server,
    "get_switchboard_database_health",
    "Check database connectivity through the Switchboard API boundary.",
    z.object({}),
    async () => backend.getDatabaseHealth()
  );
}
