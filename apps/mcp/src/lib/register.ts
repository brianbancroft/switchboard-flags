import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeError } from "./backend.js";
import { jsonResult, textResult } from "./results.js";

// The MCP SDK's registerTool overloads are stricter than the runtime contract
// for our reusable wrapper, so we bridge them through a narrow helper boundary.
// biome-ignore lint/suspicious/noExplicitAny: This helper is the intentional boundary.
type LooseToolHandler = (input: any) => Promise<unknown>;

export function registerReadTool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: unknown,
  handler: LooseToolHandler
) {
  server.registerTool(
    name,
    {
      title: name,
      description,
      // biome-ignore lint/suspicious/noExplicitAny: See LooseToolHandler note above.
      ...(inputSchema ? { inputSchema: inputSchema as any } : {}),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: See LooseToolHandler note above.
    (async (input: any) => {
      try {
        const data = await handler(input);
        return jsonResult(data);
      } catch (error) {
        const normalized = normalizeError(error);
        return textResult(normalized.message, {
          isError: true,
        });
      }
      // biome-ignore lint/suspicious/noExplicitAny: See LooseToolHandler note above.
    }) as any
  );
}

export function registerWriteTool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: unknown,
  options: {
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  },
  handler: LooseToolHandler
) {
  server.registerTool(
    name,
    {
      title: name,
      description,
      // biome-ignore lint/suspicious/noExplicitAny: See LooseToolHandler note above.
      inputSchema: inputSchema as any,
      annotations: {
        readOnlyHint: false,
        destructiveHint: options.destructiveHint ?? false,
        idempotentHint: options.idempotentHint ?? false,
        openWorldHint: false,
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: See LooseToolHandler note above.
    (async (input: any) => {
      try {
        const data = await handler(input);
        return jsonResult(data);
      } catch (error) {
        const normalized = normalizeError(error);
        return textResult(normalized.message, {
          isError: true,
        });
      }
      // biome-ignore lint/suspicious/noExplicitAny: See LooseToolHandler note above.
    }) as any
  );
}
