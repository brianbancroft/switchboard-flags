import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerReadTool, registerWriteTool } from "../lib/register.js";
import {
  appRefSchema,
  appRoleSchema,
  writeApprovalSchema,
} from "../lib/schemas.js";

const memberRefSchema = appRefSchema
  .extend({
    memberId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.memberId || value.userId), {
    message: "Provide memberId or userId",
    path: ["userId"],
  });

export function registerEnvironmentMemberTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "list_app_members",
    "List the members of an app.",
    appRefSchema,
    async (input) => {
      const app = await backend.resolveApp(input);
      const result = await backend.listMembers(app.id);
      return {
        app,
        members: result.members,
      };
    }
  );

  registerWriteTool(
    server,
    "add_app_member",
    "Add an existing user to an app after explicit user approval.",
    appRefSchema.extend({
      userId: z.string().uuid(),
      role: appRoleSchema,
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: false,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      return backend.createMember(app.id, {
        userId: input.userId,
        role: input.role,
      });
    }
  );

  registerWriteTool(
    server,
    "update_app_member",
    "Update an app member role after explicit user approval.",
    memberRefSchema.extend({
      role: appRoleSchema,
      approval: writeApprovalSchema,
    }),
    {
      idempotentHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      const member = await backend.resolveMember({
        app,
        memberId: input.memberId,
        userId: input.userId,
      });
      return backend.updateMember(app.id, member.id, {
        role: input.role,
      });
    }
  );

  registerWriteTool(
    server,
    "remove_app_member",
    "Remove an app member after explicit user approval.",
    memberRefSchema.extend({
      approval: writeApprovalSchema,
    }),
    {
      destructiveHint: true,
    },
    async (input) => {
      const app = await backend.resolveApp(input);
      const member = await backend.resolveMember({
        app,
        memberId: input.memberId,
        userId: input.userId,
      });
      return backend.deleteMember(app.id, member.id);
    }
  );
}
