# Switchboard Docs

The docs app lives in `apps/docs` and uses Astro Starlight for product and engineering documentation.

## Local development

Run from the repo root:

```bash
pnpm dev:docs
```

The docs app runs on `http://localhost:3001`.

## API reference

The API reference page lives at `http://localhost:3001/api` and renders
Redoc from the `PUBLIC_API_SPEC_URL` environment variable, which defaults to
`http://localhost:4000/openapi.json`.

## Where to edit

- Content pages: `apps/docs/src/content/docs`
- API docs page: `apps/docs/src/pages/api.astro`
- Sidebar and site config: `apps/docs/astro.config.mjs`
