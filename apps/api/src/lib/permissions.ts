import { and, asc, eq, or } from "drizzle-orm";
import { db } from "../db/client.js";
import type { AppMember, User } from "../db/schema.js";
import { appMembers, apps } from "../db/schema.js";
import { AppError } from "./errors.js";

export type PermissionLevel = "developer" | "manager" | "admin";

export type AppAccess = {
  app: typeof apps.$inferSelect;
  membershipRole: AppMember["role"] | null;
  isOwner: boolean;
  isMegaAdmin: boolean;
};

/** @deprecated Use `AppAccess` */
export type EnvironmentAccess = AppAccess;

const roleRank: Record<PermissionLevel | AppMember["role"], number> = {
  developer: 1,
  manager: 2,
  admin: 3,
};

export function canAccessApp(
  access: AppAccess,
  requiredLevel: PermissionLevel
) {
  if (access.isMegaAdmin || access.isOwner) {
    return true;
  }

  if (!access.membershipRole) {
    return false;
  }

  return roleRank[access.membershipRole] >= roleRank[requiredLevel];
}

/** @deprecated Use `canAccessApp` */
export const canAccessEnvironment = canAccessApp;

export function assertAppPermission(
  access: AppAccess,
  requiredLevel: PermissionLevel
) {
  if (!canAccessApp(access, requiredLevel)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      `This action requires ${requiredLevel} access to the app`
    );
  }
}

/** @deprecated Use `assertAppPermission` */
export const assertEnvironmentPermission = assertAppPermission;

export function canManageMemberRole(
  access: AppAccess,
  targetRole: AppMember["role"]
) {
  if (access.isMegaAdmin || access.isOwner) {
    return true;
  }

  if (
    access.membershipRole !== "admin" &&
    access.membershipRole !== "manager"
  ) {
    return false;
  }

  if (access.membershipRole === "manager") {
    return targetRole !== "admin";
  }

  return true;
}

export function assertCanManageMemberRole(
  access: AppAccess,
  targetRole: AppMember["role"]
) {
  if (!canManageMemberRole(access, targetRole)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have permission to manage that membership role"
    );
  }
}

export function canManageOverrideForUser(
  access: AppAccess,
  targetUserId: string,
  currentUserId: string
) {
  if (access.isMegaAdmin || access.isOwner) {
    return true;
  }

  if (
    access.membershipRole === "admin" ||
    access.membershipRole === "manager"
  ) {
    return true;
  }

  return (
    access.membershipRole === "developer" && targetUserId === currentUserId
  );
}

export function assertCanManageOverrideForUser(
  access: AppAccess,
  targetUserId: string,
  currentUserId: string
) {
  if (!canManageOverrideForUser(access, targetUserId, currentUserId)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have permission to manage overrides for that user"
    );
  }
}

export async function loadAppAccess(
  appId: string,
  user: User
): Promise<AppAccess> {
  const [row] = await db
    .select({
      app: apps,
      membershipRole: appMembers.role,
    })
    .from(apps)
    .leftJoin(
      appMembers,
      and(eq(appMembers.appId, apps.id), eq(appMembers.userId, user.id))
    )
    .where(eq(apps.id, appId))
    .limit(1);

  if (!row) {
    throw new AppError(404, "APP_NOT_FOUND", "App not found");
  }

  const access: AppAccess = {
    app: row.app,
    membershipRole: row.membershipRole ?? null,
    isOwner: row.app.ownerId === user.id,
    isMegaAdmin: user.isMegaAdmin,
  };

  if (!canAccessApp(access, "developer")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this app");
  }

  return access;
}

/** @deprecated Use `loadAppAccess` */
export const loadEnvironmentAccess = loadAppAccess;

export async function listAccessibleApps(user: User) {
  if (user.isMegaAdmin) {
    return db
      .select({
        environment: apps,
        membershipRole: appMembers.role,
      })
      .from(apps)
      .leftJoin(
        appMembers,
        and(eq(appMembers.appId, apps.id), eq(appMembers.userId, user.id))
      )
      .orderBy(asc(apps.name));
  }

  return db
    .select({
      environment: apps,
      membershipRole: appMembers.role,
    })
    .from(apps)
    .leftJoin(
      appMembers,
      and(eq(appMembers.appId, apps.id), eq(appMembers.userId, user.id))
    )
    .where(or(eq(apps.ownerId, user.id), eq(appMembers.userId, user.id)))
    .orderBy(asc(apps.name));
}

/** @deprecated Use `listAccessibleApps` */
export const listAccessibleEnvironments = listAccessibleApps;
