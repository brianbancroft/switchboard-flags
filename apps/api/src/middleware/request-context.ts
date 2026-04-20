import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../lib/types.js";

function getClientIp(c: Context<AppBindings>) {
  const forwardedFor = c.req.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return c.req.header("x-real-ip") ?? "unknown";
}

export const requestContextMiddleware = createMiddleware<AppBindings>(
  async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    const startedAt = performance.now();
    await next();
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    console.info(
      JSON.stringify({
        level:
          c.res.status >= 500 ? "error" : c.res.status >= 400 ? "warn" : "info",
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
        ip: getClientIp(c),
      })
    );
  }
);
