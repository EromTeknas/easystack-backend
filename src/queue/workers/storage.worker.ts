import { Job, Worker } from "bullmq";
import { prisma } from "../../db/prisma";
import { storageConfig } from "../../config/storage";
import { StorageReconciliationService } from "../../services/storage/application/StorageReconciliationService";
import { PrismaStoragePersistence } from "../../services/storage/infrastructure/prisma/PrismaStoragePersistence";
import { S3ObjectStorageProvider } from "../../services/storage/infrastructure/s3/S3ObjectStorageProvider";
import { BullMqStorageCleanupScheduler } from "../../services/storage/infrastructure/queue/BullMqStorageCleanupScheduler";
import { createQueueWorker } from "../core/worker";
import {
  deleteStorageObjectJob,
  reconcileStorageJob,
  StorageCleanupJobData,
} from "../jobs/storage.jobs";
import { scheduleHourlyStorageReconciliation } from "../producers/storage.producer";

export async function createStorageWorkers(): Promise<Worker[]> {
  const persistence = new PrismaStoragePersistence(prisma);
  const objectStorage = new S3ObjectStorageProvider(storageConfig.s3);
  const scheduler = new BullMqStorageCleanupScheduler();
  const reconciliation = new StorageReconciliationService(persistence, scheduler);

  await scheduleHourlyStorageReconciliation();

  return [createQueueWorker<StorageCleanupJobData>({
    id: "storage-cleanup",
    group: "storage",
    queueName: deleteStorageObjectJob.queueName,
    processor: async (job: Job<StorageCleanupJobData>) => {
      if (job.name === reconcileStorageJob.jobName) {
        await reconciliation.reconcile();
        return;
      }
      if (job.name !== deleteStorageObjectJob.jobName || !("objectKey" in job.data)) {
        throw new Error(`Unsupported storage cleanup job: ${job.name}`);
      }
      await objectStorage.deleteObject(job.data.objectKey);
      if (job.data.assetId) await persistence.markAssetDeleted(job.data.assetId);
    },
  })];
}
