import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { devOverrides, featureFlags, flagOverrides } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  evaluateRequestSchema,
  evaluateResponseSchema,
} from "../lib/contracts.js";
import { evaluateFlagValue } from "../lib/evaluate.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import { validateCallerUrl } from "../lib/sdk-auth.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const evaluateRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/evaluate",
  tags: ["Evaluation"],
  summary: "Evaluate feature flags for an app",
  description:
    "Rules act as boolean targeting gates. For non-boolean flags, matched rules are surfaced as metadata while the configured default value is returned unless a user override exists.",
  security: [{ apiKeyAuth: [] }, { basicAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: evaluateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(evaluateResponseSchema, "Evaluation results"),
    ...defaultErrorResponses(),
  },
});

export function registerEvaluateRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(evaluateRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, evaluateRequestSchema);

    const credential = c.get("sdkCredential");
    const isDevToken =
      credential.kind === "apiKey" && credential.isDevEnvironment;
    const addressMatched = await validateCallerUrl(c, params.appId, body.url);

    const flags = await db
      .select()
      .from(featureFlags)
      .where(
        and(
          eq(featureFlags.appId, params.appId),
          ...(body.flagNames
            ? [inArray(featureFlags.name, body.flagNames)]
            : [])
        )
      )
      .orderBy(asc(featureFlags.name));

    if (flags.length === 0) {
      return jsonSuccess(c, {
        appId: params.appId,
        evaluatedAt: new Date().toISOString(),
        addressMatched,
        evaluations: {},
      });
    }

    let overrides: (typeof flagOverrides.$inferSelect)[] = [];
    if (body.userId !== undefined) {
      let overridesActive = false;

      if (isDevToken) {
        // Dev tokens always apply the user's flag overrides
        overridesActive = true;
      } else {
        // Non-dev tokens only apply overrides when the token's environment is
        // in the user's dev-override enrollment set
        const environmentId =
          credential.kind === "apiKey" ? credential.environmentId : null;

        if (environmentId !== null) {
          const devOverride = await db.query.devOverrides.findFirst({
            where: and(
              eq(devOverrides.userId, body.userId),
              eq(devOverrides.appId, params.appId)
            ),
          });
          overridesActive =
            devOverride?.environments.includes(environmentId) ?? false;
        }
      }

      if (overridesActive) {
        overrides = await db
          .select()
          .from(flagOverrides)
          .where(
            and(
              eq(flagOverrides.appId, params.appId),
              eq(flagOverrides.userId, body.userId),
              inArray(
                flagOverrides.flagId,
                flags.map((flag) => flag.id)
              )
            )
          );
      }
    }

    const overrideByFlagId = new Map(
      overrides.map((override) => [override.flagId, override])
    );
    const evaluations = Object.fromEntries(
      flags.map((flag) => {
        const result = evaluateFlagValue({
          config: flag.config,
          overrideValue: overrideByFlagId.get(flag.id)?.value,
          attributes: body.attributes,
        });

        return [
          flag.name,
          {
            id: flag.id,
            name: flag.name,
            type: flag.config.type,
            value: result.value,
            source: result.source,
            ruleMatched: result.ruleMatched,
            matchedRule: result.matchedRule,
          },
        ];
      })
    );

    return jsonSuccess(c, {
      appId: params.appId,
      evaluatedAt: new Date().toISOString(),
      addressMatched,
      evaluations,
    });
  });
}
