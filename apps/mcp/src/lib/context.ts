import { AsyncLocalStorage } from "node:async_hooks";
import type { SwitchboardManagementAuth, SwitchboardSessionUser } from "@repo/api-sdk";

export type McpUserContext = {
  auth: SwitchboardManagementAuth;
  user: SwitchboardSessionUser | null;
};

const storage = new AsyncLocalStorage<McpUserContext>();

export function runWithUserContext<T>(ctx: McpUserContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getUserContext(): McpUserContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "No user context available — request must run inside runWithUserContext"
    );
  }
  return ctx;
}

export function tryGetUserContext(): McpUserContext | undefined {
  return storage.getStore();
}
