import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appMembers, users } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import {
  appMemberSchema,
  environmentMemberCreateInputSchema,
  environmentMemberUpdateInputSchema,
  serializeAppMember,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import {
  assertAppPermission,
  assertCanManageMemberRole,
} from "../lib/permissions.js";
import type { AppBindings } from "../lib/types.js";

const paramsSchema = z.object({
  appId: z.string().uuid(),
});

const memberParamsSchema = paramsSchema.extend({
  memberId: z.string().uuid(),
});

const listMembersDataSchema = z.object({
  members: z.array(appMemberSchema),
});

const memberDataSchema = z.object({
  member: appMemberSchema,
});

const deleteMemberDataSchema = z.object({
  deleted: z.literal(true),
});

const listMembersRoute = createRoute({
  method: "get",
  path: "/api/v1/apps/{appId}/members",
  tags: ["App Members"],
  summary: "List app members",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
  },
  responses: {
    200: successResponse(listMembersDataSchema, "App members"),
    ...defaultErrorResponses(),
  },
});

const createMemberRoute = createRoute({
  method: "post",
  path: "/api/v1/apps/{appId}/members",
  tags: ["App Members"],
  summary: "Add an app member",
  security: [{ bearerAuth: [] }],
  request: {
    params: paramsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: environmentMemberCreateInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(memberDataSchema, "App member added"),
    ...defaultErrorResponses(),
  },
});

const updateMemberRoute = createRoute({
  method: "patch",
  path: "/api/v1/apps/{appId}/members/{memberId}",
  tags: ["App Members"],
  summary: "Update an app member role",
  security: [{ bearerAuth: [] }],
  request: {
    params: memberParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: environmentMemberUpdateInputSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse(memberDataSchema, "App member updated"),
    ...defaultErrorResponses(),
  },
});

const deleteMemberRoute = createRoute({
  method: "delete",
  path: "/api/v1/apps/{appId}/members/{memberId}",
  tags: ["App Members"],
  summary: "Remove an app member",
  security: [{ bearerAuth: [] }],
  request: {
    params: memberParamsSchema,
  },
  responses: {
    200: successResponse(deleteMemberDataSchema, "App member removed"),
    ...defaultErrorResponses(),
  },
});

async function getMemberOrThrow(appId: string, memberId: string) {
  const row = await db
    .select({
      member: appMembers,
      user: users,
    })
    .from(appMembers)
    .innerJoin(users, eq(users.id, appMembers.userId))
    .where(and(eq(appMembers.appId, appId), eq(appMembers.id, memberId)))
    .limit(1);

  const result = row[0];

  if (!result) {
    throw new AppError(404, "APP_MEMBER_NOT_FOUND", "App member not found");
  }

  return result;
}

async function getUserOrThrow(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return user;
}

function assertNotOwnerMember(
  ownerId: string,
  targetUserId: string,
  message: string
) {
  if (ownerId === targetUserId) {
    throw new AppError(400, "OWNER_MEMBERSHIP_LOCKED", message);
  }
}

export function registerEnvironmentMemberRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listMembersRoute, async (c) => {
    assertAppPermission(c.get("appAccess"), "developer");
    const params = paramsSchema.parse(c.req.param());

    const rows = await db
      .select({
        member: appMembers,
        user: users,
      })
      .from(appMembers)
      .innerJoin(users, eq(users.id, appMembers.userId))
      .where(eq(appMembers.appId, params.appId))
      .orderBy(asc(users.email));

    return jsonSuccess(c, {
      members: rows.map(({ member, user }) => serializeAppMember(member, user)),
    });
  });

  openapi(createMemberRoute, async (c) => {
    const params = paramsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, environmentMemberCreateInputSchema);

    assertCanManageMemberRole(c.get("appAccess"), body.role);
    const user = await getUserOrThrow(body.userId);

    const [member] = await db
      .insert(appMembers)
      .values({
        appId: params.appId,
        userId: body.userId,
        role: body.role,
      })
      .returning();

    if (!member) {
      throw new Error("App member insert returned no row");
    }

    return jsonSuccess(
      c,
      {
        member: serializeAppMember(member, user),
      },
      201
    );
  });

  openapi(updateMemberRoute, async (c) => {
    const params = memberParamsSchema.parse(c.req.param());
    const body = await parseJsonBody(c, environmentMemberUpdateInputSchema);
    const { member, user } = await getMemberOrThrow(
      params.appId,
      params.memberId
    );

    assertNotOwnerMember(
      c.get("appAccess").app.ownerId,
      member.userId,
      "The app owner cannot be downgraded"
    );
    assertCanManageMemberRole(c.get("appAccess"), body.role);

    const [updatedMember] = await db
      .update(appMembers)
      .set({
        role: body.role,
      })
      .where(
        and(
          eq(appMembers.appId, params.appId),
          eq(appMembers.id, params.memberId)
        )
      )
      .returning();

    if (!updatedMember) {
      throw new Error("App member update returned no row");
    }

    return jsonSuccess(c, {
      member: serializeAppMember(updatedMember, user),
    });
  });

  openapi(deleteMemberRoute, async (c) => {
    const params = memberParamsSchema.parse(c.req.param());
    const { member } = await getMemberOrThrow(params.appId, params.memberId);

    assertNotOwnerMember(
      c.get("appAccess").app.ownerId,
      member.userId,
      "The app owner cannot be removed"
    );
    assertCanManageMemberRole(c.get("appAccess"), member.role);

    await db
      .delete(appMembers)
      .where(
        and(
          eq(appMembers.appId, params.appId),
          eq(appMembers.id, params.memberId)
        )
      );

    return jsonSuccess(c, {
      deleted: true as const,
    });
  });
}
