# How to Use Queues and Workers

This guide shows how application code adds queue jobs and how worker processes handle them.

## The basic idea

The API and workers have different responsibilities:

```text
API or service
    ↓ calls a producer function
Job is stored in Redis
    ↓
Standalone worker
    ↓ calls a processor
Email, storage cleanup, or other background work happens
```

Application code should enqueue jobs through a producer. It should not create BullMQ `Queue` or `Worker` objects directly.

---

## Commands

Start only email workers:

```bash
npm run worker:email
```

Start only storage workers:

```bash
npm run worker:storage
```

Start every worker group in one process:

```bash
npm run worker:all
```

Register recurring jobs once during deployment:

```bash
npm run queues:register-schedules
```

Local development starts the API and separate email/storage workers:

```bash
npm run dev
```

Redis must be running before producers or workers can use queues.

---

## Sending email jobs

Import email producer functions from:

```ts
import {
  enqueueSendOtpEmailJob,
  enqueueSendPasswordResetEmailJob,
  enqueueSendWelcomeEmailJob,
} from "../services/email/infrastructure/queue/email.producer";
```

Adjust the relative path based on the importing file.

### Send an OTP email

```ts
await enqueueSendOtpEmailJob({
  email: "user@example.com",
  firstName: "Sanket",
  otpCode: "123456",
});
```

Parameters:

| Parameter | Type | Meaning |
|---|---|---|
| `email` | `string` | Recipient email address |
| `firstName` | `string` | Recipient name used in the template |
| `otpCode` | `string` | OTP that the email worker sends |

Do not log `otpCode`.

### Send a password-reset email

```ts
await enqueueSendPasswordResetEmailJob({
  email: "user@example.com",
  firstName: "Sanket",
  token: passwordResetToken,
});
```

Parameters:

| Parameter | Type | Meaning |
|---|---|---|
| `email` | `string` | Recipient email address |
| `firstName` | `string` | Recipient name used in the template |
| `token` | `string` | Secret password-reset token |

Do not log the reset token.

### Send a welcome email

```ts
await enqueueSendWelcomeEmailJob({
  email: "user@example.com",
  firstName: "Sanket",
});
```

All three email jobs use the `email` queue. The worker chooses the correct handler from the job name.

### Recommended application dependency

Authentication already hides these producer calls behind its notifier adapter:

```text
src/services/authentication/adapters/bullmq-authentication.notifier.ts
```

Domain services should usually depend on an application interface such as a notifier. The BullMQ adapter then calls the concrete producer. This keeps BullMQ out of business logic.

---

## Scheduling storage deletion

Most application code should not import the storage queue producer directly. It should use the storage cleanup port:

```ts
import type {
  ScheduleObjectDeletionInput,
  StorageCleanupScheduler,
} from "../services/storage/ports/StorageCleanupScheduler";
```

The concrete BullMQ adapter is:

```ts
import { BullMqStorageCleanupScheduler } from
  "../services/storage/infrastructure/queue/BullMqStorageCleanupScheduler";
```

Create the adapter during dependency composition:

```ts
const cleanupScheduler: StorageCleanupScheduler =
  new BullMqStorageCleanupScheduler();
```

Schedule a deletion:

```ts
await cleanupScheduler.scheduleObjectDeletion({
  objectKey: "private/users/1/avatar/ast_123.jpg",
  assetId: "ast_123",
  reason: StorageDeletionReason.USER_REQUESTED_DELETION,
});
```

Import deletion reasons with:

```ts
import {
  StorageDeletionReason,
} from "../services/storage/ports/StorageCleanupScheduler";
```

### Deletion parameters

```ts
interface ScheduleObjectDeletionInput {
  objectKey: string;
  reason: StorageDeletionReason;
  assetId?: string;
  uploadIntentId?: string;
}
```

| Parameter | Required? | Meaning |
|---|---|---|
| `objectKey` | Yes | Exact object key to delete from S3/MinIO |
| `reason` | Yes | Why cleanup was requested |
| `assetId` | No | Include when deleting a persisted asset |
| `uploadIntentId` | No | Include when cleaning an expired upload intent |

Use `assetId` for asset deletion:

```ts
await cleanupScheduler.scheduleObjectDeletion({
  objectKey: replacedAsset.objectKey,
  assetId: replacedAsset.id,
  reason: StorageDeletionReason.REPLACED_BY_NEW_ASSET,
});
```

Use `uploadIntentId` for expired-upload cleanup:

```ts
await cleanupScheduler.scheduleObjectDeletion({
  objectKey: uploadObjectKey,
  uploadIntentId: uploadIntent.id,
  reason: StorageDeletionReason.EXPIRED_UPLOAD,
});
```

The deletion worker first deletes the object, then transactionally updates the asset or upload intent. See [STORAGE_INTENT_LIFECYCLE.md](STORAGE_INTENT_LIFECYCLE.md) for the full lifecycle.

---

## Queue definitions

Every job is described by a `QueueDescriptor<TData>`:

```ts
import type {
  QueueDescriptor,
} from "../infrastructure/queue";
```

The descriptor contains:

```ts
interface QueueDescriptor<TData> {
  queueName: string;
  jobName: string;
  defaultJobOptions: JobsOptions;
  describe(data: TData): Record<string, unknown>;
}
```

| Field | Meaning |
|---|---|
| `queueName` | Redis/BullMQ queue that stores the job |
| `jobName` | Job type used by the processor to dispatch work |
| `defaultJobOptions` | Attempts, backoff, retention, priority, and similar options |
| `describe` | Safe metadata added to queue logs |

Example job definition:

```ts
export interface GenerateReportJobData {
  reportId: string;
  requestedById: string;
}

export const generateReportJob: QueueDescriptor<GenerateReportJobData> = {
  queueName: "report-generation",
  jobName: "GENERATE_REPORT",
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1_000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
  describe: ({ reportId, requestedById }) => ({
    reportId,
    requestedById,
  }),
};
```

Never include secrets or complete sensitive payloads in `describe`.

---

## Creating a producer

Import the shared queue client:

```ts
import {
  queueClient,
} from "../infrastructure/queue";
```

Create a small producer function:

```ts
import { queueClient } from "../../../../infrastructure/queue";
import {
  GenerateReportJobData,
  generateReportJob,
} from "./report.jobs";

export function enqueueGenerateReport(
  data: GenerateReportJobData,
): Promise<void> {
  return queueClient.enqueue(generateReportJob, data);
}
```

The generic enqueue method accepts:

```ts
queueClient.enqueue(descriptor, data, optionalJobOptions);
```

- `descriptor`: the job definition.
- `data`: payload matching the descriptor's TypeScript type.
- `optionalJobOptions`: per-job BullMQ options that override descriptor defaults.

Example with a stable application job ID:

```ts
return queueClient.enqueue(generateReportJob, data, {
  jobId: `report-${data.reportId}`,
});
```

Be careful with retained jobs and stable IDs. A completed or failed retained job with the same ID can prevent a new job from being added. Use short BullMQ deduplication when the same work may need to be scheduled again:

```ts
return queueClient.enqueue(generateReportJob, data, {
  deduplication: {
    id: `report:${data.reportId}`,
    ttl: 5 * 60 * 1_000,
  },
});
```

---

## Creating a processor

Keep processing logic separate from worker construction.

```ts
import type { Job } from "bullmq";
import {
  GenerateReportJobData,
  generateReportJob,
} from "./report.jobs";

export class ReportJobProcessor {
  constructor(
    private readonly reportService: ReportService,
  ) {}

  async process(
    job: Job<GenerateReportJobData>,
  ): Promise<void> {
    if (job.name !== generateReportJob.jobName) {
      throw new Error(`Unsupported report job: ${job.name}`);
    }

    await this.reportService.generate(job.data.reportId);
  }
}
```

Constructor injection makes the processor testable without Redis:

```ts
const processor = new ReportJobProcessor(mockReportService);

await processor.process(mockJob);
```

Throw an error when processing fails. BullMQ uses the thrown error to mark the attempt as failed and apply retry policy.

---

## Creating workers for a module

Import the shared worker factory:

```ts
import {
  createQueueWorker,
} from "../infrastructure/queue";
```

Create dependencies and connect the processor:

```ts
import type { Worker } from "bullmq";
import { createQueueWorker } from "../../../../infrastructure/queue";
import { reportService } from "../../report.service";
import { REPORT_QUEUE_NAME } from "./report.jobs";
import { ReportJobProcessor } from "./report.processor";

export function createReportWorkers(): Worker[] {
  const processor = new ReportJobProcessor(reportService);

  return [
    createQueueWorker({
      id: "report-generation",
      group: "report",
      queueName: REPORT_QUEUE_NAME,
      processor: processor.process.bind(processor),
      concurrency: 2,
    }),
  ];
}
```

Worker factory parameters:

| Parameter | Required? | Meaning |
|---|---|---|
| `id` | Yes | Unique name used in logs |
| `group` | Yes | Independently runnable worker group |
| `queueName` | Yes | Queue consumed by this worker |
| `processor` | Yes | Function that handles BullMQ jobs |
| `concurrency` | No | Jobs processed concurrently by this worker instance |

The factory automatically adds ready, active, completed, failed, stalled, and worker-error logs.

---

## Registering a new worker group

Worker groups are defined in:

```text
src/workers/registry.ts
```

Add the group to `WorkerGroup`:

```ts
export type WorkerGroup =
  | "email"
  | "storage"
  | "report";
```

Then add a lazy registry entry:

```ts
report: {
  create: async () => {
    const { createReportWorkers } = await import(
      "../services/report/infrastructure/queue/createReportWorkers"
    );

    return createReportWorkers();
  },
},
```

Use a `shutdown` callback when the group owns resources such as Prisma clients, browser instances, or provider connections:

```ts
report: {
  create: async () => createReportWorkers(),
  shutdown: async () => {
    await reportDatabase.disconnect();
  },
},
```

Lazy imports are important. An email-only process should not load storage, billing, report, or Prisma modules.

Add an npm script when the group needs its own deployment command:

```json
{
  "worker:report": "ts-node src/workers/main.ts report"
}
```

---

## Registering recurring jobs

Workers should process recurring jobs, but they should not register schedules during worker creation.

Add schedule registration to:

```text
src/workers/register-schedules.ts
```

Example producer function:

```ts
export async function scheduleDailyReportCleanup(): Promise<void> {
  const queue = queueClient.getQueue<ReportJobData>(REPORT_QUEUE_NAME);

  await queue.add(
    cleanupReportsJob.jobName,
    { cleanup: true },
    {
      ...cleanupReportsJob.defaultJobOptions,
      jobId: "report-cleanup-daily",
      repeat: {
        every: 24 * 60 * 60 * 1_000,
      },
    },
  );
}
```

Then run:

```bash
npm run queues:register-schedules
```

Run schedule registration once during deployment, even when several worker replicas are running.

---

## Choosing queues

Several job names can share one queue when they have similar operational behavior.

Use one queue when jobs share:

- The same provider or resource.
- Similar execution time.
- The same retry and retention policy.
- The same scaling requirements.

Use separate queues when jobs need:

- Different rate limits.
- Different concurrency.
- Independent scaling or pause/resume.
- Different priority guarantees.
- Isolation between fast and resource-heavy workloads.

For example, OTP, password-reset, and welcome emails share `email`. Storage cleanup uses `storage-cleanup` because it has different dependencies and retry behavior.

---

## Error handling

Producer errors happen before the job is stored:

```ts
try {
  await enqueueGenerateReport(data);
} catch (error) {
  // Decide whether the main API operation should fail or continue.
}
```

Processor errors happen in the worker:

```ts
async process(job: Job<JobData>): Promise<void> {
  const result = await performWork(job.data);

  if (!result) {
    throw new Error("Background work failed");
  }
}
```

Do not catch and silently ignore a processor failure unless the job is genuinely complete. Throwing allows BullMQ to retry it.

---

## Common mistakes

- Creating `new Queue()` inside a service instead of using `queueClient`.
- Creating `new Worker()` outside a module worker factory.
- Putting job contracts in the central worker bootstrap.
- Importing processors into API routes or domain services.
- Registering repeat schedules in every worker replica.
- Logging OTPs, reset tokens, credentials, or signed URLs.
- Returning success from a processor after work failed.
- Using a permanent job ID for work that must be re-enqueued later.
- Starting workers without Redis.
- Forgetting to add a new worker group to the registry.

---

## File reference

| Purpose | Location |
|---|---|
| Shared queue client | `src/infrastructure/queue/QueueClient.ts` |
| Shared job descriptor type | `src/infrastructure/queue/QueueDescriptor.ts` |
| Shared worker factory | `src/infrastructure/queue/QueueWorkerFactory.ts` |
| Email queue implementation | `src/services/email/infrastructure/queue/` |
| Storage queue implementation | `src/services/storage/infrastructure/queue/` |
| Worker group registry | `src/workers/registry.ts` |
| Worker process entrypoint | `src/workers/main.ts` |
| Recurring schedule registration | `src/workers/register-schedules.ts` |

For architecture and deployment details, see [WORKERS.md](WORKERS.md).

