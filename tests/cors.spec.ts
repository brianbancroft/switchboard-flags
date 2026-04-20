import { expect, request, test } from "@playwright/test";
import { API_BASE } from "./helpers/api";

async function preflight(origin: string): Promise<{
  status: number;
  allowOrigin: string | null;
  allowMethods: string | null;
}> {
  const api = await request.newContext();
  const res = await api.fetch(
    `${API_BASE}/api/v1/apps/00000000-0000-0000-0000-000000000000/flags`,
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    }
  );
  const headers = res.headers();
  await api.dispose();
  return {
    status: res.status(),
    allowOrigin: headers["access-control-allow-origin"] ?? null,
    allowMethods: headers["access-control-allow-methods"] ?? null,
  };
}

test("dev origins (localhost and *.local) are always allowed", async () => {
  for (const origin of [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://127.0.0.1:8080",
    "http://switchboard-dash.local:3002",
  ]) {
    const { allowOrigin, allowMethods } = await preflight(origin);
    expect(allowOrigin, `origin ${origin} should be allowed`).toBe(origin);
    expect(allowMethods).toContain("PUT");
  }
});

test("a random external origin is rejected", async () => {
  const { allowOrigin } = await preflight("https://evil.example.org");
  // hono/cors returns no Access-Control-Allow-Origin header when origin is denied
  expect(allowOrigin).not.toBe("https://evil.example.org");
});

test("production addresses stored in the DB are allowed", async () => {
  // The seeded `acme-storefront` app has a production address
  // `https://app.acme.test` in app_production_addresses.
  const { allowOrigin } = await preflight("https://app.acme.test");
  expect(allowOrigin).toBe("https://app.acme.test");
});

test("environment addresses stored in the DB are allowed", async () => {
  // Seeded staging/nightly addresses for acme-storefront.
  for (const origin of [
    "https://staging.acme.test",
    "https://nightly.acme.test",
  ]) {
    const { allowOrigin } = await preflight(origin);
    expect(allowOrigin, `origin ${origin} should be allowed`).toBe(origin);
  }
});
