/*
  Warnings:

  - You are about to drop the column `config` on the `PlanVersion` table. All the data in the column will be lost.
  - You are about to drop the column `cancelled_at` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `custom_override` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `planId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `plan_version_id` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `starts_at` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `planVersionId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startsAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_planId_fkey`;

-- DropForeignKey
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_plan_version_id_fkey`;

-- DropForeignKey
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_user_id_fkey`;

-- DropIndex
DROP INDEX `Subscription_expires_at_idx` ON `Subscription`;

-- DropIndex
DROP INDEX `Subscription_planId_fkey` ON `Subscription`;

-- DropIndex
DROP INDEX `Subscription_plan_version_id_idx` ON `Subscription`;

-- DropIndex
DROP INDEX `Subscription_user_id_key` ON `Subscription`;

-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `isEnterprise` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `PlanVersion` DROP COLUMN `config`,
    ADD COLUMN `isLatest` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Subscription` DROP COLUMN `cancelled_at`,
    DROP COLUMN `created_at`,
    DROP COLUMN `custom_override`,
    DROP COLUMN `expires_at`,
    DROP COLUMN `planId`,
    DROP COLUMN `plan_version_id`,
    DROP COLUMN `starts_at`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `user_id`,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `customOverride` JSON NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `gateway` ENUM('STRIPE', 'RAZORPAY', 'PADDLE', 'LEMON_SQUEEZY') NULL,
    ADD COLUMN `gatewayCustomerId` VARCHAR(191) NULL,
    ADD COLUMN `gatewaySubscriptionId` VARCHAR(191) NULL,
    ADD COLUMN `planVersionId` INTEGER NOT NULL,
    ADD COLUMN `startsAt` DATETIME(3) NOT NULL,
    ADD COLUMN `trialEndsAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    MODIFY `status` ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED') NOT NULL;

-- CreateTable
CREATE TABLE `TrialConfiguration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planVersionId` INTEGER NOT NULL,
    `durationDays` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `TrialConfiguration_planVersionId_key`(`planVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanPricing` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planVersionId` INTEGER NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL,
    `billingCycle` ENUM('MONTHLY', 'YEARLY', 'LIFETIME') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `compareAtAmount` DECIMAL(12, 2) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `activeFrom` DATETIME(3) NULL,
    `activeUntil` DATETIME(3) NULL,

    INDEX `PlanPricing_planVersionId_idx`(`planVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Discount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `percentage` DECIMAL(5, 2) NULL,
    `fixedAmount` DECIMAL(12, 2) NULL,
    `maxUses` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Discount_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscountUsage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discountId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `subscriptionId` INTEGER NULL,
    `paymentId` INTEGER NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiscountUsage_discountId_idx`(`discountId`),
    INDEX `DiscountUsage_userId_idx`(`userId`),
    UNIQUE INDEX `DiscountUsage_discountId_userId_subscriptionId_key`(`discountId`, `userId`, `subscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PricingDiscount` (
    `pricingId` INTEGER NOT NULL,
    `discountId` INTEGER NOT NULL,

    PRIMARY KEY (`pricingId`, `discountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feature` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Feature_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanFeature` (
    `planVersionId` INTEGER NOT NULL,
    `featureId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`planVersionId`, `featureId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NOT NULL,
    `resetPolicy` ENUM('NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'BILLING_CYCLE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Quota_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanQuota` (
    `planVersionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `value` INTEGER NULL,

    PRIMARY KEY (`planVersionId`, `quotaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `planVersionId` INTEGER NOT NULL,
    `status` ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED') NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SubscriptionHistory_subscriptionId_idx`(`subscriptionId`),
    INDEX `SubscriptionHistory_planVersionId_idx`(`planVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `resetAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Usage_userId_quotaId_key`(`userId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `gateway` ENUM('STRIPE', 'RAZORPAY', 'PADDLE', 'LEMON_SQUEEZY') NOT NULL,
    `gatewayPaymentId` VARCHAR(191) NOT NULL,
    `gatewayInvoiceId` VARCHAR(191) NULL,
    `gatewayCustomerId` VARCHAR(191) NULL,
    `gatewayPriceId` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED') NOT NULL,
    `billingCycle` ENUM('MONTHLY', 'YEARLY', 'LIFETIME') NULL,
    `paidAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_subscriptionId_idx`(`subscriptionId`),
    INDEX `Payment_gatewayPaymentId_idx`(`gatewayPaymentId`),
    INDEX `Payment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `paymentId` INTEGER NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL,
    `dueAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    INDEX `Invoice_subscriptionId_idx`(`subscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Plan_isActive_idx` ON `Plan`(`isActive`);

-- CreateIndex
CREATE INDEX `PlanVersion_isLatest_idx` ON `PlanVersion`(`isLatest`);

-- CreateIndex
CREATE UNIQUE INDEX `Subscription_userId_key` ON `Subscription`(`userId`);

-- CreateIndex
CREATE INDEX `Subscription_planVersionId_idx` ON `Subscription`(`planVersionId`);

-- AddForeignKey
ALTER TABLE `TrialConfiguration` ADD CONSTRAINT `TrialConfiguration_planVersionId_fkey` FOREIGN KEY (`planVersionId`) REFERENCES `PlanVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanPricing` ADD CONSTRAINT `PlanPricing_planVersionId_fkey` FOREIGN KEY (`planVersionId`) REFERENCES `PlanVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PricingDiscount` ADD CONSTRAINT `PricingDiscount_pricingId_fkey` FOREIGN KEY (`pricingId`) REFERENCES `PlanPricing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PricingDiscount` ADD CONSTRAINT `PricingDiscount_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_planVersionId_fkey` FOREIGN KEY (`planVersionId`) REFERENCES `PlanVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `Feature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanQuota` ADD CONSTRAINT `PlanQuota_planVersionId_fkey` FOREIGN KEY (`planVersionId`) REFERENCES `PlanVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanQuota` ADD CONSTRAINT `PlanQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `Quota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planVersionId_fkey` FOREIGN KEY (`planVersionId`) REFERENCES `PlanVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionHistory` ADD CONSTRAINT `SubscriptionHistory_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionHistory` ADD CONSTRAINT `SubscriptionHistory_planVersionId_fkey` FOREIGN KEY (`planVersionId`) REFERENCES `PlanVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usage` ADD CONSTRAINT `Usage_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `Quota`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Usage` ADD CONSTRAINT `Usage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
