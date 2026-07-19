import type { Worker } from "bullmq";
import { storageConfig } from "../../../../config/storage";
import { prisma } from "../../../../db/prisma";
import { createQueueWorker } from "../../../../infrastructure/queue";
import { StorageReconciliationService } from "../../application/StorageReconciliationService";
import { PrismaStoragePersistence } from "../prisma/PrismaStoragePersistence";
import { S3ObjectStorageProvider } from "../s3/S3ObjectStorageProvider";
import { BullMqStorageCleanupScheduler } from "./BullMqStorageCleanupScheduler";
import { STORAGE_QUEUE_NAME, StorageJobData } from "./storage.jobs";
import { StorageJobProcessor } from "./storage.processor";

export function createStorageWorkers(): Worker[] {
  const persistence = new PrismaStoragePersistence(prisma);
  const objectStorage = new S3ObjectStorageProvider(storageConfig.s3);
  const scheduler = new BullMqStorageCleanupScheduler();
  const reconciliation = new StorageReconciliationService(persistence, scheduler);
  const processor = new StorageJobProcessor(
    persistence,
    objectStorage,
    reconciliation,
    storageConfig.cleanedIntentRetentionDays,
  );

  return [createQueueWorker<StorageJobData>({
    id: "storage-cleanup",
    group: "storage",
    queueName: STORAGE_QUEUE_NAME,
    processor: processor.process.bind(processor),
  })];
}
