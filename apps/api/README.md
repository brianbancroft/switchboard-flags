# Switchboard API

The API lives in `apps/api` and uses Hono, Drizzle ORM, PostgreSQL, Zod validation, and OpenAPI-generated Redoc docs.

## Environment

Copy the root `.env.example` to `.env` and update the values for your local machine:

```sh
cp .env.example .env
```

Required variables:

- `DATABASE_URL`

Optional local overrides:

- `API_HOST`
- `API_PORT`
- `PUBLIC_API_SPEC_URL`

## Commands

Run from the repo root:

```sh
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

Useful endpoints:

- `http://localhost:4000/health`
- `http://localhost:4000/db/health`
- `http://localhost:4000/openapi.json`
- `http://localhost:4000/docs`
