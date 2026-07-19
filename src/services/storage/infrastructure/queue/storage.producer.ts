import { createHash } from "node:crypto";
import { queueClient } from "../../../../infrastructure/queue";
import type { ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";
import {
  deleteStorageObjectJob,
  reconcileStorageJob,
  StorageJobData,
} from "./storage.jobs";

export function enqueueStorageObjectDeletion(input: ScheduleObjectDeletionInput): Promise<void> {
  return queueClient.enqueue(deleteStorageObjectJob, input, {
    jobId: `storage-delete-${createHash("sha256").update(input.objectKey).digest("hex")}`,
  });
}

export async function scheduleHourlyStorageReconciliation(): Promise<void> {
  const queue = queueClient.getQueue<StorageJobData>(reconcileStorageJob.queueName);
  await queue.add(reconcileStorageJob.jobName, { reconcile: true }, {
    ...reconcileStorageJob.defaultJobOptions,
    jobId: "storage-reconciliation-hourly",
    repeat: { every: 60 * 60 * 1_000 },
  });
}
