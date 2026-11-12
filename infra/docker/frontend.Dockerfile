# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat wget
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Stage 2: Build Next.js standalone application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public arguments with fallbacks for Next.js inlined client variables
ARG NEXT_PUBLIC_APP_NAME="EasyStack"
ARG NEXT_PUBLIC_APP_VERSION="1.0.0"
ARG NEXT_PUBLIC_APP_ENV="production"
ARG NEXT_PUBLIC_API_BASE_URL="http://localhost:3002"
ARG NEXT_PUBLIC_API_TIMEOUT="10000"
ARG NEXT_PUBLIC_MAIN_DOMAIN="easystack.localhost"
ARG NEXT_PUBLIC_PROTECTED_ROUTES="/dashboard,/profile,/settings"
ARG NEXT_PUBLIC_PUBLIC_ROUTES="/,/login,/register,/health"
ARG NEXT_PUBLIC_API_MOCKING="false"
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID="339777945783-2ppsau7efs2nr6kruoq8vnithkej2j00.apps.googleusercontent.com"

ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_TIMEOUT=$NEXT_PUBLIC_API_TIMEOUT
ENV NEXT_PUBLIC_MAIN_DOMAIN=$NEXT_PUBLIC_MAIN_DOMAIN
ENV NEXT_PUBLIC_PROTECTED_ROUTES=$NEXT_PUBLIC_PROTECTED_ROUTES
ENV NEXT_PUBLIC_PUBLIC_ROUTES=$NEXT_PUBLIC_PUBLIC_ROUTES
ENV NEXT_PUBLIC_API_MOCKING=$NEXT_PUBLIC_API_MOCKING
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Minimal Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
