import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SwitchboardBackend } from "../lib/backend.js";
import { registerApiKeyTools } from "./api-keys.js";
import { registerEnvironmentMemberTools } from "./environment-members.js";
import { registerEnvironmentTools } from "./environments.js";
import { registerEvaluateTools } from "./evaluate.js";
import { registerFlagTools } from "./flags.js";
import { registerOverrideTools } from "./overrides.js";
import { registerProductionAddressTools } from "./production-addresses.js";
import { registerSystemTools } from "./system.js";

export function registerTools(server: McpServer, backend: SwitchboardBackend) {
  registerSystemTools(server, backend);
  registerEnvironmentTools(server, backend);
  registerProductionAddressTools(server, backend);
  registerEnvironmentMemberTools(server, backend);
  registerFlagTools(server, backend);
  registerOverrideTools(server, backend);
  registerApiKeyTools(server, backend);
  registerEvaluateTools(server, backend);
}
