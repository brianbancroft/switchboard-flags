import { expect, test } from "@playwright/test";
import {
  type AuthedRequest,
  createFlag,
  deleteFlag,
  findAppByName,
  getApp,
  listFlags,
  setFlagEnvValue,
  signInApi,
} from "./helpers/api";
import { TEST_APP_NAME, TEST_FLAG_NAME } from "./helpers/constants";
import { closePool, findEnvIdByName, getFlagEnvValue } from "./helpers/db";

/**
 * Permission matrix validated below (enforced in flag-env-values.ts and flags.ts):
 *
 *              | create flag | toggle (dev env) | toggle (non-dev env) | delete flag |
 *   admin      |     ✅      |        ✅        |          ✅          |     ✅      |
 *   manager    |     ✅      |        ✅        |          ✅          |     ❌      |
 *   developer  |     ✅      |        ✅        |          ❌ (403)    |     ❌      |
 */

let appId: string;
let prodEnvId: string;
let devEnvId: string;

let admin: AuthedRequest;
let alice: AuthedRequest; // app-admin
let bob: AuthedRequest; // app-manager
let carol: AuthedRequest; // app-developer

test.beforeAll(async () => {
  admin = await signInApi("admin@example.com", "password");

  const app = await findAppByName(admin, TEST_APP_NAME);
  if (!app) throw new Error(`${TEST_APP_NAME} not seeded`);
  appId = app.id;

  prodEnvId = await findEnvIdByName(appId, "production");
  devEnvId = await findEnvIdByName(appId, "dev");

  alice = await signInApi("alice@example.com", "password");
  bob = await signInApi("bob@example.com", "password");
  carol = await signInApi("carol@example.com", "password");
});

test.afterAll(async () => {
  await admin.dispose();
  await alice.dispose();
  await bob.dispose();
  await carol.dispose();
  await closePool();
});

test("admin (app role) can create, toggle, and delete a flag", async () => {
  const flagName = "admin_created_flag";
  const create = await createFlag(alice, appId, { name: flagName });
  expect(create.statusCode).toBe(201);

  const flags = await listFlags(alice, appId);
  const flag = flags.find((f) => f.name === flagName);
  expect(flag).toBeTruthy();

  const toggle = await setFlagEnvValue(alice, appId, flag!.id, prodEnvId, true);
  expect(toggle.statusCode).toBe(200);
  expect(await getFlagEnvValue(appId, flagName, "production")).toBe(true);

  const del = await deleteFlag(alice, appId, flag!.id);
  expect(del.statusCode).toBe(200);
  const flagsAfter = await listFlags(alice, appId);
  expect(flagsAfter.find((f) => f.name === flagName)).toBeUndefined();
});

test("manager (app role) can toggle flags but cannot delete them", async () => {
  const flagName = "manager_test_flag";
  await ensureFlag(admin, flagName);
  const flagId = (await listFlags(bob, appId)).find(
    (f) => f.name === flagName
  )!.id;

  // Manager can toggle in production
  const toggle = await setFlagEnvValue(bob, appId, flagId, prodEnvId, true);
  expect(toggle.statusCode).toBe(200);
  expect(await getFlagEnvValue(appId, flagName, "production")).toBe(true);

  // Manager CANNOT delete
  const del = await deleteFlag(bob, appId, flagId);
  expect(del.statusCode).toBe(403);

  // Cleanup as admin
  await deleteFlag(admin, appId, flagId);
});

test("developer (app role) can create, toggle in dev env only, and cannot delete", async () => {
  const flagName = "dev_created_flag";
  const create = await createFlag(carol, appId, { name: flagName });
  expect(create.statusCode).toBe(201);

  const flags = await listFlags(carol, appId);
  const flag = flags.find((f) => f.name === flagName);
  expect(flag).toBeTruthy();

  // Developer CAN toggle in dev env
  const toggleDev = await setFlagEnvValue(
    carol,
    appId,
    flag!.id,
    devEnvId,
    true
  );
  expect(toggleDev.statusCode).toBe(200);
  expect(await getFlagEnvValue(appId, flagName, "dev")).toBe(true);

  // Developer CANNOT toggle in production (non-dev) — 403
  const toggleProd = await setFlagEnvValue(
    carol,
    appId,
    flag!.id,
    prodEnvId,
    true
  );
  expect(toggleProd.statusCode).toBe(403);
  // Prod env value must remain untouched
  expect(await getFlagEnvValue(appId, flagName, "production")).toBeNull();

  // Developer CANNOT delete
  const del = await deleteFlag(carol, appId, flag!.id);
  expect(del.statusCode).toBe(403);

  // Cleanup as admin
  await deleteFlag(admin, appId, flag!.id);
});

test("non-member is forbidden from the app entirely", async () => {
  // dave is seeded but has NO role on the test app
  const dave = await signInApi("dave@example.com", "password");
  try {
    const res = await dave.api.get(`/api/v1/apps/${appId}/flags`);
    expect(res.status()).toBe(403);
  } finally {
    await dave.dispose();
  }
});

async function ensureFlag(actor: AuthedRequest, flagName: string) {
  const flags = await listFlags(actor, appId);
  if (flags.find((f) => f.name === flagName)) return;
  const res = await createFlag(actor, appId, { name: flagName });
  if (res.statusCode !== 201) {
    throw new Error(`ensureFlag failed: ${JSON.stringify(res.body)}`);
  }
}

test("app exists and test users are members with the expected roles", async () => {
  const app = await getApp(admin, appId);
  expect(app.name).toBe(TEST_APP_NAME);
  const members = (
    await (await admin.api.get(`/api/v1/apps/${appId}/members`)).json()
  ).data.members as Array<{ userId: string; role: string; email?: string }>;

  const rolesByEmail = new Map<string, string>();
  const usersRes = await admin.api.get(`/api/v1/users`);
  const usersBody = (await usersRes.json()) as {
    data: { users: Array<{ id: string; email: string }> };
  };
  const emailById = new Map(
    usersBody.data.users.map((u) => [u.id, u.email])
  );
  for (const m of members) rolesByEmail.set(emailById.get(m.userId) ?? "", m.role);

  expect(rolesByEmail.get("alice@example.com")).toBe("admin");
  expect(rolesByEmail.get("bob@example.com")).toBe("manager");
  expect(rolesByEmail.get("carol@example.com")).toBe("developer");
  // Use of TEST_FLAG_NAME keeps the import live and verifies global-setup seeded the flag
  expect((await listFlags(admin, appId)).find((f) => f.name === TEST_FLAG_NAME)).toBeTruthy();
});
