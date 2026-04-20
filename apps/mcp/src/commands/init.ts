import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { exec } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { AddressInfo } from "node:net";

const AUTH_TIMEOUT_MS = 2 * 60 * 1000;

const CLOSE_TAB_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Switchboard MCP — Authenticated</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #111; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #555; }
  </style>
</head>
<body>
  <h1>Authentication successful!</h1>
  <p>You can safely close this tab and return to your terminal.</p>
  <script>window.close();</script>
</body>
</html>`;

function getClaudeDesktopConfigPath(): string {
  const home = homedir();
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32":
      return join(
        process.env.APPDATA ?? join(home, "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json"
      );
    default:
      return join(home, ".config", "claude", "claude_desktop_config.json");
  }
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  exec(`${cmd} "${url}"`);
}

function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForCallback(port: number, serverAddress: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const token = url.searchParams.get("token");
      if (!token) {
        res.writeHead(400).end("Missing token");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" }).end(CLOSE_TAB_HTML);
      clearTimeout(timeout);
      server.close(() => resolve(token));
    });

    const timeout = setTimeout(() => {
      server.close(() =>
        reject(new Error("Authentication timed out after 2 minutes."))
      );
    }, AUTH_TIMEOUT_MS);

    server.listen(port, "127.0.0.1", () => {
      const authUrl = `${serverAddress}/auth/mcp?callback_port=${port}`;
      process.stdout.write(`Opening browser for authentication...\n${authUrl}\n\n`);
      openBrowser(authUrl);
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function writeClaudeConfig(
  configPath: string,
  serverAddress: string,
  token: string
): void {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // file doesn't exist or is invalid — start fresh
  }

  const updated = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers as Record<string, unknown> | undefined ?? {}),
      switchboard: {
        command: "npx",
        args: ["-y", "@switchboard-flags/mcp", "stdio"],
        env: {
          SWITCHBOARD_API_BASE_URL: serverAddress,
          SWITCHBOARD_API_TOKEN: token,
        },
      },
    },
  };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
}

export async function run(args: string[]): Promise<void> {
  const serverAddress = args[0];

  if (!serverAddress) {
    process.stderr.write(
      "Usage: npx @switchboard-flags/mcp init <serverAddress>\n"
    );
    process.exit(1);
  }

  try {
    new URL(serverAddress);
  } catch {
    process.stderr.write(`Invalid server address: ${serverAddress}\n`);
    process.exit(1);
  }

  const port = await getRandomPort();

  process.stdout.write(`Waiting for authentication on port ${port}...\n`);

  let token: string;
  try {
    token = await waitForCallback(port, serverAddress);
  } catch (err) {
    process.stderr.write(
      `Authentication failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }

  const configPath = getClaudeDesktopConfigPath();
  writeClaudeConfig(configPath, serverAddress, token);

  process.stdout.write(
    [
      `\n✓ Claude Desktop configured.`,
      `  Config: ${configPath}`,
      `  Server: ${serverAddress}`,
      `\nRestart Claude Desktop to activate the Switchboard MCP server.\n`,
    ].join("\n")
  );
}
