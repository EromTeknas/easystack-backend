# Workers & Background Jobs

This document describes how BullMQ workers are used in the EasyStack backend.

---

## Overview

The backend uses **BullMQ** with **Redis** for asynchronous email sending:

- `email-otp-queue` – sends email OTP codes for email verification.
- `password-reset-queue` – sends password reset emails with secure links.
- `welcome-email-queue` – sends welcome emails after successful verification.

All of these queues are processed by a **unified worker entrypoint**:

- `src/workers/index.worker.ts`

---

## Unified Worker Entry

The unified worker can process **one or many queues** in a single process, controlled by configuration.

### Script

```bash
npm run worker
```

This runs:

```bash
ts-node src/workers/index.worker.ts
```

### Selecting Queues via `WORKER_QUEUES`

By default, the worker will process **all known queues**. You can restrict which queues a process handles using the `WORKER_QUEUES` environment variable:

```bash
# Single process handling all queues
WORKER_QUEUES=email-otp,password-reset,welcome-email npm run worker

# Process 1: OTP + reset
WORKER_QUEUES=email-otp,password-reset npm run worker

# Process 2: OTP only
WORKER_QUEUES=email-otp npm run worker

# Process 3: Password reset only
WORKER_QUEUES=password-reset npm run worker

# Process 4: Welcome emails only
WORKER_QUEUES=welcome-email npm run worker
```

`WORKER_QUEUES` is a comma-separated list of **queue ids**:

- `email-otp`
- `password-reset`
- `welcome-email`

These are mapped to the actual BullMQ queue names:

- `email-otp` → `email-otp-queue`
- `password-reset` → `password-reset-queue`
- `welcome-email` → `welcome-email-queue`

---

## Queue Definitions

- `src/queues/email-otp.queue.ts`
- `src/queues/password-reset.queue.ts`
- `src/queues/welcome-email.queue.ts`

Each file defines:

- The queue name (e.g. `email-otp-queue`).
- The job payload type (e.g. `SendOtpEmailJobData`).
- A helper to enqueue jobs (e.g. `enqueueSendOtpEmailJob`).

---

## Worker Implementation

The unified worker (`src/workers/index.worker.ts`) registers handlers for each queue:

- `email-otp` → calls `sendOtpEmail`.
- `password-reset` → calls `sendPasswordResetEmail`.
- `welcome-email` → calls `sendWelcomeEmail`.

It also logs:

- Job start (`Processing ... job`).
- Job completion.
- Job failures with error details.

---

## Scaling Patterns

You can scale workers horizontally by starting multiple processes with different `WORKER_QUEUES` values:

- High OTP volume:
  - Several processes with `WORKER_QUEUES=email-otp`.
- High password reset volume:
  - Extra processes with `WORKER_QUEUES=password-reset`.
- Mixed workloads:
  - Some processes handle multiple queues, e.g. `WORKER_QUEUES=email-otp,password-reset`.

This design lets you:

- Start **one worker** that handles everything in development.
- Split into **specialized workers** per queue in production if needed.

---

## Operations

- Ensure Redis is running and reachable (`REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`).
- Start at least one worker process (`npm run worker`).
- Monitor logs for job failures and tune retry/backoff settings in the queue definitions if necessary.
