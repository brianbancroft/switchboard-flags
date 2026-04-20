import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createClient,
  type SwitchboardManagementAuth,
  type SwitchboardSessionUser,
} from "@repo/api-sdk";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { env } from "./env.js";
import type { McpUserContext } from "./lib/context.js";
import { runWithUserContext } from "./lib/context.js";
import { createSwitchboardMcpServer } from "./server.js";

const app = createMcpExpressApp({
  host: env.MCP_HTTP_HOST,
  allowedHosts: env.MCP_ALLOWED_HOSTS,
});

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const sessionClient = createClient(env.SWITCHBOARD_API_BASE_URL);

type SessionCacheEntry = {
  user: SwitchboardSessionUser;
  expiresAt: number;
};

const sessionCache = new Map<string, SessionCacheEntry>();
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveSessionToken(
  token: string
): Promise<SwitchboardSessionUser | null> {
  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const session = await sessionClient.getSession({
    kind: "session-token",
    sessionToken: token,
  });

  if (!session) {
    sessionCache.delete(token);
    return null;
  }

  sessionCache.set(token, {
    user: session.user,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });

  return session.user;
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice(7).trim();
}

async function resolveUserContext(
  req: Request
): Promise<McpUserContext | null> {
  const token = extractBearerToken(req);

  if (!token) {
    if (env.SWITCHBOARD_API_UI_USER_ID) {
      return {
        auth: { kind: "ui-user-id", userId: env.SWITCHBOARD_API_UI_USER_ID },
        user: null,
      };
    }
    return null;
  }

  if (env.MCP_AUTH_TOKEN && token === env.MCP_AUTH_TOKEN) {
    if (env.SWITCHBOARD_API_UI_USER_ID) {
      return {
        auth: { kind: "ui-user-id", userId: env.SWITCHBOARD_API_UI_USER_ID },
        user: null,
      };
    }
    return { auth: { kind: "header", headers: {} }, user: null };
  }

  const user = await resolveSessionToken(token);
  if (!user) {
    return null;
  }

  const auth: SwitchboardManagementAuth = {
    kind: "session-token",
    sessionToken: token,
  };

  return { auth, user };
}

app.use(
  env.MCP_HTTP_PATH,
  async (req: Request, res: Response, next: NextFunction) => {
    const ctx = await resolveUserContext(req);

    if (!ctx) {
      res
        .status(401)
        .setHeader("www-authenticate", 'Bearer realm="switchboard-mcp"')
        .json({
          error: "Unauthorized",
          message:
            "Provide a valid better-auth session token or MCP_AUTH_TOKEN as a Bearer token.",
        });
      return;
    }

    runWithUserContext(ctx, () => next());
  }
);

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});
const server = createSwitchboardMcpServer();

await server.connect(transport);

app.all(env.MCP_HTTP_PATH, async (req: Request, res: Response) => {
  const ctx = await resolveUserContext(req);

  if (!ctx) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await runWithUserContext(ctx, () =>
    transport.handleRequest(req, res, req.body)
  );
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "switchboard-mcp",
    transport: "streamable-http",
  });
});

app.listen(env.MCP_HTTP_PORT, env.MCP_HTTP_HOST, () => {
  console.log(
    `Switchboard MCP listening on http://${env.MCP_HTTP_HOST}:${env.MCP_HTTP_PORT}${env.MCP_HTTP_PATH}`
  );
  if (env.MCP_AUTH_TOKEN) {
    console.log("  Static MCP_AUTH_TOKEN auth is enabled (fallback mode)");
  }
  console.log(
    "  Session-token auth is enabled — send a better-auth session token as Bearer"
  );
});
