import { Switchboard, type JsonValue } from "@switchboard-flags/client";

const DEFAULTS: Record<string, JsonValue> = {
  show_status_banner: true,
  dashboard_theme: "default",
  max_chart_points: 12,
  enable_incident_alerts: false,
  deployment_view: "timeline",
};

let client: Switchboard | null = null;

function getClient(): Switchboard | null {
  const token = process.env.SWITCHBOARD_TOKEN;
  if (!token) return null;
  if (client) return client;

  const url = process.env.SWITCHBOARD_API_URL ?? "http://localhost:4000";
  const callerUrl = process.env.SWITCHBOARD_CALLER_URL ?? "http://localhost:3002";

  client = new Switchboard({
    url,
    token,
    callerUrl,
    minCheckIntervalMs: 0,
    onError: (error) => {
      console.error("[switchboard] refresh failed:", error);
    },
  });
  return client;
}

/**
 * Fetch-fresh flags for the current server render. Returns a sync `check(name, default)`
 * helper backed by a just-refreshed payload. When no token is configured, falls back
 * to the seed defaults so the demo still renders in isolation.
 */
export async function getFlags(): Promise<{
  check: <T extends JsonValue>(name: string, defaultValue: T) => T;
  tokenConfigured: boolean;
}> {
  const sb = getClient();
  if (!sb) {
    return {
      tokenConfigured: false,
      check: <T extends JsonValue>(name: string, defaultValue: T): T => {
        const seedValue = DEFAULTS[name];
        return (seedValue ?? defaultValue) as T;
      },
    };
  }

  try {
    await sb.ready();
    await sb.refresh();
  } catch (error) {
    console.error("[switchboard] initial load failed:", error);
  }

  return {
    tokenConfigured: true,
    check: <T extends JsonValue>(name: string, defaultValue: T): T =>
      sb.check<T>(name, defaultValue),
  };
}
