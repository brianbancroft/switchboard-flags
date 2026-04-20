export const TEST_APP_NAME = "playwright-test-app";
// Flag names must match ^[a-z]+(?:_[a-z]+)*$ (see feature_flags CHECK constraint) — no digits.
export const TEST_FLAG_NAME = "playwright_visible_flag";

export const ROLE_FIXTURES = [
  { email: "alice@example.com", role: "admin" as const },
  { email: "bob@example.com", role: "manager" as const },
  { email: "carol@example.com", role: "developer" as const },
];
