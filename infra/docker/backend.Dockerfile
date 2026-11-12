# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install openssl for Prisma engines and curl for container health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Stage 1: Dependencies & Prisma Client Generation
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npx prisma generate

# Stage 2: Minimal Production Runtime
FROM base AS runtime
WORKDIR /app

# Copy node_modules with compiled Prisma engines and ts-node
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/prisma ./prisma
COPY --from=deps --chown=node:node /app/package.json ./package.json
COPY --chown=node:node tsconfig.json ./tsconfig.json
COPY --chown=node:node src ./src
RUN mkdir -p /app/storage && chown -R node:node /app/storage

USER node

# Expose standard API (3000) and Delivery (3005) ports
EXPOSE 3000 3005

# Default entrypoint runs the Core API server
CMD ["npx", "ts-node", "src/server.ts"]
