/*
  Warnings:

  - You are about to drop the column `userId` on the `DiscountUsage` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Usage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[discountId,workspaceId,subscriptionId]` on the table `DiscountUsage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,quotaId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspaceId` to the `DiscountUsage` table without a default value. This is not possible if the table is not empty.
  - Made the column `subscriptionId` on table `DiscountUsage` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `workspaceId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `SubscriptionHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Usage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `DiscountUsage` DROP FOREIGN KEY `DiscountUsage_discountId_fkey`;

-- DropForeignKey
ALTER TABLE `DiscountUsage` DROP FOREIGN KEY `DiscountUsage_subscriptionId_fkey`;

-- DropForeignKey
ALTER TABLE `DiscountUsage` DROP FOREIGN KEY `DiscountUsage_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Usage` DROP FOREIGN KEY `Usage_userId_fkey`;

-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_default_workspace_id_fkey`;

-- DropIndex
DROP INDEX `DiscountUsage_discountId_userId_subscriptionId_key` ON `DiscountUsage`;

-- DropIndex
DROP INDEX `DiscountUsage_subscriptionId_fkey` ON `DiscountUsage`;

-- DropIndex
DROP INDEX `DiscountUsage_userId_idx` ON `DiscountUsage`;

-- DropIndex
DROP INDEX `Subscription_userId_key` ON `Subscription`;

-- DropIndex
DROP INDEX `Usage_userId_quotaId_key` ON `Usage`;

-- AlterTable
ALTER TABLE `DiscountUsage` DROP COLUMN `userId`,
    ADD COLUMN `workspaceId` INTEGER NOT NULL,
    MODIFY `subscriptionId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `workspaceId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `workspaceId` INTEGER NOT NULL,
    MODIFY `subscriptionId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Subscription` DROP COLUMN `userId`,
    ADD COLUMN `billingOwnerId` INTEGER NULL,
    ADD COLUMN `workspaceId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `SubscriptionHistory` ADD COLUMN `workspaceId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Usage` DROP COLUMN `userId`,
    ADD COLUMN `workspaceId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Workspace` ADD COLUMN `slug` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `DiscountUsage_workspaceId_idx` ON `DiscountUsage`(`workspaceId`);

-- CreateIndex
CREATE UNIQUE INDEX `DiscountUsage_discountId_workspaceId_subscriptionId_key` ON `DiscountUsage`(`discountId`, `workspaceId`, `subscriptionId`);

-- CreateIndex
CREATE INDEX `Invoice_workspaceId_idx` ON `Invoice`(`workspaceId`);

-- CreateIndex
CREATE INDEX `Payment_workspaceId_idx` ON `Payment`(`workspaceId`);

-- CreateIndex
CREATE UNIQUE INDEX `Subscription_workspaceId_key` ON `Subscription`(`workspaceId`);

-- CreateIndex
CREATE INDEX `SubscriptionHistory_workspaceId_idx` ON `SubscriptionHistory`(`workspaceId`);

-- CreateIndex
CREATE INDEX `Usage_workspaceId_idx` ON `Usage`(`workspaceId`);

-- CreateIndex
CREATE UNIQUE INDEX `Usage_workspaceId_quotaId_key` ON `Usage`(`workspaceId`, `quotaId`);

-- CreateIndex
CREATE UNIQUE INDEX `Workspace_slug_key` ON `Workspace`(`slug`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_defaultWorkspaceId_billing_changes_fkey` FOREIGN KEY (`default_workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_billingOwnerId_fkey` FOREIGN KEY (`billingOwnerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionHistory` ADD CONSTRAINT `SubscriptionHistory_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usage` ADD CONSTRAINT `Usage_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
