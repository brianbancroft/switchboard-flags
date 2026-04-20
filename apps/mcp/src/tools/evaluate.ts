import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SwitchboardBackend } from "../lib/backend.js";
import { evaluateFlagValue } from "../lib/evaluate.js";
import { registerReadTool } from "../lib/register.js";
import { appRefSchema, jsonValueSchema } from "../lib/schemas.js";

const evaluateBaseSchema = appRefSchema.extend({
  userId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  attributes: z.record(z.string(), jsonValueSchema).default({}),
  sdkApiKey: z.string().min(1).optional(),
});

export function registerEvaluateTools(
  server: McpServer,
  backend: SwitchboardBackend
) {
  registerReadTool(
    server,
    "evaluate_flags",
    "Call the Switchboard evaluate endpoint for one app. Provide sdkApiKey explicitly, or configure defaults in the MCP server environment.",
    evaluateBaseSchema.extend({
      flagNames: z
        .array(
          z.string().regex(/^[a-z]+(?:_[a-z]+)*$/, {
            message: "flag names must use snake_case",
          })
        )
        .min(1)
        .max(200)
        .optional(),
    }),
    async (input) => {
      const app = await backend.resolveApp(input);
      const auth = backend.resolveEvaluateAuth({
        app,
        sdkApiKey: input.sdkApiKey,
      });

      if (!auth) {
        throw new Error(
          "No evaluate credential is available for this app. Provide sdkApiKey, or configure SWITCHBOARD_EVALUATE_API_KEYS_JSON."
        );
      }

      const evaluation = await backend.evaluateApp(
        app.id,
        {
          flagNames: input.flagNames,
          userId: input.userId,
          url: input.url,
          attributes: input.attributes,
        },
        auth
      );

      return {
        app,
        evaluation,
        mode: "evaluate-endpoint" as const,
      };
    }
  );

  registerReadTool(
    server,
    "get_flag_value",
    "Get the current effective value of one flag for one app and optional user/context. Uses the evaluate endpoint when credentials are available and falls back to safe read-only reconstruction otherwise.",
    evaluateBaseSchema.extend({
      flagName: z.string().regex(/^[a-z]+(?:_[a-z]+)*$/, {
        message: "flagName must use snake_case",
      }),
    }),
    async (input) => {
      const app = await backend.resolveApp(input);
      const auth = backend.resolveEvaluateAuth({
        app,
        sdkApiKey: input.sdkApiKey,
      });

      if (auth) {
        const evaluation = await backend.evaluateApp(
          app.id,
          {
            flagNames: [input.flagName],
            userId: input.userId,
            url: input.url,
            attributes: input.attributes,
          },
          auth
        );

        const flag = evaluation.evaluations[input.flagName];

        if (!flag) {
          throw new Error(
            `Flag "${input.flagName}" was not returned by the evaluate endpoint.`
          );
        }

        return {
          app,
          mode: "evaluate-endpoint" as const,
          value: flag.value,
          evaluation: flag,
        };
      }

      const flag = await backend.resolveFlag({
        app,
        flagName: input.flagName,
      });
      const override = input.userId
        ? await backend.findOverride({
            appId: app.id,
            flagId: flag.id,
            userId: input.userId,
          })
        : null;
      const result = evaluateFlagValue({
        config: flag.config,
        overrideValue: override?.value,
        attributes: input.attributes,
      });

      return {
        app,
        mode: "mcp-readonly-fallback" as const,
        fallbackReason:
          "No SDK credential was configured for the evaluate endpoint, so the MCP server reconstructed the value from flags and overrides via read-only API calls.",
        value: result.value,
        evaluation: {
          id: flag.id,
          name: flag.name,
          type: flag.config.type,
          value: result.value,
          source: result.source,
          ruleMatched: result.ruleMatched,
          matchedRule: result.matchedRule,
        },
      };
    }
  );
}
