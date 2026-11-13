import type { CorsOptions } from "cors";
import { env } from "./env";

function csv(value: string): string[] {
  if (!value) return [];
  const cleaned = value.trim().replace(/^["']|["']$/g, "");
  return [...new Set(cleaned.split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean))];
}

function normalizeOrigin(value: string): string {
  const cleaned = value.trim().replace(/^["']|["']$/g, "");
  return new URL(cleaned).origin;
}

const allowedOrigins = csv(env.CORS_ORIGIN).map(normalizeOrigin);

export const applicationOrigins = [...new Set([
  ...allowedOrigins,
  env.FRONTEND_URL,
  env.APP_FRONTEND_URL,
].filter((value): value is string => Boolean(value)).map(normalizeOrigin))];

export function isOriginAllowed(origin: string): boolean {
  if (!origin) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const normalized = originUrl.origin;

  for (const allowed of applicationOrigins) {
    if (normalized === allowed) {
      return true;
    }

    try {
      const allowedUrl = new URL(allowed);
      if (originUrl.protocol === allowedUrl.protocol && originUrl.port === allowedUrl.port) {
        if (
          originUrl.hostname.endsWith(`.${allowedUrl.hostname}`) ||
          (allowedUrl.hostname === "localhost" && originUrl.hostname.endsWith(".localhost"))
        ) {
          return true;
        }

        const allowedParts = allowedUrl.hostname.split(".");
        if (allowedParts.length > 2 && allowedParts[allowedParts.length - 1] !== "localhost") {
          const rootDomain = allowedParts.slice(-2).join(".");
          if (originUrl.hostname.endsWith(`.${rootDomain}`)) {
            return true;
          }
        }
      }
    } catch {
      // Continue checking other origins
    }
  }

  return false;
}

const defaultAllowedHeaders = [
  "Content-Type",
  "Authorization",
  "x-request-id",
  "x-api-key",
  "x-environment-id",
];
const allowedHeaders = [...new Set([...defaultAllowedHeaders, ...csv(env.CORS_ALLOWED_HEADERS)])];
const exposedHeaders = [...new Set(["x-request-id", ...csv(env.CORS_EXPOSED_HEADERS)])];

export const corsConfig = {
  allowedOrigins,
  methods: csv(env.CORS_METHODS),
  allowedHeaders,
  exposedHeaders,
  credentials: env.CORS_CREDENTIALS,
  maxAge: env.CORS_MAX_AGE_SECONDS,
  options: {
    origin(origin, callback) {
      try {
        if (!origin || isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      } catch {
        callback(null, false);
      }
    },
    methods: csv(env.CORS_METHODS),
    allowedHeaders,
    exposedHeaders,
    credentials: env.CORS_CREDENTIALS,
    maxAge: env.CORS_MAX_AGE_SECONDS,
  } satisfies CorsOptions,
} as const;
