-- AlterTable
ALTER TABLE `User` ADD COLUMN `default_workspace_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_default_workspace_id_fkey` FOREIGN KEY (`default_workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
