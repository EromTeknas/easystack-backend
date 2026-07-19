import type { QueueDescriptor } from "../../../../infrastructure/queue";
import type { ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";

export const STORAGE_QUEUE_NAME = "storage-cleanup";

export interface ReconcileStorageJobData {
  reconcile: true;
}

export interface PurgeCleanedUploadIntentsJobData {
  purgeCleanedUploadIntents: true;
}

export type StorageJobData =
  | ScheduleObjectDeletionInput
  | ReconcileStorageJobData
  | PurgeCleanedUploadIntentsJobData;

export const deleteStorageObjectJob: QueueDescriptor<ScheduleObjectDeletionInput> = {
  queueName: STORAGE_QUEUE_NAME,
  jobName: "delete-object",
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
  describe: ({ objectKey, assetId, uploadIntentId, reason }) => ({
    objectKey,
    assetId,
    uploadIntentId,
    reason,
  }),
};

export const reconcileStorageJob: QueueDescriptor<ReconcileStorageJobData> = {
  queueName: STORAGE_QUEUE_NAME,
  jobName: "reconcile-storage",
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
  describe: () => ({}),
};

export const purgeCleanedUploadIntentsJob: QueueDescriptor<PurgeCleanedUploadIntentsJobData> = {
  queueName: STORAGE_QUEUE_NAME,
  jobName: "purge-cleaned-upload-intents",
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
  describe: () => ({}),
};
