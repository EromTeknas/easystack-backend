import { Job, Worker } from "bullmq";
import { redisConnectionOptions } from "../../../../config/redis";
import { StorageReconciliationService } from "../../application/StorageReconciliationService";
import { ObjectStorageProvider } from "../../ports/ObjectStorageProvider";
import { StoragePersistence } from "../../ports/StoragePersistence";
import {
  STORAGE_CLEANUP_QUEUE_NAME,
  STORAGE_DELETE_JOB_NAME,
  STORAGE_RECONCILE_JOB_NAME,
  StorageCleanupJobData,
} from "./storageCleanup.queue";

export function createStorageCleanupWorker(
  objectStorage: ObjectStorageProvider,
  persistence: StoragePersistence,
  reconciliation: StorageReconciliationService,
): Worker<StorageCleanupJobData> {
  return new Worker<StorageCleanupJobData>(
    STORAGE_CLEANUP_QUEUE_NAME,
    async (job: Job<StorageCleanupJobData>) => {
      if (job.name === STORAGE_RECONCILE_JOB_NAME) {
        await reconciliation.reconcile();
        return;
      }
      if (job.name !== STORAGE_DELETE_JOB_NAME || !("objectKey" in job.data)) {
        throw new Error(`Unsupported storage cleanup job: ${job.name}`);
      }
      await objectStorage.deleteObject(job.data.objectKey);
      if (job.data.assetId) {
        await persistence.markAssetDeleted(job.data.assetId);
      }
    },
    { connection: redisConnectionOptions },
  );
}
