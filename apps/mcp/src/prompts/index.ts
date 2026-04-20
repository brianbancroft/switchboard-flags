import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "safe_flag_rollout",
    {
      title: "Safe Flag Rollout",
      description:
        "Guidance prompt for creating or updating a feature flag without risky rollout behavior.",
      argsSchema: {
        appName: z.string().optional(),
        flagName: z.string().optional(),
      },
    },
    async ({ appName, flagName }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Help me plan a safe feature-flag rollout in Switchboard.",
              appName
                ? `Target app: ${appName}`
                : "Target app: determine it first.",
              flagName
                ? `Candidate flag: ${flagName}`
                : "Candidate flag: propose a lowercase snake_case name if needed.",
              "Before suggesting writes:",
              "1. Read the current_feature_flags resource or list_flags for the app.",
              "2. Confirm the flag name follows lowercase snake_case.",
              "3. Recommend a safe defaultValue first.",
              "4. Prefer narrow client or attribute targeting before broad rollout.",
              "5. Ask for explicit user approval before create/update/delete actions.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "debug_flag_evaluation",
    {
      title: "Debug Flag Evaluation",
      description:
        "Prompt for investigating why a flag resolves to a specific value for a user or client context.",
      argsSchema: {
        appName: z.string().optional(),
        flagName: z.string(),
        userId: z.string().optional(),
      },
    },
    async ({ appName, flagName, userId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Debug a Switchboard feature-flag evaluation.",
              appName ? `App: ${appName}` : "App: determine it first.",
              `Flag: ${flagName}`,
              userId
                ? `User override target: ${userId}`
                : "User override target: none provided.",
              "Recommended workflow:",
              "1. Read current_feature_flags or list_flags for the app.",
              "2. Check list_flag_overrides for the relevant user and flag.",
              "3. Use evaluate_flags when SDK credentials are available.",
              "4. Explain whether the value came from default, rule, or override.",
              "5. If proposing any write action, ask for explicit approval first.",
            ].join("\n"),
          },
        },
      ],
    })
  );
}
