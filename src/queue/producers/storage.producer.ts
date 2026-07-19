import { createHash } from "node:crypto";
import { getQueue, enqueue } from "../core/queue";
import {
  deleteStorageObjectJob,
  reconcileStorageJob,
  StorageCleanupJobData,
} from "../jobs/storage.jobs";
import type { ScheduleObjectDeletionInput } from "../../services/storage/ports/StorageCleanupScheduler";

export function enqueueStorageObjectDeletion(input: ScheduleObjectDeletionInput): Promise<void> {
  return enqueue(deleteStorageObjectJob, input, {
    jobId: `storage-delete-${createHash("sha256").update(input.objectKey).digest("hex")}`,
  });
}

export async function scheduleHourlyStorageReconciliation(): Promise<void> {
  const queue = getQueue<StorageCleanupJobData>(reconcileStorageJob.queueName);
  await queue.add(reconcileStorageJob.jobName, { reconcile: true }, {
    ...reconcileStorageJob.defaultJobOptions,
    jobId: "storage-reconciliation-hourly",
    repeat: { every: 60 * 60 * 1_000 },
  });
}
