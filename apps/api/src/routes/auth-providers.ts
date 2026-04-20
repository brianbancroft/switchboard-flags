import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import {
  defaultErrorResponses,
  jsonSuccess,
  successResponse,
} from "../lib/api.js";
import { getAuthConfig, getPublicAuthConfig } from "../lib/app-config.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import type { AppBindings } from "../lib/types.js";

const authProvidersResponseSchema = z.object({
  passwordEnabled: z.boolean(),
  githubEnabled: z.boolean(),
  googleEnabled: z.boolean(),
  appleEnabled: z.boolean(),
  metaEnabled: z.boolean(),
  oidcEnabled: z.boolean(),
  oidcProviders: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
    })
  ),
});

const authProvidersRoute = createRoute({
  method: "get",
  path: "/api/auth-providers",
  tags: ["Auth"],
  summary: "Get enabled authentication providers",
  responses: {
    200: successResponse(authProvidersResponseSchema, "Enabled auth providers"),
    ...defaultErrorResponses(),
  },
});

export function registerAuthProvidersRoute(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(authProvidersRoute, async (c) => {
    const config = await getAuthConfig();
    return jsonSuccess(c, getPublicAuthConfig(config));
  });
}
