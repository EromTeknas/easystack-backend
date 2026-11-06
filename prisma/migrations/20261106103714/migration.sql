/*
  Warnings:

  - The values [ACTIVE] on the enum `Release_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Environment` ADD COLUMN `display_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Release` ADD COLUMN `deployment_progress` JSON NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'READY_TO_DEPLOY', 'SCHEDULED', 'DEPLOYING', 'DEPLOYED', 'ROLLED_BACK', 'FAILED') NOT NULL DEFAULT 'DRAFT';
