FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter docs build

FROM nginx:alpine
COPY --from=builder /app/apps/docs/dist /usr/share/nginx/html
EXPOSE 80
