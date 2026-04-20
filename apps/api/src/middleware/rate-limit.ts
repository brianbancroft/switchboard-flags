import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/errors.js";
import type { AppBindings } from "../lib/types.js";

type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${getClientIp(c.req.raw)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
    } else if (current.count >= options.maxRequests) {
      c.header("x-ratelimit-limit", String(options.maxRequests));
      c.header("x-ratelimit-remaining", "0");
      c.header("x-ratelimit-reset", String(current.resetAt));

      throw new AppError(429, "RATE_LIMITED", "Too many requests");
    } else {
      current.count += 1;
    }

    const bucket = buckets.get(key);

    if (bucket) {
      c.header("x-ratelimit-limit", String(options.maxRequests));
      c.header(
        "x-ratelimit-remaining",
        String(options.maxRequests - bucket.count)
      );
      c.header("x-ratelimit-reset", String(bucket.resetAt));
    }

    await next();

    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets.entries()) {
        if (value.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }
  });
}
