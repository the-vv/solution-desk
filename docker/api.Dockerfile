# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /out \
 && cp -r apps/api/dist apps/api/prisma apps/api/prisma.config.ts /out/

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
# Apply pending migrations, then start. Migrations are idempotent.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
