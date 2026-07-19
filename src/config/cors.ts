import type { CorsOptions } from "cors";
import { env } from "./env";

function csv(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

const allowedOrigins = csv(env.CORS_ORIGIN).map(normalizeOrigin);

export const corsConfig = {
  allowedOrigins,
  methods: csv(env.CORS_METHODS),
  allowedHeaders: csv(env.CORS_ALLOWED_HEADERS),
  exposedHeaders: csv(env.CORS_EXPOSED_HEADERS),
  credentials: env.CORS_CREDENTIALS,
  maxAge: env.CORS_MAX_AGE_SECONDS,
  options: {
    origin(origin, callback) {
      try {
        if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
          callback(null, true);
          return;
        }
        callback(null, false);
      } catch {
        callback(null, false);
      }
    },
    methods: csv(env.CORS_METHODS),
    allowedHeaders: csv(env.CORS_ALLOWED_HEADERS),
    exposedHeaders: csv(env.CORS_EXPOSED_HEADERS),
    credentials: env.CORS_CREDENTIALS,
    maxAge: env.CORS_MAX_AGE_SECONDS,
  } satisfies CorsOptions,
} as const;

export const applicationOrigins = [...new Set([
  ...allowedOrigins,
  env.FRONTEND_URL,
  env.APP_FRONTEND_URL,
].filter((value): value is string => Boolean(value)).map(normalizeOrigin))];
