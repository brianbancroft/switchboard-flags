# Contributing

Thanks for contributing to Switchboard.

## Ground Rules

- The only code that should directly touch the database is `apps/api`.
- Keep documentation and implementation changes in the same pull request when behavior changes.
- Prefer typed contracts and API SDK updates over ad hoc client logic.
- Document MCP tool changes with prompt examples and safety implications.

## Development Workflow

1. Install dependencies with `pnpm install`.
2. Start PostgreSQL and apply migrations with `pnpm up`.
3. Run the workspace with `pnpm dev`.
4. Make code and docs changes together.
5. Run:

```bash
pnpm lint
pnpm check-types
pnpm --filter docs build
```

## When Changing The API

- Update route contracts in `apps/api/src/routes`.
- Keep `packages/api-sdk` aligned with response and request shapes.
- Refresh the checked-in OpenAPI snapshot at `apps/docs/public/openapi.yaml`.
- Add or update docs under `apps/docs/src/content/docs`.

## When Changing MCP Tools

- Update tool descriptions and examples in `apps/docs/src/content/docs/mcp`.
- Preserve explicit approval requirements for mutating tools.
- Keep the MCP server API-backed rather than database-backed.

## Pull Requests

Include:

- a short summary of the change
- any migration or environment variable changes
- screenshots or screenshot descriptions for UI-affecting work
- notes about API or MCP compatibility impacts
