import { defineConfig } from "@playwright/test";

const uiBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const dashboardBaseUrl =
  process.env.PLAYWRIGHT_DASHBOARD_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: uiBaseUrl,
    headless: true,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm dev:api",
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm dev:web",
      url: `${uiBaseUrl}/login`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm dev:dashboard",
      url: dashboardBaseUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
