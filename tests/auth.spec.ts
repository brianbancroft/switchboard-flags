import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const e2eEmail = process.env.E2E_EMAIL ?? "admin@example.com";
const e2ePassword = process.env.E2E_PASSWORD ?? "password";

test("email sign-in and sign-out", async ({ page, context, baseURL }) => {
  const uiBaseUrl = baseURL ?? "http://localhost:3000";

  await page.goto("/login");
  await page.getByLabel("Email").fill(e2eEmail);
  await page.getByLabel("Password").fill(e2ePassword);

  await Promise.all([
    page.waitForURL(`${uiBaseUrl}/dashboard`),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  await expect
    .poll(async () => {
      const cookies = await context.cookies(apiBaseUrl);
      return cookies.some(
        (cookie) =>
          cookie.name === "better-auth.session_token" && cookie.value.length > 0
      );
    })
    .toBe(true);

  const session = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/api/auth/get-session`, {
      credentials: "include",
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, apiBaseUrl);

  expect(session.status).toBe(200);
  expect(session.body?.user?.email).toBe(e2eEmail);

  const signOut = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, apiBaseUrl);

  expect(signOut.status).toBe(200);
  expect(signOut.body).toEqual({ success: true });

  await expect
    .poll(async () => {
      const sessionAfterSignOut = await page.evaluate(async (url) => {
        const response = await fetch(`${url}/api/auth/get-session`, {
          credentials: "include",
        });

        return response.json();
      }, apiBaseUrl);

      return sessionAfterSignOut?.user ?? null;
    })
    .toBeNull();
});
