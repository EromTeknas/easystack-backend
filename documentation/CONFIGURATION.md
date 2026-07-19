# Application Configuration

All runtime environment access is centralized in `src/config`.

## Rules

- Only `src/config/env.ts` reads `process.env` and loads dotenv.
- Application code imports typed configuration objects from `src/config`.
- Services, routes, middleware, workers, and database adapters must not read environment variables directly.
- Add new environment variables to the Zod schema in `src/config/env.ts`, then expose a domain-oriented object from an appropriate config module.
- Keep business constants separate from deployment configuration.

## Configuration modules

| Module | Purpose |
|---|---|
| `env.ts` | Loads `.env` once and validates/coerces raw values |
| `app.ts` | Server, environment, logging, and application URLs |
| `cors.ts` | Allowed origins, methods, headers, credentials, and preflight caching |
| `auth.ts` | JWT, cookies, OTP, password reset, and auth limits |
| `mysql.ts` | Runtime MySQL connection |
| `mongo.ts` | MongoDB connection |
| `redis.ts` | Redis/BullMQ connection settings; the shared application client lives in `src/db/redis.ts` |
| `storage.ts` | Canonical object-storage and CDN configuration |
| `email.ts` | Brevo and sender configuration |
| `google-auth.ts` | Google OAuth client configuration |
| `billing.ts` | Billing job configuration |
| `workers.ts` | Standalone worker group selection (`email`, `storage`, or `all`) |

Prefer importing from the barrel:

```ts
import { app, corsConfig, storageConfig } from "../config";
```

Direct imports from a root config module are also acceptable when they avoid loading unrelated infrastructure:

```ts
import { auth } from "../config/auth";
```

## CORS

Multiple origins can be supplied as a comma-separated list:

```env
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,x-request-id
CORS_EXPOSED_HEADERS=x-request-id
CORS_CREDENTIALS=true
CORS_MAX_AGE_SECONDS=86400
```

Requests without an `Origin` header, such as server-to-server and curl requests, are allowed. Browser origins must exactly match a configured normalized origin. Cookies require a specific origin; do not combine credentials with a wildcard origin.

The same origin list is reused to validate authentication redirect URLs.

## Object storage

`storage.ts` is the single source of truth for both the intent-based storage module and the legacy `S3Service` compatibility view:

```env
STORAGE_CDN_BASE_URL=http://localhost:8081
STORAGE_PRIVATE_URL_EXPIRY_SECONDS=300
STORAGE_S3_BUCKET=easystack
STORAGE_S3_REGION=us-east-1
STORAGE_S3_INTERNAL_ENDPOINT=http://localhost:9000
STORAGE_S3_PUBLIC_ENDPOINT=http://localhost:9000
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_ACCESS_KEY_ID=easystack
STORAGE_S3_SECRET_ACCESS_KEY=easystack-secret
STORAGE_S3_SESSION_TOKEN=
```

- `INTERNAL_ENDPOINT` is used for backend object operations.
- `PUBLIC_ENDPOINT` is embedded in browser-facing presigned URLs.
- For AWS, endpoints and static credentials may be omitted when using the standard endpoint and IAM credential chain.
- `S3_*` names remain temporary fallback aliases for older deployments, but new configuration should use only `STORAGE_S3_*`.

## Adding configuration

1. Add and validate the raw environment value in `env.ts`.
2. Add it to the relevant typed config object, or create a focused root config module.
3. Export the object from `src/config/index.ts` when a barrel import is useful.
4. Update `.env.example` without adding secrets.
5. Import the typed config object in consumers.
6. Verify with:

```bash
rg 'process\.env|dotenv/config|dotenv\.config' src --glob '*.ts'
```

Only `src/config/env.ts` should be returned.
