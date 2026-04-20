import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SwitchboardBackend } from "./lib/backend.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

export function createSwitchboardMcpServer() {
  const server = new McpServer({
    name: "switchboard-feature-flags",
    version: "0.2.0",
  });

  const backend = new SwitchboardBackend();

  registerTools(server, backend);
  registerResources(server, backend);
  registerPrompts(server);

  return server;
}
