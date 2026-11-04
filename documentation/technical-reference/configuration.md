# Application Configuration Reference

All runtime environment access is strictly centralized in [`src/config/`](file:///home/eteknas/Projects/easystack-backend/src/config). Direct calls to `process.env` outside of [`src/config/env.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/env.ts) are strictly prohibited.

---

## 1. Architectural Rules for Configuration

1. **Single Entry Point**: Only `src/config/env.ts` reads `process.env` and loads `.env`. It validates and coerces values using a typed **Zod schema**.
2. **Domain-Specific Config Modules**: Submodules in `src/config/` import the validated `env` object and export domain-oriented structures (e.g., `authConfig`, `storageConfig`).
3. **No Direct `process.env` Access**: Never use `process.env.VARIABLE_NAME` in routes, services, or controllers.
4. **Validation Invariant**: If a required environment variable is missing or malformed on startup, the application immediately throws an informative Zod validation error and refuses to start.

---

## 2. Configuration Submodules

| Module | Purpose | Key Exports |
|---|---|---|
| [`src/config/env.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/env.ts) | Zod schema validating and coercing all raw `.env` strings | `env` |
| [`src/config/app.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/app.ts) | Port, environment (`local`, `dev`, `stage`, `prod`), logging | `app` |
| [`src/config/cors.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/cors.ts) | Normalized allowed origins, headers, credentials, preflight cache | `corsConfig` |
| [`src/config/auth.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/auth.ts) | JWT secrets, token expiries (15m/7d), OTP length and TTL | `auth` |
| [`src/config/mysql.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/mysql.ts) | MySQL connection credentials and pool sizes | `mysqlConfig` |
| [`src/config/mongo.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/mongo.ts) | MongoDB connection URI and replica set options | `mongoConfig` |
| [`src/config/redis.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/redis.ts) | Redis host, port, db, password for caching and BullMQ | `redisConnectionOptions` |
| [`src/config/storage.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/storage.ts) | S3/MinIO bucket, region, internal/public endpoints, CDN URL | `storageConfig` |
| [`src/config/storage.presets.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/storage.presets.ts) | Upload slot limits, maximum byte sizes, and MIME whitelists | `storagePresets` |
| [`src/config/email.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/email.ts) | Brevo API key, sender email, and reply-to address | `emailConfig` |
| [`src/config/google-auth.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/google-auth.ts) | Google OAuth Client ID for token validation | `googleAuthConfig` |
| [`src/config/bull-board.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/bull-board.ts) | Bull-board Express adapter mounted at `/admin/queues` | `setupBullBoard` |

---

## 3. Environment Variables Directory

### Server & Runtime
- `PORT`: HTTP port (default: `3000`)
- `ENVIRONMENT`: Environment identifier (`local`, `dev`, `stage`, `prod`)
- `LOG_LEVEL`: Logging verbosity (`info`, `debug`, `warn`, `error`)

### Databases
- `DATABASE_URL`: MySQL connection string for Prisma (`mysql://user:pass@localhost:3306/easystack`)
- `SHADOW_DATABASE_URL`: Shadow database for Prisma migration development
- `MONGODB_URI`: MongoDB connection string (`mongodb://localhost:27017/easystack`)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`: Redis connection parameters

### Security & Tokens
- `JWT_SECRET`: Signing secret for 15-minute access tokens
- `JWT_REFRESH_SECRET`: Signing secret for 7-day refresh tokens
- `GOOGLE_CLIENT_ID`: OAuth Client ID for verifying Google Sign-in ID tokens

### Storage & S3
- `STORAGE_S3_BUCKET`: S3 Bucket name (`easystack`)
- `STORAGE_S3_REGION`: S3 AWS region (`us-east-1`)
- `STORAGE_S3_INTERNAL_ENDPOINT`: Internal endpoint used by backend (`http://localhost:9000`)
- `STORAGE_S3_PUBLIC_ENDPOINT`: Public endpoint embedded in browser presigned URLs
- `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`: S3 / MinIO credentials
- `STORAGE_CDN_BASE_URL`: Public CDN edge URL for resolved public assets

### External Services
- `BREVO_API_KEY`: Brevo email transactional delivery API key
- `STRIPE_SECRET_KEY`: Stripe API secret key
- `STRIPE_WEBHOOK_SECRET`: Signing secret for verifying Stripe webhook events
- `GEMINI_API_KEY`: Google Gemini API key for AI auto-translation service

---

## 4. How to Add a New Environment Variable

1. Open [`src/config/env.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/env.ts) and add the field with its validation type to `envSchema`:
   ```typescript
   NEW_FEATURE_TIMEOUT_MS: z.coerce.number().default(5000)
   ```
2. Expose the variable through an appropriate domain config module (or [`src/config/app.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/app.ts)):
   ```typescript
   export const app = {
     timeoutMs: env.NEW_FEATURE_TIMEOUT_MS
   };
   ```
3. Update [`.env.example`](file:///home/eteknas/Projects/easystack-backend/.env.example) with a sanitized default.
4. Verify no code bypassed `src/config`:
   ```bash
   rg 'process\.env' src --glob '!src/config/env.ts'
   ```
   *(Must return 0 matches)*.
