# EasyStack Backend – AI Coding Instructions

## Architecture (big picture)
- Express app entrypoint is `src/server.ts`; it initializes Mongo + MySQL + Prisma via `initDatabases()` from `src/db/index.ts` before mounting routes.
- Routes are feature-foldered under `src/routes/*` and mounted in `src/routes/index.ts` under `/api`.
- Auth flows use Redis + BullMQ queues for OTP/welcome/reset emails (workers in `src/workers/index.worker.ts`, queues in `src/queues/*`, mail in `src/services/email.service.ts`).
- Request context uses AsyncLocalStorage: `request-context.middleware.ts` assigns `x-request-id` and logs include it.

## Conventions & patterns
- Keep constants in dedicated files under `src/constants/` (add new files for new constant groups).
- Always wrap async route handlers with `asyncHandler` from `src/utils/asyncHandler.ts` (no try/catch in routes).
- Throw `AppError` subclasses from `src/errors/*` (see `documentation/ERROR_HANDLING.md`). Avoid returning ad-hoc error shapes.
- Successful responses should use `ok()` from `src/utils/response.ts` to include `requestId` consistently.
- Error responses are shaped by `error-handler.middleware.ts` and include `{ success:false, error:{ message, code, statusCode, details?, requestId } }`.
- Middleware order matters: request context → routes → notFound → error handler (see `src/server.ts`).
- Always update docs in `documentation/` when behavior changes; edit existing docs instead of deprecating (v1 POC).

## DateTime & timezone standards (CRITICAL)
- **ALL datetime values MUST be in UTC** across the entire backend (database, API requests, API responses, internal processing).
- **Request handling**: Always expect datetime inputs from frontend in UTC (ISO 8601 format with 'Z' suffix, e.g., `2026-02-15T10:30:00.000Z`).
- **Response serialization**: Always send datetime values in UTC (ISO 8601 with 'Z' suffix). Use `.toISOString()` for JavaScript Date objects.
- **Database storage**: All MySQL DateTime fields store UTC timestamps via Prisma `DateTime` type mapped to `DATETIME(3)`. MySQL stores these as-is (no timezone conversion).
- **Internal processing**: Use `new Date()` for current UTC time, `Date.now()` for Unix timestamps. Never use locale-specific date methods or timezone conversions.
- **JWT tokens**: Use Unix timestamps (`Math.floor(Date.now() / 1000)`) for `iat` and `exp` claims.
- **Prisma defaults**: `@default(now())` generates UTC timestamps at insertion time.
- **No timezone logic**: Backend does NOT perform timezone conversions. Client-side is responsible for displaying times in user's local timezone.

## Data & integrations
- MySQL is accessed via Prisma client (`src/db/prisma.ts`) and mysql2 pool (`src/db/mysql.ts` for legacy/CLI).
- MongoDB uses Mongoose (`src/db/mongo.ts`).
- Redis is required for BullMQ queues and OTP/reset flows (see `src/config/redis.ts`).
- Email is sent via Brevo (Sendinblue) in `src/services/email.service.ts`.

## Developer workflows
- Dev server (ts-node + nodemon): `npm run dev`.
- Build: `npm run build`; prod start: `npm start`.
- Prisma: `npm run prisma:migrate`, `npm run prisma:generate`.
- Workers: `npm run worker` (optionally set `WORKER_QUEUES=email-otp,password-reset`).
- Logs are written to `storage/logs/` with Winston daily rotation.
- If any endpoint is created/updated/deleted, update API docs: `openapi.json` and `EasyStack-Backend-API.postman_collection.json`.

## Where to look first
- API entrypoint & middleware: `src/server.ts`.
- Auth flow and queue usage: `documentation/AUTHENTICATION.md` + `src/queues/*` + `src/workers/*`.
- Error system: `documentation/ERROR_HANDLING.md` + `src/errors/*` + `src/middlewares/error-handler.middleware.ts`.
- Config validation & env wiring: `src/config/*`.
