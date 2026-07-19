import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional(),
);

const booleanString = (defaultValue: boolean) => z.preprocess((value) => {
  if (value === undefined || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value;
}, z.boolean());

const optionalBooleanString = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value;
}, z.boolean().optional());

const EnvironmentSchema = z.object({
  APP_NAME: z.string().default("easystack-backend"),
  ENVIRONMENT: z.enum(["local", "dev", "stage", "prod"]).default("local"),
  NODE_ENV: optionalString,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["error", "warn", "info", "verbose", "debug", "silly"]).default("info"),
  LOG_DIR: z.string().default("storage/logs"),
  LOG_IDENTIFIER: z.string().default("easystack"),
  BASE_URL: z.string().url().default("http://localhost:3001"),
  PASSWORD_RESET_URL: z.string().url().default("http://localhost:3000/reset-password"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  CORS_METHODS: z.string().default("GET,POST,PUT,PATCH,DELETE,OPTIONS"),
  CORS_ALLOWED_HEADERS: z.string().default("Content-Type,Authorization,x-request-id"),
  CORS_EXPOSED_HEADERS: z.string().default("x-request-id"),
  CORS_CREDENTIALS: booleanString(true),
  CORS_MAX_AGE_SECONDS: z.coerce.number().int().min(0).default(86400),
  FRONTEND_URL: optionalUrl,
  APP_FRONTEND_URL: optionalUrl,

  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_APP_USER: optionalString,
  MYSQL_APP_PASSWORD: optionalString,
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default("easystack"),
  MONGO_URI: z.string(),

  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: optionalString,
  REDIS_DB: z.coerce.number().int().min(0).default(10),

  JWT_SECRET: z.string().default("your-secret-key-change-in-production"),
  JWT_REFRESH_SECRET: z.string().default("your-refresh-secret-key-change-in-production"),
  ACCESS_TOKEN_EXPIRY_MINUTES: z.coerce.number().int().positive().optional(),
  REFRESH_TOKEN_EXPIRY_MINUTES: z.coerce.number().int().positive().optional(),
  ACCESS_TOKEN_EXPIRY: z.coerce.number().int().positive().optional(),
  REFRESH_TOKEN_EXPIRY: z.coerce.number().int().positive().optional(),
  PASSWORD_RESET_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),
  AUTH_COOKIE_DOMAIN: optionalString,
  AUTH_COOKIE_PATH: z.string().default("/"),
  AUTH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("strict"),
  AUTH_COOKIE_SECURE: optionalBooleanString,
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  GOOGLE_AUTH_CLIENT_ID: z.string().default(""),

  BREVO_API_KEY: optionalString,
  BREVO_SENDER_EMAIL: z.string().email().default("team@eromstudio.in"),
  BREVO_SENDER_NAME: z.string().default("EasyStack by Erom Studio"),

  STORAGE_CDN_BASE_URL: z.string().url().default("http://localhost:8081"),
  STORAGE_PRIVATE_URL_EXPIRY_SECONDS: z.coerce.number().int().min(1).max(3600).default(300),
  STORAGE_S3_BUCKET: optionalString,
  STORAGE_S3_REGION: optionalString,
  STORAGE_S3_INTERNAL_ENDPOINT: optionalUrl,
  STORAGE_S3_PUBLIC_ENDPOINT: optionalUrl,
  STORAGE_S3_FORCE_PATH_STYLE: optionalBooleanString,
  STORAGE_S3_ACCESS_KEY_ID: optionalString,
  STORAGE_S3_SECRET_ACCESS_KEY: optionalString,
  STORAGE_S3_SESSION_TOKEN: optionalString,

  // Legacy aliases retained during migration to STORAGE_S3_*.
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  S3_ENDPOINT: optionalUrl,
  S3_FORCE_PATH_STYLE: optionalBooleanString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_SESSION_TOKEN: optionalString,

  WORKER_GROUP: optionalString,
  BILLING_RESET_TEST_MODE: booleanString(false),
});

export const env = EnvironmentSchema.parse(process.env);
export type Environment = z.infer<typeof EnvironmentSchema>;
