import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import {
  defaultErrorResponses,
  jsonSuccess,
  parseJsonBody,
  successResponse,
} from "../lib/api.js";
import { getAuth } from "../lib/auth.js";
import {
  inviteUserInputSchema,
  serializeUser,
  userSchema,
} from "../lib/contracts.js";
import { AppError } from "../lib/errors.js";
import { getUntypedOpenApi } from "../lib/openapi.js";
import type { AppBindings } from "../lib/types.js";

const listUsersDataSchema = z.object({
  users: z.array(userSchema),
});

const userDataSchema = z.object({
  user: userSchema,
});

const listUsersRoute = createRoute({
  method: "get",
  path: "/api/v1/users",
  tags: ["Users"],
  summary: "List all users",
  security: [{ bearerAuth: [] }],
  responses: {
    200: successResponse(listUsersDataSchema, "All users"),
    ...defaultErrorResponses(),
  },
});

const inviteUserRoute = createRoute({
  method: "post",
  path: "/api/v1/users/invite",
  tags: ["Users"],
  summary: "Invite a user by email",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: inviteUserInputSchema,
        },
      },
    },
  },
  responses: {
    201: successResponse(userDataSchema, "User invited"),
    ...defaultErrorResponses(),
  },
});

export function registerUserRoutes(app: OpenAPIHono<AppBindings>) {
  const openapi = getUntypedOpenApi(app);

  openapi(listUsersRoute, async (c) => {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt));

    return jsonSuccess(c, { users: allUsers.map(serializeUser) });
  });

  openapi(inviteUserRoute, async (c) => {
    const body = await parseJsonBody(c, inviteUserInputSchema);

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existing) {
      throw new AppError(
        409,
        "EMAIL_EXISTS",
        "A user with this email already exists"
      );
    }

    const response = await getAuth().api.signUpEmail({
      body: {
        email: body.email,
        name: body.email,
        password: crypto.randomUUID(),
      },
    });

    const result = response as { user?: { id: string } };
    if (!result?.user?.id) {
      throw new AppError(500, "INVITE_FAILED", "Failed to create user");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, result.user.id))
      .limit(1);

    if (!user) {
      throw new AppError(500, "INVITE_FAILED", "Failed to create user");
    }

    return jsonSuccess(c, { user: serializeUser(user) }, 201);
  });
}
