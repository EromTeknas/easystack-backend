# Queue Workers

The queue architecture uses three boundaries:

1. Shared BullMQ infrastructure provides queue caching, enqueue behavior, worker lifecycle logging, Redis configuration, and shutdown.
2. Each service owns its job contracts, queue names, producers, processors, retry policies, and worker composition.
3. A standalone worker application selects service-owned worker groups through a lazy registry.

## Structure

```text
src/
├── infrastructure/queue/
│   ├── QueueDescriptor.ts
│   ├── QueueClient.ts
│   ├── QueueWorkerFactory.ts
│   ├── closeQueues.ts
│   └── index.ts
│
├── services/email/infrastructure/queue/
│   ├── email.jobs.ts
│   ├── email.producer.ts
│   ├── email.processor.ts
│   └── createEmailWorkers.ts
│
├── services/storage/infrastructure/queue/
│   ├── storage.jobs.ts
│   ├── storage.producer.ts
│   ├── storage.processor.ts
│   ├── createStorageWorkers.ts
│   └── BullMqStorageCleanupScheduler.ts
│
└── workers/
    ├── registry.ts
    ├── main.ts
    └── register-schedules.ts
```

Generic BullMQ mechanics are centralized, but job semantics remain with their owning service. The worker bootstrap never assembles storage or email dependencies itself; it asks the module registry to create a group.

## Running workers

```bash
# Email only
npm run worker:email

# Storage only
npm run worker:storage

# Both groups in one process
npm run worker:all

# Alias for worker:all
npm run worker
```

The raw entrypoint accepts `email`, `storage`, or `all`:

```bash
ts-node src/workers/main.ts email
```

Without a CLI argument, `WORKER_GROUP` is used and defaults to `all`.

## Registering schedules

Repeatable schedule registration is separate from job processing:

```bash
npm run queues:register-schedules
```

Run this once during deployment or application provisioning. It registers hourly storage reconciliation and closes its producer connection. Multiple storage worker replicas only process jobs; they do not each attempt to register schedules.

Local `npm run dev` registers schedules before starting the API and separate email/storage worker processes.

## Queues and jobs

| Queue | Jobs | Owner |
|---|---|---|
| `email` | `SEND_OTP_EMAIL`, `SEND_PASSWORD_RESET_EMAIL`, `SEND_WELCOME_EMAIL` | Email service |
| `storage-cleanup` | `delete-object`, `reconcile-storage` | Storage service |

Transactional emails share one queue because they use the same provider and have the same retry, retention, and scaling characteristics. Create a separate queue only when workloads require different concurrency, rate limiting, priority, pause/resume, or independent scaling.

Storage cleanup and reconciliation share one queue for V1. They can later move to `storage-cleanup` and `storage-maintenance` if reconciliation starts delaying deletions.

> The previous three email queue names are no longer consumed. Drain or remove old `email-otp-queue`, `password-reset-queue`, and `welcome-email-queue` jobs before deploying this queue-name change in an environment with pending jobs.

## API and worker separation

API-side code imports only a service-owned producer. For example, authentication's BullMQ notifier imports the email producer; it never imports a worker processor.

Deployment can use one image with different commands:

```text
API               npm start
Email workers     npm run worker:email
Storage workers   npm run worker:storage
Schedule setup    npm run queues:register-schedules
```

The lazy registry ensures an email-only worker does not load Prisma or storage infrastructure. Storage shutdown is registered by the storage group and owns its Prisma disconnection.

## Processors

Processors are standalone classes, separate from BullMQ worker construction:

- `EmailJobProcessor` dispatches by email job name.
- `StorageJobProcessor` handles deletion and reconciliation.

This makes processing logic testable with mock `Job` objects and mock dependencies without Redis or live BullMQ workers. Worker factory functions contain only dependency composition and worker wiring.

## Shared infrastructure behavior

`QueueClient` provides:

- One cached producer `Queue` instance per queue name and process.
- Central enqueue start/success logging.
- Descriptor defaults merged with per-job options.
- Central producer queue shutdown.

`createQueueWorker` provides:

- Shared Redis options.
- Configurable concurrency.
- Ready, active, completed, failed, stalled, and worker-error logs.
- Consistent worker identity and group metadata.

## Adding jobs

1. Add the payload, descriptor, retry policy, and safe log projection inside the owning service's `infrastructure/queue` folder.
2. Add or update the module-local producer.
3. Add processing behavior to a testable module-local processor.
4. Wire the processor in the module's `create...Workers` factory.
5. Add a new registry group only when it needs independent process scaling.
6. Register repeatable schedules through `register-schedules.ts`, never during worker creation.

Do not log OTPs, reset tokens, credentials, presigned URLs, signatures, or complete sensitive payloads.

## Operations

- BullMQ 5 recommends Redis 6.2 or newer.
- Monitor failed and stalled jobs.
- Deploy worker support before producers begin emitting a new job name.
- Run schedule registration during deployment.
- Terminate with `SIGINT` or `SIGTERM`; workers, producer queues, and group-owned dependencies close gracefully.
