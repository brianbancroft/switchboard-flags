import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSwitchboardMcpServer } from "./server.js";

const transport = new StdioServerTransport();
const server = createSwitchboardMcpServer();

await server.connect(transport);
