FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter api...

# --- build ---
FROM base AS build
COPY --from=deps /app/ /app/
COPY apps/api/ apps/api/
COPY packages/typescript-config/ packages/typescript-config/
RUN pnpm --filter api build

# --- runner ---
FROM node:22-alpine AS runner
WORKDIR /app/apps/api

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY --from=build /app/apps/api/package.json ./
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules ./node_modules

ENV NODE_ENV=production

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/index.js"]
