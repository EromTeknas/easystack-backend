-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_defaultWorkspaceId_billing_changes_fkey`;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_defaultWorkspace_fkey` FOREIGN KEY (`default_workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
