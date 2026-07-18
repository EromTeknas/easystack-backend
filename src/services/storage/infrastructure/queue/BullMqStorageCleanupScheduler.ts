import { StorageCleanupScheduler, ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";
import { storageCleanupQueue, STORAGE_DELETE_JOB_NAME } from "./storageCleanup.queue";

export class BullMqStorageCleanupScheduler implements StorageCleanupScheduler {
  async scheduleObjectDeletion(input: ScheduleObjectDeletionInput): Promise<void> {
    await storageCleanupQueue.add(STORAGE_DELETE_JOB_NAME, input, {
      jobId: `storage-delete:${input.objectKey.replace(/[^a-zA-Z0-9_-]/g, ":")}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
  }
}
