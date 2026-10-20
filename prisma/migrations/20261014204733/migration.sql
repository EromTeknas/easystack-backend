/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,quotaId,scope,scopeId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `Usage` DROP FOREIGN KEY `Usage_workspaceId_fkey`;

-- DropIndex
DROP INDEX `Usage_workspaceId_quotaId_key` ON `Usage`;

-- AlterTable
ALTER TABLE `Environment` ADD COLUMN `default_approver_ids` JSON NULL,
    ADD COLUMN `is_editable` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `rank` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `requires_approval` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Usage` ADD COLUMN `scope` VARCHAR(191) NOT NULL DEFAULT 'WORKSPACE',
    ADD COLUMN `scopeId` VARCHAR(191) NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE `Release` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `source_environment_id` INTEGER NOT NULL,
    `target_environment_id` INTEGER NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'READY_TO_DEPLOY', 'SCHEDULED', 'DEPLOYING', 'ACTIVE', 'ROLLED_BACK', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `scheduled_at` DATETIME(3) NULL,
    `deployment_started_at` DATETIME(3) NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Release_project_id_idx`(`project_id`),
    INDEX `Release_target_environment_id_idx`(`target_environment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReleaseItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `release_id` INTEGER NOT NULL,
    `feed_id` INTEGER NOT NULL,
    `version_id` VARCHAR(191) NOT NULL,
    `previous_version_id` VARCHAR(191) NULL,

    UNIQUE INDEX `ReleaseItem_release_id_feed_id_key`(`release_id`, `feed_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReleaseApproval` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `release_id` INTEGER NOT NULL,
    `approver_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ReleaseApproval_release_id_approver_id_key`(`release_id`, `approver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Usage_workspaceId_quotaId_scope_scopeId_key` ON `Usage`(`workspaceId`, `quotaId`, `scope`, `scopeId`);

-- AddForeignKey
ALTER TABLE `Usage` ADD CONSTRAINT `Usage_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Release` ADD CONSTRAINT `Release_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Release` ADD CONSTRAINT `Release_source_environment_id_fkey` FOREIGN KEY (`source_environment_id`) REFERENCES `Environment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Release` ADD CONSTRAINT `Release_target_environment_id_fkey` FOREIGN KEY (`target_environment_id`) REFERENCES `Environment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Release` ADD CONSTRAINT `Release_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseItem` ADD CONSTRAINT `ReleaseItem_release_id_fkey` FOREIGN KEY (`release_id`) REFERENCES `Release`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseItem` ADD CONSTRAINT `ReleaseItem_feed_id_fkey` FOREIGN KEY (`feed_id`) REFERENCES `Feed`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseApproval` ADD CONSTRAINT `ReleaseApproval_release_id_fkey` FOREIGN KEY (`release_id`) REFERENCES `Release`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReleaseApproval` ADD CONSTRAINT `ReleaseApproval_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
