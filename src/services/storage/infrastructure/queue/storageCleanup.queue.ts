import { Queue } from "bullmq";
import { redisConnectionOptions } from "../../../../config/redis";
import { ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";

export const STORAGE_CLEANUP_QUEUE_NAME = "storage-cleanup";
export const STORAGE_DELETE_JOB_NAME = "delete-object";
export const STORAGE_RECONCILE_JOB_NAME = "reconcile-storage";

export type StorageCleanupJobData = ScheduleObjectDeletionInput | { reconcile: true };

export const storageCleanupQueue = new Queue<StorageCleanupJobData>(STORAGE_CLEANUP_QUEUE_NAME, {
  connection: redisConnectionOptions,
});

export async function scheduleHourlyStorageReconciliation(): Promise<void> {
  await storageCleanupQueue.add(
    STORAGE_RECONCILE_JOB_NAME,
    { reconcile: true },
    {
      jobId: "storage-reconciliation-hourly",
      repeat: { every: 60 * 60 * 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}
