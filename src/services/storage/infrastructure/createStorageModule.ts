import { PrismaClient } from "@prisma/client";
import { storageConfig } from "../../../config/storage";
import { DefaultStorageService } from "../application/DefaultStorageService";
import { StoragePolicyResolver } from "../application/StoragePolicyResolver";
import { ObjectKeyBuilder } from "../domain/ObjectKeyBuilder";
import { StorageService } from "../public/StorageService";
import { PrismaStoragePersistence } from "./prisma/PrismaStoragePersistence";
import { BullMqStorageCleanupScheduler } from "./queue/BullMqStorageCleanupScheduler";
import { S3ObjectStorageProvider } from "./s3/S3ObjectStorageProvider";

export function createStorageModule(prisma: PrismaClient): StorageService {
  return new DefaultStorageService(
    new PrismaStoragePersistence(prisma),
    new S3ObjectStorageProvider(storageConfig.s3),
    new BullMqStorageCleanupScheduler(),
    new ObjectKeyBuilder(),
    new StoragePolicyResolver(),
    {
      cdnBaseUrl: storageConfig.cdnBaseUrl,
      defaultPrivateUrlExpiresInSeconds: storageConfig.privateUrlExpiresInSeconds,
    },
  );
}
