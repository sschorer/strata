# syntax=docker/dockerfile:1

# --- build stage -----------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable

# Install deps against the workspace manifests (better layer caching).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY plugins ./plugins
COPY apps ./apps
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm -r build

# Prune to production deps for a lean runtime.
RUN pnpm --filter @strata/server deploy --prod /out

# --- runtime stage ---------------------------------------------------------
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4000

# git is required: Strata shells out to it for history/blob reads.
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out ./

# The incremental cache is written at runtime as `node` — mount a volume here
# (see compose.yml) to keep it across restarts.
ENV STRATA_CACHE_DIR=/app/.strata
RUN mkdir -p /app/.strata && chown node:node /app/.strata

EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
