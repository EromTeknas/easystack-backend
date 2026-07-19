# Storage Upload Intent Lifecycle

This guide explains what happens to a storage upload intent from creation until completion or cleanup.

## What is an upload intent?

An upload intent is a database record created before the browser uploads a file. It records:

- Who started the upload.
- Where the file belongs.
- The expected file type and size.
- The object-storage key.
- When the upload expires.
- Its current lifecycle status.

The intent lets the backend verify a browser upload before making it an active asset.

---

## The two main paths

An upload is either completed by the user or abandoned and cleaned up later.

```text
Successful upload

CREATED
   ↓ browser uploads file
   ↓ completeUpload verifies it
COMPLETED
   ↓ asset is later replaced or deleted
DELETION_PENDING
   ↓ delete-object removes the S3 object
DELETED
   ↓ retention period passes
   ↓ purge-cleaned-upload-intents runs
asset and its source intent are deleted from the database
```

```text
Expired upload

CREATED
   ↓ expiry time passes
   ↓ reconcile-storage finds it
CLEANUP_PENDING
   ↓ delete-object removes the S3 object
CLEANED
   ↓ retention period passes
   ↓ purge-cleaned-upload-intents runs
database row deleted
```

Older database records may have the legacy `EXPIRED` status. Reconciliation treats them like expired `CREATED` records and moves them to `CLEANUP_PENDING`.

---

## Intent statuses

| Status | Simple meaning |
|---|---|
| `CREATED` | The backend created the upload request and is waiting for completion. |
| `COMPLETED` | The file was verified and activated as a storage asset. |
| `EXPIRED` | Legacy status for an expired upload. New cleanup moves directly to `CLEANUP_PENDING`. |
| `CLEANUP_PENDING` | The upload expired and its object still needs confirmed deletion. |
| `CLEANED` | Object deletion succeeded and cleanup was recorded in the database. |
| `FAILED` | The upload intent could not be prepared, such as when presigning failed. |

`COMPLETED` intent rows are retained while their asset is active. If that asset is eventually deleted, the daily retention job permanently deletes both the old `DELETED` asset and its source intent after the retention period.

---

## Queue and jobs

All storage cleanup jobs use the `storage-cleanup` BullMQ queue.

| Job | What it does | What it does not do |
|---|---|---|
| `reconcile-storage` | Finds work that should be queued. | It does not delete S3 objects or intent rows. |
| `delete-object` | Deletes one object from S3/MinIO, then records successful cleanup. | It does not hard-delete upload-intent rows. |
| `purge-cleaned-upload-intents` | Permanently deletes old `DELETED` assets and their source intents, plus old standalone `CLEANED` intents. | It does not delete S3 objects. Those were already deleted. |

This separation is intentional. It prevents the database from forgetting an object before object-storage deletion succeeds.

---

## Job 1: `reconcile-storage`

This job scans the database and schedules missing cleanup work.

It performs three checks.

### 1. Expired uploads

For every expired `CREATED`, legacy `EXPIRED`, or existing `CLEANUP_PENDING` intent:

1. Change the status to `CLEANUP_PENDING` when needed.
2. Determine the correct uploaded object key.
3. Enqueue a `delete-object` job with `uploadIntentId` and `objectKey`.

Example job data:

```json
{
  "objectKey": "private/users/1/avatar/ast_123.jpg",
  "uploadIntentId": "upl_123",
  "reason": "EXPIRED_UPLOAD"
}
```

Direct uploads use their final unique object key. Quarantine uploads use their temporary object key.

### 2. Temporary objects from completed quarantine uploads

After a quarantine upload is promoted to its final key, reconciliation can enqueue deletion of the old temporary object.

This cleanup job does not include `uploadIntentId`, because the intent should remain `COMPLETED`.

### 3. Assets waiting for deletion

Assets in `DELETION_PENDING` are re-enqueued with `assetId`. This covers replaced assets and user-requested deletions whose earlier queue scheduling or processing did not finish.

### What “reconciliation completed” means

When `reconcile-storage` completes, it means cleanup jobs were successfully identified and queued. It does not mean those objects have already been deleted.

After reconciliation, expect separate logs for each `delete-object` job:

```text
Queue job active     jobName=delete-object
Queue job completed  jobName=delete-object
```

---

## Job 2: `delete-object`

This job performs the physical object deletion.

The order is important:

```text
1. Delete the object from S3/MinIO
2. If deletion succeeds, update database cleanup state
```

The database update uses one transaction:

- If the job contains `assetId`, mark that asset `DELETED` and set `deletedAt`.
- If the job contains `uploadIntentId`, mark that intent `CLEANED` and set `cleanedAt`.
- Verify that the supplied ID belongs to the deleted `objectKey` before updating it.

### Why the object is deleted first

If the database row were deleted first and S3 deletion later failed, the object would remain in storage without a database record pointing to it. That would create an untracked orphan.

With the current order, a failure leaves the intent in `CLEANUP_PENDING`, so reconciliation can find it again.

### Retry behavior

Deletion jobs use:

- At least five attempts.
- Exponential backoff.
- A short deduplication window to reduce duplicate jobs.
- Completed and failed job retention for operations and debugging.

S3 deletion is idempotent. If S3 deletion succeeds but the database transaction fails, BullMQ can retry the job. Deleting the already-missing object again is safe, and the database transaction can then complete.

---

## Job 3: `purge-cleaned-upload-intents`

This is the storage database-retention job. Its existing queue name is kept for compatibility, but it now purges both asset and upload-intent records.

It performs two cleanup operations in one database transaction.

### Old deleted assets

It selects assets only when all of these are true:

- Status is `DELETED`.
- `deletedAt` is older than the configured retention period.

It deletes each selected asset first, then deletes that asset's source upload intent. This order is required because the database foreign key prevents an intent from being deleted while its asset still references it.

The source intent is usually `COMPLETED`; it records the upload that originally created the asset.

### Old standalone cleaned intents

It also deletes intents only when all of these are true:

- Status is `CLEANED`.
- `cleanedAt` is older than the configured retention period.
- The intent has no related storage asset.

The default retention is 30 days:

```env
STORAGE_CLEANED_INTENT_RETENTION_DAYS=30
```

Keeping cleaned intents for a while helps with:

- Debugging abandoned uploads.
- Cleanup auditing.
- Finding abuse or unusual upload patterns.
- Measuring how many uploads are abandoned.

The purge job processes at most 500 old assets and 500 standalone cleaned intents per run so one run does not create an unbounded database operation. If more records remain, the next daily run processes the next batch.

The retention job never deletes `ACTIVE`, `DELETION_PENDING`, `CREATED`, or `CLEANUP_PENDING` records. It also does not call S3/MinIO because physical object deletion already succeeded before an asset became `DELETED` or an intent became `CLEANED`.

After every run, the worker logs counts:

```text
Storage retention completed
retentionDays=30
deletedAssets=...
deletedUploadIntents=...
```

---

## Schedules

Schedules are registered separately from worker startup:

```bash
npm run queues:register-schedules
```

This registers:

| Schedule | Frequency |
|---|---|
| `storage-reconciliation-hourly` | Every hour |
| `storage-cleaned-intent-retention-daily` | Every 24 hours |

Run schedule registration once during deployment. Do not rely on every storage worker replica to register schedules.

The storage worker must also be running:

```bash
npm run worker:storage
```

Schedule registration creates recurring jobs. The storage worker processes them.

---

## Common scenarios

### Browser requests an upload but uploads nothing

```text
CREATED → expires → CLEANUP_PENDING → CLEANED → row deleted after retention
```

S3 deletion is safe even if no object was ever uploaded.

### Browser uploads but never calls complete

The intent expires. Reconciliation schedules deletion of the uploaded object, and successful deletion moves the intent to `CLEANED`.

### Cleanup scheduling fails

The intent remains `CLEANUP_PENDING`. A later reconciliation run discovers it and tries scheduling again.

### S3 deletion fails

The `delete-object` job retries. The intent stays `CLEANUP_PENDING` and is not purged.

### S3 deletion succeeds but the database update fails

The BullMQ job fails and retries. Repeating S3 deletion is safe. A successful retry marks the intent `CLEANED`.

### A completed quarantine upload leaves a temporary object

Reconciliation enqueues temporary-object deletion. The upload intent remains `COMPLETED` because only the temporary copy is being removed.

### An active asset is replaced or deleted

The asset becomes `DELETION_PENDING`. A `delete-object` job carries its `assetId`. After object deletion succeeds, the database transaction marks the asset `DELETED`.

---

## Operations checklist

- Run `npm run queues:register-schedules` during deployment.
- Run at least one `npm run worker:storage` process.
- Use Redis 6.2 or newer with BullMQ 5.
- Monitor failed and stalled jobs on `storage-cleanup`.
- Look for `CLEANUP_PENDING` intents that remain unchanged for a long time.
- Look for `DELETION_PENDING` assets that remain unchanged for a long time.
- Do not manually delete pending intent rows before object cleanup succeeds.
- Do not treat a completed reconciliation job as proof that every deletion job has completed.

---

## Relevant code

| Responsibility | File |
|---|---|
| Reconciliation rules | `src/services/storage/application/StorageReconciliationService.ts` |
| Storage job definitions | `src/services/storage/infrastructure/queue/storage.jobs.ts` |
| Job enqueue and schedules | `src/services/storage/infrastructure/queue/storage.producer.ts` |
| Deletion and retention processing | `src/services/storage/infrastructure/queue/storage.processor.ts` |
| Worker dependency wiring | `src/services/storage/infrastructure/queue/createStorageWorkers.ts` |
| Persistence state transitions | `src/services/storage/infrastructure/prisma/PrismaStoragePersistence.ts` |
| Cleanup scheduler port | `src/services/storage/ports/StorageCleanupScheduler.ts` |
| Storage worker registry | `src/workers/registry.ts` |
| Schedule registration | `src/workers/register-schedules.ts` |
