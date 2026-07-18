import "dotenv/config";
import { prisma } from "../../../../db/prisma";
import { storageConfig } from "../../../../config/storage";
import { StorageReconciliationService } from "../../application/StorageReconciliationService";
import { PrismaStoragePersistence } from "../prisma/PrismaStoragePersistence";
import { S3ObjectStorageProvider } from "../s3/S3ObjectStorageProvider";
import { BullMqStorageCleanupScheduler } from "./BullMqStorageCleanupScheduler";
import { scheduleHourlyStorageReconciliation } from "./storageCleanup.queue";
import { createStorageCleanupWorker } from "./storageCleanup.worker";

async function main(): Promise<void> {
  const persistence = new PrismaStoragePersistence(prisma);
  const objectStorage = new S3ObjectStorageProvider(storageConfig.s3);
  const scheduler = new BullMqStorageCleanupScheduler();
  const reconciliation = new StorageReconciliationService(persistence, scheduler);

  const worker = createStorageCleanupWorker(objectStorage, persistence, reconciliation);
  await scheduleHourlyStorageReconciliation();

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await prisma.$disconnect();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void main().catch((error: unknown) => {
  console.error("Failed to start storage workers", error);
  process.exitCode = 1;
});
