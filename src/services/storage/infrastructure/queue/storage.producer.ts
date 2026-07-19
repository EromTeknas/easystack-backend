import { queueClient } from "../../../../infrastructure/queue";
import type { ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";
import {
  deleteStorageObjectJob,
  reconcileStorageJob,
  purgeCleanedUploadIntentsJob,
  StorageJobData,
} from "./storage.jobs";

export function enqueueStorageObjectDeletion(input: ScheduleObjectDeletionInput): Promise<void> {
  return queueClient.enqueue(deleteStorageObjectJob, input, {
    deduplication: {
      id: `storage-delete:${input.objectKey}`,
      ttl: 5 * 60 * 1_000,
    },
  });
}

export async function scheduleDailyCleanedIntentRetention(): Promise<void> {
  const queue = queueClient.getQueue<StorageJobData>(purgeCleanedUploadIntentsJob.queueName);
  await queue.add(
    purgeCleanedUploadIntentsJob.jobName,
    { purgeCleanedUploadIntents: true },
    {
      ...purgeCleanedUploadIntentsJob.defaultJobOptions,
      jobId: "storage-cleaned-intent-retention-daily",
      repeat: { every: 24 * 60 * 60 * 1_000 },
    },
  );
}

export async function scheduleHourlyStorageReconciliation(): Promise<void> {
  const queue = queueClient.getQueue<StorageJobData>(reconcileStorageJob.queueName);
  await queue.add(reconcileStorageJob.jobName, { reconcile: true }, {
    ...reconcileStorageJob.defaultJobOptions,
    jobId: "storage-reconciliation-hourly",
    repeat: { every: 60 * 60 * 1_000 },
  });
}
