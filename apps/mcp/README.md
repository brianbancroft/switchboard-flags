# Switchboard MCP Server

Switchboard MCP is a secure Model Context Protocol server for AI coding assistants that need to inspect and manage feature flags without touching the database directly. It talks only to the existing Switchboard Hono API and relies on that API for environment-level permission checks.

The platform model exposed through the MCP server matches the existing backend:

- `users`
- `environments`
- `environment_production_addresses`
- `feature_flags`
- `flag_overrides`
- `environment_members`
- `api_keys`

The canonical database schema lives in [apps/api/src/db/schema.ts](../api/src/db/schema.ts), and the canonical REST routes live in:

- [apps/api/src/routes/environments.ts](../api/src/routes/environments.ts)
- [apps/api/src/routes/production-addresses.ts](../api/src/routes/production-addresses.ts)
- [apps/api/src/routes/environment-members.ts](../api/src/routes/environment-members.ts)
- [apps/api/src/routes/flags.ts](../api/src/routes/flags.ts)
- [apps/api/src/routes/overrides.ts](../api/src/routes/overrides.ts)
- [apps/api/src/routes/api-keys.ts](../api/src/routes/api-keys.ts)
- [apps/api/src/routes/evaluate.ts](../api/src/routes/evaluate.ts)

## What It Exposes

Tools:

- `list_environments`
- `get_environment`
- `create_environment`
- `update_environment`
- `delete_environment`
- `list_production_addresses`
- `create_production_address`
- `update_production_address`
- `delete_production_address`
- `list_environment_members`
- `add_environment_member`
- `update_environment_member`
- `remove_environment_member`
- `list_flags`
- `get_flag`
- `create_flag`
- `update_flag`
- `delete_flag`
- `list_flag_overrides`
- `set_flag_override`
- `delete_flag_override`
- `list_api_keys`
- `create_api_key`
- `delete_api_key`
- `evaluate_flags`
- `get_flag_value`
- `get_switchboard_health`
- `get_switchboard_database_health`

Resources:

- `switchboard://current_feature_flags`
- `switchboard://best_practices/feature_flags`

Prompts:

- `safe_flag_rollout`
- `debug_flag_evaluation`

## Safety Model

- The MCP server never talks to PostgreSQL directly. It only calls the Hono API.
- All management permissions are enforced by the API using the configured UI user context.
- Write tools require an explicit `approval` object with `confirmed: true`.
- Write tools are marked as mutating/destructive in MCP tool annotations.
- HTTP transport supports a bearer token via `MCP_AUTH_TOKEN`.
- Localhost DNS rebinding protection is enabled by the official MCP Express helper unless you intentionally bind more broadly.

## Local Development

### 1. Start PostgreSQL

From the repo root:

```sh
docker compose up -d postgres
```

### 2. Configure Environment

Copy the root env file and fill in values:

```sh
cp .env.example .env
```

Recommended MCP-related fields:

- `SWITCHBOARD_API_BASE_URL=http://127.0.0.1:4000`
- `SWITCHBOARD_API_UI_USER_ID=<uuid for a real user row>`
- `MCP_HTTP_HOST=127.0.0.1`
- `MCP_HTTP_PORT=4010`
- `MCP_HTTP_PATH=/mcp`
- `MCP_AUTH_TOKEN=<long random token>`

Optional evaluate defaults:

- `SWITCHBOARD_EVALUATE_API_KEYS_JSON={"<environment-id>":"sb_live_..."}`

### 3. Start the API

```sh
pnpm dev:api
```

### 4. Start the MCP Server

HTTP transport:

```sh
pnpm dev:mcp
```

stdio transport:

```sh
pnpm --filter mcp dev:stdio
```

Health check:

```sh
curl http://127.0.0.1:4010/healthz
```

## Docker Compose

A simple local compose file is provided at the repo root for PostgreSQL:

- [docker-compose.yml](/Users/brianbancroft/programming/side-hustle/switchboard/docker-compose.yml)

The API and MCP server are typically run with `pnpm` during development so code changes reload cleanly across the monorepo.

## Connecting AI Clients

### Cursor / VS Code / Codex via stdio

Use [apps/mcp/examples/mcp.stdio.json](/Users/brianbancroft/programming/side-hustle/switchboard/apps/mcp/examples/mcp.stdio.json) as a starting point.

### HTTP-capable MCP clients

Use [apps/mcp/examples/mcp.http.json](/Users/brianbancroft/programming/side-hustle/switchboard/apps/mcp/examples/mcp.http.json) and set `Authorization: Bearer <MCP_AUTH_TOKEN>` if configured.

### Claude Desktop

Use [apps/mcp/examples/claude_desktop_config.json](/Users/brianbancroft/programming/side-hustle/switchboard/apps/mcp/examples/claude_desktop_config.json) as a template.

## Deployment

This service can be deployed as a small Node.js app on Render, Fly.io, or Railway.

Minimum runtime configuration:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @repo/api-sdk build && pnpm --filter mcp build`
- Start command: `pnpm --filter mcp start`
- Required env:
  - `SWITCHBOARD_API_BASE_URL`
  - `SWITCHBOARD_API_UI_USER_ID` or `SWITCHBOARD_API_DEFAULT_HEADERS_JSON`
  - `MCP_HTTP_HOST=0.0.0.0`
  - `MCP_HTTP_PORT`
  - `MCP_AUTH_TOKEN`

Deployment notes:

- Prefer private networking between MCP and API.
- Terminate TLS at the platform edge or a reverse proxy.
- If binding to `0.0.0.0`, set `MCP_ALLOWED_HOSTS` to your actual public hostname(s).
- Rotate `MCP_AUTH_TOKEN` and environment-scoped SDK keys regularly.

## Backend Auth Model

This repo’s current API uses placeholder UI auth via user-id headers:

- `x-switchboard-user-id`
- `x-user-id`
- `x-auth-user-id`

The MCP server supports that placeholder through `SWITCHBOARD_API_UI_USER_ID`, but it can also forward arbitrary default headers using `SWITCHBOARD_API_DEFAULT_HEADERS_JSON`.

That means you can later migrate the API to JWT/session auth and keep the MCP server stable by forwarding the new header set.

## Security Considerations

- Do not expose the HTTP transport publicly without `MCP_AUTH_TOKEN` or equivalent upstream auth.
- Do not store plaintext Switchboard environment API keys in prompts or chat transcripts when server-side env configuration will do.
- Prefer environment-scoped API keys for `evaluate_flags`.
- Use dev basic auth only for `dev` environments; production evaluation should use API keys.
- Read from `switchboard://current_feature_flags` before write operations to avoid hallucinated names.
- Let the API remain the only layer that touches the database.

## Best Practices For Agents

- Read current state first using `list_environments`, `list_flags`, or `switchboard://current_feature_flags`.
- Treat `feature_flags.name` as stable API surface; do not casually rename active flags.
- Ask for explicit approval before any create, update, or delete call.
- Prefer `evaluate_flags` when diagnosing runtime behavior and `get_flag_value` for quick single-flag inspection.
- Use `set_flag_override` for short-lived debugging or support workflows, then remove the override.

## Notes

- HTTP transport uses the official MCP Streamable HTTP server transport, which the MCP TypeScript SDK recommends for remote servers.
- stdio remains available for local editor integrations that spawn the server as a child process.
