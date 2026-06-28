-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `RefreshToken` RENAME INDEX `RefreshToken_user_id_fkey` TO `RefreshToken_user_id_idx`;
