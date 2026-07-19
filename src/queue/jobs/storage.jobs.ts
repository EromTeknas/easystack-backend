import type { ScheduleObjectDeletionInput } from "../../services/storage/ports/StorageCleanupScheduler";
import type { QueueDescriptor } from "../core/queue";

export interface ReconcileStorageJobData {
  reconcile: true;
}

export type StorageCleanupJobData = ScheduleObjectDeletionInput | ReconcileStorageJobData;

export const deleteStorageObjectJob: QueueDescriptor<ScheduleObjectDeletionInput> = {
  queueName: "storage-cleanup",
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
  queueName: "storage-cleanup",
  jobName: "reconcile-storage",
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
  describe: () => ({}),
};
