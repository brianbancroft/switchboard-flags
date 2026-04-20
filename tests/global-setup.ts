import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  addOrUpdateMember,
  createApp,
  findAppByName,
  signInApi,
} from "./helpers/api";
import {
  ROLE_FIXTURES,
  TEST_APP_NAME,
  TEST_FLAG_NAME,
} from "./helpers/constants";
import { closePool, dbQuery, findFlagIdByName } from "./helpers/db";

const REPO_ROOT = resolve(__dirname, "..");

function ensureDashboardEnvFile() {
  const envPath = resolve(REPO_ROOT, "apps/dashboard/.env.local");
  if (existsSync(envPath)) {
    const body = readFileSync(envPath, "utf8");
    if (body.includes("SWITCHBOARD_TOKEN=sb_")) return;
  }
  console.log("[global-setup] Seeding DB to emit dashboard token...");
  const result = spawnSync("pnpm", ["db:seed"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });
  if (result.status !== 0) {
    throw new Error(
      `db:seed failed (exit ${result.status}). Is Postgres up? Run \`pnpm up\` first.`
    );
  }
}

async function ensureTestApp(): Promise<void> {
  const admin = await signInApi("admin@example.com", "password");
  try {
    let app = await findAppByName(admin, TEST_APP_NAME);
    if (!app) {
      console.log(`[global-setup] Creating test app "${TEST_APP_NAME}"...`);
      app = await createApp(admin, {
        name: TEST_APP_NAME,
        description: "App used exclusively by Playwright specs.",
        environments: [
          { name: "production", address: null },
          { name: "staging", address: null },
        ],
      });
    }

    for (const { email, role } of ROLE_FIXTURES) {
      const [userRow] = await dbQuery<{ id: string }>(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      if (!userRow) {
        throw new Error(
          `Seeded user ${email} not found. Run \`pnpm db:seed\`.`
        );
      }
      await addOrUpdateMember(admin, app.id, userRow.id, role);
    }

    // Ensure the test flag exists (as admin, so we don't depend on role tests)
    const flags = await admin.api.get(`/api/v1/apps/${app.id}/flags`);
    const flagsBody = (await flags.json()) as {
      data: { flags: Array<{ id: string; name: string }> };
    };
    const hasFlag = flagsBody.data.flags.some(
      (f) => f.name === TEST_FLAG_NAME
    );
    if (!hasFlag) {
      const res = await admin.api.post(`/api/v1/apps/${app.id}/flags`, {
        data: {
          name: TEST_FLAG_NAME,
          description: "Visible in the dashboard demo during E2E.",
          config: { type: "boolean", defaultValue: false, rules: [] },
        },
      });
      if (!res.ok()) {
        throw new Error(
          `[global-setup] createFlag(${TEST_FLAG_NAME}) failed: ${res.status()} ${await res.text()}`
        );
      }
    }
  } finally {
    await admin.dispose();
  }
}

async function resetDashboardBannerFlag(): Promise<void> {
  // Clear any per-environment override on `show_status_banner` so the demo
  // starts each run in the default (ON) state.
  await dbQuery(
    `DELETE FROM flag_environment_values
       WHERE flag_id IN (
         SELECT f.id FROM feature_flags f
         JOIN apps a ON a.id = f.app_id
         WHERE a.name = 'switchboard-dashboard' AND f.name = 'show_status_banner'
       )`
  );
}

export default async function globalSetup(): Promise<void> {
  ensureDashboardEnvFile();
  await ensureTestApp();
  // sanity probe — will throw if the seed didn't land
  try {
    const appRow = await dbQuery<{ id: string }>(
      `SELECT id FROM apps WHERE name = 'switchboard-dashboard'`
    );
    if (appRow.length > 0) {
      await findFlagIdByName(appRow[0].id, "show_status_banner");
    }
  } finally {
    await resetDashboardBannerFlag();
    await closePool();
  }
}
