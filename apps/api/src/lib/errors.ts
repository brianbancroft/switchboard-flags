import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { jsonError } from "./api.js";
import type { AppBindings } from "./types.js";

type JsonDetails =
  | null
  | boolean
  | number
  | string
  | JsonDetails[]
  | { [key: string]: JsonDetails };

export class AppError extends Error {
  status: number;
  code: string;
  details?: JsonDetails;
  headers?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: {
      details?: JsonDetails;
      headers?: Record<string, string>;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.headers = options?.headers;
  }
}

function isDatabaseError(
  error: unknown
): error is { code: string; detail?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

function isConflictErrorCode(code: string) {
  return code === "23505";
}

function isConstraintErrorCode(code: string) {
  return (
    code === "23503" || code === "23514" || code === "23502" || code === "22P02"
  );
}

export function handleError(error: unknown, c: Context<AppBindings>) {
  if (error instanceof AppError) {
    if (error.headers) {
      for (const [name, value] of Object.entries(error.headers)) {
        c.header(name, value);
      }
    }

    return jsonError(
      c,
      error.status as ContentfulStatusCode,
      error.code,
      error.message,
      error.details
    );
  }

  if (error instanceof ZodError) {
    return jsonError(
      c,
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      error.issues.map((issue) => ({
        path: issue.path.map((segment) =>
          typeof segment === "number" ? segment : String(segment)
        ),
        code: issue.code,
        message: issue.message,
      }))
    );
  }

  if (isDatabaseError(error) && isConflictErrorCode(error.code)) {
    return jsonError(
      c,
      409,
      "CONFLICT",
      error.detail ?? "The requested change conflicts with an existing record"
    );
  }

  if (isDatabaseError(error) && isConstraintErrorCode(error.code)) {
    return jsonError(
      c,
      400,
      "DATABASE_CONSTRAINT",
      error.detail ?? "The request violates a database constraint"
    );
  }

  const message =
    error instanceof Error ? error.message : "Unknown server error";

  console.error(
    JSON.stringify({
      level: "error",
      requestId: c.get("requestId"),
      path: c.req.path,
      method: c.req.method,
      message,
      error,
    })
  );

  return jsonError(c, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
}
