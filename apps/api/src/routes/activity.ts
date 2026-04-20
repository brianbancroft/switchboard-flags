import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { flagAuditLog, users } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  successResponse,
} from "../lib/api.js";
import {
  flagAuditLogEntrySchema,
  serializeFlagAuditLogEntry,
} from "../lib/contracts.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const listActivityDataSchema = z.object({
  entries: z.array(flagAuditLogEntrySchema),
});

const listActivityRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/activity",
  tags: ["Apps"],
  summary: "List activity log for an app",
  security: [{ bearerAuth: [] }],
  request: { params: paramsSchema },
  responses: {
    200: successResponse(listActivityDataSchema, "App activity log"),
    ...defaultErrorResponses(),
  },
});

export function registerActivityRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listActivityRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());

    const entries = await db
      .select()
      .from(flagAuditLog)
      .where(eq(flagAuditLog.appId, params.appId))
      .orderBy(desc(flagAuditLog.changedAt))
      .limit(200);

    const userIds = [
      ...new Set(
        entries.map((e) => e.changedByUserId).filter(Boolean) as string[]
      ),
    ];
    const userMap = new Map<
      string,
      { id: string; name: string | null; email: string }
    >();
    if (userIds.length > 0) {
      const fetched = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of fetched) userMap.set(u.id, u);
    }

    return jsonSuccess(c, {
      entries: entries.map((e) =>
        serializeFlagAuditLogEntry(
          e,
          e.changedByUserId ? (userMap.get(e.changedByUserId) ?? null) : null
        )
      ),
    });
  });
}
