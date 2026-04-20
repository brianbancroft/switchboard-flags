import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodTypeAny } from "zod";
import { jsonValueSchema } from "./contracts.js";
import { AppError } from "./errors.js";
import type { AppBindings } from "./types.js";

export const responseMetaSchema = z.object({
  requestId: z.string(),
});

export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: jsonValueSchema.optional(),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: errorSchema,
  meta: responseMetaSchema,
});

export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T
) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: responseMetaSchema,
  });
}

export function successResponse<T extends z.ZodTypeAny>(
  dataSchema: T,
  description: string
) {
  return {
    description,
    content: {
      "application/json": {
        schema: createSuccessResponseSchema(dataSchema),
      },
    },
  };
}

export function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: errorResponseSchema,
      },
    },
  };
}

export function defaultErrorResponses(
  extra: Partial<Record<number, string>> = {}
) {
  return {
    400: errorResponse("Bad request"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Not found"),
    409: errorResponse("Conflict"),
    429: errorResponse("Rate limit exceeded"),
    500: errorResponse("Internal server error"),
    ...Object.fromEntries(
      Object.entries(extra).map(([status, description]) => [
        Number(status),
        errorResponse(description ?? "Unexpected error"),
      ])
    ),
  };
}

export function jsonSuccess<T, TStatus extends ContentfulStatusCode = 200>(
  c: Context<AppBindings>,
  data: T,
  status?: TStatus
) {
  const responseStatus = (status ?? 200) as TStatus;

  return c.json(
    {
      success: true as const,
      data,
      meta: {
        requestId: c.get("requestId") ?? "unknown",
      },
    },
    responseStatus
  );
}

export function jsonError<TStatus extends ContentfulStatusCode = 500>(
  c: Context<AppBindings>,
  status: TStatus,
  code: string,
  message: string,
  details?: unknown
) {
  return c.json(
    {
      success: false as const,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
      meta: {
        requestId: c.get("requestId") ?? "unknown",
      },
    },
    status
  );
}

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  c: Context<AppBindings>,
  schema: TSchema
) {
  let payload: unknown;

  try {
    payload = await c.req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  return schema.parse(payload);
}
