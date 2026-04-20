import { expect, test } from "@playwright/test";
import { DASHBOARD_BASE } from "./helpers/api";
import {
  closePool,
  findAppIdByName,
  findEnvIdByName,
  findFlagIdByName,
  getFlagEnvValue,
} from "./helpers/db";
import { signInUi, toggleFlagInEnvUi } from "./helpers/ui";

const APP_NAME = "switchboard-dashboard";
const FLAG_NAME = "show_status_banner";
const ENV_NAME = "switchboard-dash.local";

test.afterAll(async () => {
  await closePool();
});

test("admin toggles show_status_banner in web → dashboard reflects state", async ({
  page,
}) => {
  const appId = await findAppIdByName(APP_NAME);
  const flagId = await findFlagIdByName(appId, FLAG_NAME);
  // sanity: env exists
  await findEnvIdByName(appId, ENV_NAME);

  // 1. Initial state: dashboard banner ON (seed default = true, no env value override)
  await page.goto(`${DASHBOARD_BASE}/`);
  await expect(page.getByTestId("status-banner-on")).toBeVisible();
  await expect(page.getByTestId("flag-show_status_banner")).toHaveText("true");
  expect(await getFlagEnvValue(appId, FLAG_NAME, ENV_NAME)).toBeNull();

  // 2. Sign into web UI. The Switch reflects env value (null → unchecked).
  await signInUi(page, "admin@example.com", "password");

  // 3. Toggle switch ON → env value becomes `true`. Banner stays ON (same as default).
  await toggleFlagInEnvUi(page, appId, flagId, FLAG_NAME, ENV_NAME, true);
  expect(await getFlagEnvValue(appId, FLAG_NAME, ENV_NAME)).toBe(true);

  // 4. Toggle switch OFF → env value becomes `false`. Banner should flip to the
  //    disabled placeholder on the dashboard.
  await toggleFlagInEnvUi(page, appId, flagId, FLAG_NAME, ENV_NAME, false);
  expect(await getFlagEnvValue(appId, FLAG_NAME, ENV_NAME)).toBe(false);

  await expect
    .poll(
      async () => {
        await page.goto(`${DASHBOARD_BASE}/`);
        return page.getByTestId("flag-show_status_banner").textContent();
      },
      { timeout: 10_000, intervals: [500, 1000, 1000] }
    )
    .toBe("false");
  await expect(page.getByTestId("status-banner-off")).toBeVisible();
  await expect(page.getByText("Status Banner Disabled")).toBeVisible();

  // 5. Flip it back ON and verify both DB and dashboard recover.
  await toggleFlagInEnvUi(page, appId, flagId, FLAG_NAME, ENV_NAME, true);
  expect(await getFlagEnvValue(appId, FLAG_NAME, ENV_NAME)).toBe(true);
  await expect
    .poll(
      async () => {
        await page.goto(`${DASHBOARD_BASE}/`);
        return page.getByTestId("flag-show_status_banner").textContent();
      },
      { timeout: 10_000, intervals: [500, 1000, 1000] }
    )
    .toBe("true");
  await expect(page.getByTestId("status-banner-on")).toBeVisible();
});
