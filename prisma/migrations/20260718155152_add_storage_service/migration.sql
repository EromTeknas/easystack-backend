-- CreateTable
CREATE TABLE `storage_upload_intents` (
    `id` VARCHAR(64) NOT NULL,
    `intendedAssetId` VARCHAR(64) NOT NULL,
    `actorId` VARCHAR(128) NOT NULL,
    `targetKey` VARCHAR(512) NOT NULL,
    `target` JSON NOT NULL,
    `fileClass` ENUM('IMAGE', 'DOCUMENT', 'BINARY') NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(128) NOT NULL,
    `claimedSizeBytes` BIGINT NOT NULL,
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL,
    `cardinality` ENUM('SINGLE', 'MULTIPLE') NOT NULL,
    `allowedMimeTypes` JSON NOT NULL,
    `maxSizeBytes` BIGINT NOT NULL,
    `uploadExpiresInSeconds` INTEGER NOT NULL,
    `cacheControl` VARCHAR(255) NOT NULL,
    `temporaryObjectKey` VARCHAR(512) NOT NULL,
    `finalObjectKey` VARCHAR(512) NOT NULL,
    `status` ENUM('CREATED', 'COMPLETED', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'CREATED',
    `failureReason` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `storage_upload_intents_intendedAssetId_key`(`intendedAssetId`),
    UNIQUE INDEX `storage_upload_intents_temporaryObjectKey_key`(`temporaryObjectKey`),
    UNIQUE INDEX `storage_upload_intents_finalObjectKey_key`(`finalObjectKey`),
    INDEX `storage_upload_intents_actorId_status_idx`(`actorId`, `status`),
    INDEX `storage_upload_intents_targetKey_createdAt_idx`(`targetKey`, `createdAt`),
    INDEX `storage_upload_intents_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storage_assets` (
    `id` VARCHAR(64) NOT NULL,
    `uploadIntentId` VARCHAR(64) NOT NULL,
    `targetKey` VARCHAR(512) NOT NULL,
    `target` JSON NOT NULL,
    `objectKey` VARCHAR(512) NOT NULL,
    `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL,
    `cardinality` ENUM('SINGLE', 'MULTIPLE') NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(128) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `etag` VARCHAR(255) NULL,
    `checksum` VARCHAR(512) NULL,
    `status` ENUM('ACTIVE', 'DELETION_PENDING', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `activeSingletonKey` VARCHAR(512) NULL,
    `createdById` VARCHAR(128) NOT NULL,
    `deletedById` VARCHAR(128) NULL,
    `deletionRequestedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `storage_assets_uploadIntentId_key`(`uploadIntentId`),
    UNIQUE INDEX `storage_assets_objectKey_key`(`objectKey`),
    UNIQUE INDEX `storage_assets_activeSingletonKey_key`(`activeSingletonKey`),
    INDEX `storage_assets_targetKey_status_idx`(`targetKey`, `status`),
    INDEX `storage_assets_createdById_createdAt_idx`(`createdById`, `createdAt`),
    INDEX `storage_assets_status_deletionRequestedAt_idx`(`status`, `deletionRequestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `storage_assets` ADD CONSTRAINT `storage_assets_uploadIntentId_fkey` FOREIGN KEY (`uploadIntentId`) REFERENCES `storage_upload_intents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
