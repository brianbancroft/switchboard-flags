import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createApp } from "./app.js";
import { db, pool } from "./db/client.js";
import { apiKeys, users } from "./db/schema.js";
import { hashSecret } from "./lib/security.js";

type App = Awaited<ReturnType<typeof createApp>>;

const booleanFlagConfig = {
  type: "boolean" as const,
  defaultValue: false,
  rules: [],
};

let app: App;

async function resetDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      "flag_overrides",
      "api_keys",
      "feature_flags",
      "app_members",
      "app_environments",
      "app_production_addresses",
      "apps",
      "sessions",
      "accounts",
      "verifications",
      "oidc_providers",
      "app_configuration",
      "users"
    RESTART IDENTITY CASCADE
  `);
}

async function createUser(emailPrefix: string) {
  const [user] = await db
    .insert(users)
    .values({
      email: `${emailPrefix}-${randomUUID()}@example.com`,
      name: emailPrefix,
      image: null,
      isMegaAdmin: false,
    })
    .returning();

  assert.ok(user);
  return user;
}

async function apiRequest(input: {
  path: string;
  method?: string;
  userId?: string;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const response = await app.request(input.path, {
    method: input.method ?? "GET",
    headers: {
      ...(input.userId ? { "x-switchboard-user-id": input.userId } : {}),
      ...(input.body ? { "content-type": "application/json" } : {}),
      ...input.headers,
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  return { response, payload };
}

test("app terminology refactor", async (t) => {
  app = await createApp();
  t.after(async () => {
    await resetDatabase();
    await pool.end();
  });

  await t.test(
    "app create/get/update embeds addresses and locks owner membership",
    async () => {
      await resetDatabase();
      const owner = await createUser("owner");

      const createResult = await apiRequest({
        path: "/api/v1/apps",
        method: "POST",
        userId: owner.id,
        body: {
          name: "switchboard-mobile",
          description: "Primary mobile app",
          environments: [
            {
              name: "production",
              address: "https://prod.switchboard.dev",
              enabled: true,
            },
            {
              name: "staging",
              address: "https://staging.switchboard.dev",
              enabled: false,
            },
            {
              name: "nightly",
              address: null,
              enabled: true,
            },
            {
              name: "qa",
              address: "https://qa.switchboard.dev",
              enabled: false,
            },
          ],
        },
      });

      assert.equal(createResult.response.status, 201);
      assert.equal(createResult.payload.success, true);

      const createdApp = (
        createResult.payload.data as { app: Record<string, unknown> }
      ).app;
      assert.equal(createdApp.name, "switchboard-mobile");
      assert.equal(
        (createdApp.productionAddresses as Array<unknown>).length,
        1
      );
      assert.equal((createdApp.environments as Array<unknown>).length, 4);
      assert.equal(createdApp.membershipRole, "admin");
      assert.equal(createdApp.isOwner, true);

      const appId = createdApp.id as string;

      const membersResult = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        userId: owner.id,
      });
      assert.equal(membersResult.response.status, 200);
      const ownerMember = (
        membersResult.payload.data as {
          members: Array<Record<string, unknown>>;
        }
      ).members[0];
      assert.ok(ownerMember);
      assert.equal(ownerMember.role, "admin");

      const ownerMemberId = ownerMember.id as string;

      const demoteOwner = await apiRequest({
        path: `/api/v1/apps/${appId}/members/${ownerMemberId}`,
        method: "PATCH",
        userId: owner.id,
        body: {
          role: "manager",
        },
      });
      assert.equal(demoteOwner.response.status, 400);

      const removeOwner = await apiRequest({
        path: `/api/v1/apps/${appId}/members/${ownerMemberId}`,
        method: "DELETE",
        userId: owner.id,
      });
      assert.equal(removeOwner.response.status, 400);

      const createProductionAddress = await apiRequest({
        path: `/api/v1/apps/${appId}/production-addresses`,
        method: "POST",
        userId: owner.id,
        body: {
          label: "us-east",
          address: "https://app.switchboard.dev",
        },
      });
      assert.equal(createProductionAddress.response.status, 201);

      const updateEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}`,
        method: "PATCH",
        userId: owner.id,
        body: {
          nightlyAddress: "https://nightly.switchboard.dev",
        },
      });
      assert.equal(updateEnvironment.response.status, 200);

      const getEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}`,
        userId: owner.id,
      });
      assert.equal(getEnvironment.response.status, 200);

      const appRecord = (
        getEnvironment.payload.data as { app: Record<string, unknown> }
      ).app;
      assert.equal(appRecord.stagingAddress, "https://staging.switchboard.dev");
      assert.equal(appRecord.nightlyAddress, "https://nightly.switchboard.dev");
      assert.equal((appRecord.productionAddresses as Array<unknown>).length, 2);
      assert.equal((appRecord.environments as Array<unknown>).length, 5);
    }
  );

  await t.test(
    "developer, manager, and admin permissions follow the new role model",
    async () => {
      await resetDatabase();
      const owner = await createUser("owner");
      const developer = await createUser("developer");
      const manager = await createUser("manager");
      const managerInvitee = await createUser("manager-invitee");
      const adminOne = await createUser("admin-one");
      const adminTwo = await createUser("admin-two");
      const otherUser = await createUser("other-user");

      const createEnvironment = await apiRequest({
        path: "/api/v1/apps",
        method: "POST",
        userId: owner.id,
        body: {
          name: "permissions-app",
        },
      });
      assert.equal(createEnvironment.response.status, 201);
      const appId = (
        createEnvironment.payload.data as { app: Record<string, unknown> }
      ).app.id as string;

      const addManager = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: owner.id,
        body: {
          userId: manager.id,
          role: "manager",
        },
      });
      assert.equal(addManager.response.status, 201);

      const addDeveloper = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: owner.id,
        body: {
          userId: developer.id,
          role: "developer",
        },
      });
      assert.equal(addDeveloper.response.status, 201);

      const createFlag = await apiRequest({
        path: `/api/v1/apps/${appId}/flags`,
        method: "POST",
        userId: developer.id,
        body: {
          name: "beta_banner",
          config: booleanFlagConfig,
        },
      });
      assert.equal(createFlag.response.status, 201);
      const flagId = (
        createFlag.payload.data as { flag: Record<string, unknown> }
      ).flag.id as string;

      const updateFlag = await apiRequest({
        path: `/api/v1/apps/${appId}/flags/${flagId}`,
        method: "PATCH",
        userId: developer.id,
        body: {
          description: "Updated by developer",
        },
      });
      assert.equal(updateFlag.response.status, 200);

      const ownOverride = await apiRequest({
        path: `/api/v1/apps/${appId}/overrides`,
        method: "POST",
        userId: developer.id,
        body: {
          flagId,
          userId: developer.id,
          value: true,
        },
      });
      assert.equal(ownOverride.response.status, 201);

      const otherOverride = await apiRequest({
        path: `/api/v1/apps/${appId}/overrides`,
        method: "POST",
        userId: developer.id,
        body: {
          flagId,
          userId: otherUser.id,
          value: true,
        },
      });
      assert.equal(otherOverride.response.status, 403);

      const developerUpdateEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}`,
        method: "PATCH",
        userId: developer.id,
        body: {
          name: "renamed-by-developer",
        },
      });
      assert.equal(developerUpdateEnvironment.response.status, 403);

      const developerAddMember = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: developer.id,
        body: {
          userId: otherUser.id,
          role: "developer",
        },
      });
      assert.equal(developerAddMember.response.status, 403);

      const developerCreateApiKey = await apiRequest({
        path: `/api/v1/apps/${appId}/api-keys`,
        method: "POST",
        userId: developer.id,
        body: {
          description: "developer key",
          scopes: ["flags:read"],
        },
      });
      assert.equal(developerCreateApiKey.response.status, 403);

      const developerDeleteFlag = await apiRequest({
        path: `/api/v1/apps/${appId}/flags/${flagId}`,
        method: "DELETE",
        userId: developer.id,
      });
      assert.equal(developerDeleteFlag.response.status, 403);

      const managerUpdateEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}`,
        method: "PATCH",
        userId: manager.id,
        body: {
          name: "renamed-by-manager",
        },
      });
      assert.equal(managerUpdateEnvironment.response.status, 200);

      const managerAddManager = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: manager.id,
        body: {
          userId: managerInvitee.id,
          role: "manager",
        },
      });
      assert.equal(managerAddManager.response.status, 201);

      const managerAddAdmin = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: manager.id,
        body: {
          userId: adminOne.id,
          role: "admin",
        },
      });
      assert.equal(managerAddAdmin.response.status, 403);

      const managerDeleteEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}`,
        method: "DELETE",
        userId: manager.id,
      });
      assert.equal(managerDeleteEnvironment.response.status, 403);

      const ownerAddAdmin = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: owner.id,
        body: {
          userId: adminOne.id,
          role: "admin",
        },
      });
      assert.equal(ownerAddAdmin.response.status, 201);

      const adminPromoteAdmin = await apiRequest({
        path: `/api/v1/apps/${appId}/members`,
        method: "POST",
        userId: adminOne.id,
        body: {
          userId: adminTwo.id,
          role: "admin",
        },
      });
      assert.equal(adminPromoteAdmin.response.status, 201);

      const adminDeleteEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}`,
        method: "DELETE",
        userId: adminOne.id,
      });
      assert.equal(adminDeleteEnvironment.response.status, 200);
    }
  );

  await t.test(
    "evaluate matches configured addresses and rejects unknown URLs",
    async () => {
      await resetDatabase();
      const owner = await createUser("owner");

      const createEnvironment = await apiRequest({
        path: "/api/v1/apps",
        method: "POST",
        userId: owner.id,
        body: {
          name: "evaluate-app",
          environments: [
            {
              name: "production",
              address: "https://app.evaluate.dev",
              enabled: true,
            },
            {
              name: "staging",
              address: "https://staging.evaluate.dev",
              enabled: true,
            },
            {
              name: "nightly",
              address: "https://nightly.evaluate.dev",
              enabled: true,
            },
            {
              name: "qa",
              address: "https://qa.evaluate.dev",
              enabled: false,
            },
          ],
        },
      });
      assert.equal(createEnvironment.response.status, 201);
      const appId = (
        createEnvironment.payload.data as { app: Record<string, unknown> }
      ).app.id as string;

      const createFlag = await apiRequest({
        path: `/api/v1/apps/${appId}/flags`,
        method: "POST",
        userId: owner.id,
        body: {
          name: "new_checkout",
          config: booleanFlagConfig,
        },
      });
      assert.equal(createFlag.response.status, 201);

      const sdkSecret = "switchboard-sdk-secret";
      await db.insert(apiKeys).values({
        appId: appId,
        hashedKey: hashSecret(sdkSecret),
        description: "sdk test key",
        scopes: ["flags:read"],
      });

      const evaluateProd = await apiRequest({
        path: `/api/v1/apps/${appId}/evaluate`,
        method: "POST",
        headers: {
          authorization: `Bearer ${sdkSecret}`,
        },
        body: {
          url: "https://app.evaluate.dev",
        },
      });
      assert.equal(evaluateProd.response.status, 200);
      assert.equal(
        (evaluateProd.payload.data as { addressMatched: boolean })
          .addressMatched,
        true
      );

      const evaluateDisabledEnvironment = await apiRequest({
        path: `/api/v1/apps/${appId}/evaluate`,
        method: "POST",
        headers: {
          authorization: `Bearer ${sdkSecret}`,
        },
        body: {
          url: "https://qa.evaluate.dev",
        },
      });
      assert.equal(evaluateDisabledEnvironment.response.status, 403);

      const evaluateUnknown = await apiRequest({
        path: `/api/v1/apps/${appId}/evaluate`,
        method: "POST",
        headers: {
          authorization: `Bearer ${sdkSecret}`,
        },
        body: {
          url: "https://unknown.evaluate.dev",
        },
      });
      assert.equal(evaluateUnknown.response.status, 403);
    }
  );
});
