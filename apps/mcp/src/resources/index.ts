import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SwitchboardBackend } from "../lib/backend.js";
import { createCurrentFlagsSnapshot } from "../lib/backend.js";
import { jsonResource } from "../lib/results.js";

export function registerResources(
  server: McpServer,
  backend: SwitchboardBackend
) {
  server.registerResource(
    "current_feature_flags",
    "switchboard://current_feature_flags",
    {
      title: "Current Feature Flags",
      description:
        "Read-only snapshot of accessible apps and their current feature flag inventory.",
      mimeType: "application/json",
    },
    async (uri) => {
      const snapshot = await createCurrentFlagsSnapshot(backend);
      return jsonResource(uri.href, snapshot);
    }
  );

  server.registerResource(
    "feature_flag_best_practices",
    "switchboard://best_practices/feature_flags",
    {
      title: "Feature Flag Best Practices",
      description:
        "Safe operating guidance for naming, rollout, overrides, and cleanup.",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonResource(uri.href, {
        naming: [
          "Use lowercase snake_case flag names only.",
          "Prefer intent-revealing names like beta_dashboard instead of temporary_ticket_123.",
          "Keep names stable; use description/config changes instead of renaming active flags casually.",
        ],
        rollout: [
          "Create the flag first with a safe default.",
          "Roll out with a specific client or attribute rule before broadening scope.",
          "Document the owner and expected cleanup date outside the flag name.",
        ],
        overrides: [
          "Use per-user overrides for support/debugging, not as a permanent segmentation strategy.",
          "Delete overrides when the incident or validation window ends.",
        ],
        safety: [
          "Always read the current flags resource before mutating to avoid hallucinated names.",
          "Ask for explicit approval before any write or delete action.",
        ],
      })
  );
}
