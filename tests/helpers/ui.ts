import { type Page, expect } from "@playwright/test";

const UI_BASE =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export async function signInUi(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL(`${UI_BASE}/dashboard`),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

/**
 * Navigate to the flag detail page in the web UI and flip the toggle for the
 * given environment. Uses the `aria-label` on the Switch, which is the same
 * pattern the app uses in dashboard.apps.$appId.flags.$flagId.tsx.
 *
 * `displayEnvName("dev")` → "Local development". All other env names are
 * rendered verbatim.
 */
export async function toggleFlagInEnvUi(
  page: Page,
  appId: string,
  flagId: string,
  flagName: string,
  envName: string,
  targetValue: boolean
): Promise<void> {
  await page.goto(`/dashboard/apps/${appId}/flags/${flagId}`);

  const displayName = envName === "dev" ? "Local development" : envName;
  const label = `Toggle ${flagName} in ${displayName}`;
  const toggle = page.getByRole("switch", { name: label });

  // Wait until the page has hydrated and the toggle is enabled (the React
  // component starts disabled while `canToggleStatus` resolves from the
  // useSession hook and app fetch).
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();

  const checked = await toggle.isChecked();
  if (checked === targetValue) return;

  // Capture console / page errors so we don't silently time out on a JS error.
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(`console: ${msg.text()}`);
  });

  // Watch the PUT request so we can surface API failures instead of silently
  // waiting for a state change that never comes.
  const putPromise = page
    .waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/apps/${appId}/flags/${flagId}/env-values/`) &&
        res.request().method() === "PUT",
      { timeout: 10_000 }
    )
    .catch(() => null);

  await toggle.click({ force: true });
  const putRes = await putPromise;
  if (!putRes) {
    throw new Error(
      `Switch click did not trigger a PUT to /env-values/. pageErrors=${JSON.stringify(pageErrors)}`
    );
  }
  if (!putRes.ok()) {
    throw new Error(
      `setFlagEnvValue PUT failed: ${putRes.status()} ${await putRes.text()}`
    );
  }

  await expect(toggle).toBeChecked({ checked: targetValue });
}
