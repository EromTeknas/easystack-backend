import type { QueueDescriptor } from "../../../../infrastructure/queue";
import type { ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";

export const STORAGE_QUEUE_NAME = "storage-cleanup";

export interface ReconcileStorageJobData {
  reconcile: true;
}

export type StorageJobData = ScheduleObjectDeletionInput | ReconcileStorageJobData;

export const deleteStorageObjectJob: QueueDescriptor<ScheduleObjectDeletionInput> = {
  queueName: STORAGE_QUEUE_NAME,
  jobName: "delete-object",
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
  describe: ({ objectKey, assetId, reason }) => ({ objectKey, assetId, reason }),
};

export const reconcileStorageJob: QueueDescriptor<ReconcileStorageJobData> = {
  queueName: STORAGE_QUEUE_NAME,
  jobName: "reconcile-storage",
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
  describe: () => ({}),
};
