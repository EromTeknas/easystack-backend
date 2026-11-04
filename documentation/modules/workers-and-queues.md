# Background Workers & Queues Module

## 1. Purpose & Responsibilities

The **Background Workers & Queues Module** provides asynchronous, decoupled job execution across EasyStack. Powered by **BullMQ** and backed by **Redis**, it offloads long-running, external, or scheduled tasks from the main HTTP API server.

### Core Responsibilities
- Centralize generic BullMQ queue connections, worker lifecycle logging, retries, and graceful shutdown.
- Maintain a modular registry of service-owned worker groups ([`src/workers/registry.ts`](file:///home/eteknas/Projects/easystack-backend/src/workers/registry.ts)).
- Support standalone worker processes scaled independently of the Express API.
- Execute recurring cron jobs and repeatable schedulers ([`src/workers/register-schedules.ts`](file:///home/eteknas/Projects/easystack-backend/src/workers/register-schedules.ts)).
- Provide visual operational monitoring via **Bull-Board** mounted at `/admin/queues`.

---

## 2. File Responsibility Map

```text
src/
├── infrastructure/queue/               # Shared BullMQ mechanical abstractions
│   ├── QueueClient.ts                  # Shared Queue instantiator with connection pooling
│   ├── QueueDescriptor.ts              # Typed queue descriptor contracts
│   ├── QueueWorkerFactory.ts           # Factory instantiating BullMQ Workers with standard logging
│   ├── closeQueues.ts                  # Graceful drain and close helper on process termination
│   └── index.ts                        # Barrel export
│
├── workers/                            # Standalone worker application
│   ├── registry.ts                     # Lazy registry for worker groups: email, storage, translation, cleanup, release
│   ├── main.ts                         # CLI entry point: ts-node src/workers/main.ts <group>
│   └── register-schedules.ts           # Registers repeatable jobs in Redis
│
├── config/
│   └── bull-board.ts                   # Mounts Bull-Board dashboard at /admin/queues
│
└── services/*/infrastructure/queue/   # Service-owned job definitions and processors
    ├── email/infrastructure/queue/     # Email queue, producer, processor, and worker pool
    ├── storage/infrastructure/queue/   # Storage GC queue, reconciliation, and retention
    ├── feed/infrastructure/queue/      # Feed translation queue and LLM worker pool
    ├── cleanup/infrastructure/queue/   # Workspace & Project cascade purge worker
    └── releases/infrastructure/queue/  # Scheduled deployment queue and release worker
```

---

## 3. The 5 Worker Groups

| Group | Key | Worker Factory | Associated Jobs | CLI Command |
|---|---|---|---|---|
| **Email** | `email` | `createEmailWorkers()` | Sends OTP codes, welcome messages, password reset links, invitations | `npm run worker:email` |
| **Storage** | `storage` | `createStorageWorkers()` | Hourly reconciliation of expired upload intents, deletion of abandoned S3 files, 30-day intent retention purge | `npm run worker:storage` |
| **Translation**| `translation` | `createTranslationWorkers()` | Batch translates JSON feeds by locale via LLM Service (Gemini) | `npm run worker:translation` |
| **Cleanup** | `cleanup` | `createCleanupWorkers()` | Cascades deletions to MongoDB (versions, comments, audit logs) and S3 assets upon project/workspace removal | `npm run worker:cleanup` |
| **Release** | `release` | `startReleaseWorker()` | Executes scheduled environment deployments every minute | `npm run worker:release` |

To run all worker groups in a single unified process (e.g., during development):
```bash
npm run worker:all
# or
npm run worker
```

---

## 4. Repeatable Queue Schedules

Recurring cron jobs are registered into Redis before application startup via `src/workers/register-schedules.ts`:

1. **Storage Hourly Reconciliation**:
   Runs every hour. Finds `UploadIntent` records in `PENDING` status older than 1 hour, deletes their uploaded S3 keys, and transitions them to `CLEANED`.
2. **Storage Daily Retention Purge**:
   Runs daily at midnight. Purges `UploadIntent` records that have been in `CLEANED` status for more than 30 days (`STORAGE_CLEANED_INTENT_RETENTION_DAYS`).
3. **Release Execution Cron**:
   Runs every minute (`* * * * *`). Queries for scheduled releases whose execution timestamp has elapsed and executes environment deployment.

---

## 5. Bull-Board Visual Monitoring

EasyStack mounts an administrative dashboard for queue inspection using `@bull-board/express` in [`src/config/bull-board.ts`](file:///home/eteknas/Projects/easystack-backend/src/config/bull-board.ts):

- **Path**: `http://localhost:3000/admin/queues`
- **Monitored Queues**:
  - `translation`
  - `email`
  - `storage`
  - `cleanup`
  - `scheduled-release`
  - `deployment`
- Allows developers and operators to inspect active, waiting, completed, and failed jobs, view error stack traces, and manually retry failed tasks.
