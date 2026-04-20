import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSwitchboardMcpServer } from "./server.js";
import { run as runInit } from "./commands/init.js";

const [subcommand, ...args] = process.argv.slice(2);

switch (subcommand) {
  case "init":
    await runInit(args);
    break;

  case "stdio": {
    const transport = new StdioServerTransport();
    const server = createSwitchboardMcpServer();
    await server.connect(transport);
    break;
  }

  default:
    process.stderr.write(
      [
        "Usage: npx @switchboard-flags/mcp <command>",
        "",
        "Commands:",
        "  init <serverAddress>  Configure Claude Desktop to use this MCP server",
        "  stdio                 Start the MCP server over stdio (used by AI clients)",
        "",
      ].join("\n")
    );
    process.exit(subcommand ? 1 : 0);
}
