import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppBindings } from "./types.js";

type UntypedOpenApi = (
  route: unknown,
  handler: (context: Context<AppBindings>) => Response | Promise<Response>
) => unknown;

export function getUntypedOpenApi(app: OpenAPIHono<AppBindings>) {
  return app.openapi.bind(app) as unknown as UntypedOpenApi;
}
