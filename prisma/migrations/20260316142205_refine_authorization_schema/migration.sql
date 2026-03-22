/*
  Warnings:

  - A unique constraint covering the columns `[workspace_id,user_id]` on the table `WorkspaceMember` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `WorkspaceMember` ADD COLUMN `removed_at` DATETIME(3) NULL,
    ADD COLUMN `removed_by_user_id` INTEGER NULL,
    ADD COLUMN `role_changed_at` DATETIME(3) NULL,
    ADD COLUMN `role_changed_by_user_id` INTEGER NULL,
    MODIFY `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'DEVELOPER', 'PUBLISHER') NOT NULL;

-- CreateTable
CREATE TABLE `WorkspaceMemberPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace_member_id` INTEGER NOT NULL,
    `action` VARCHAR(120) NOT NULL,
    `is_allowed` BOOLEAN NOT NULL DEFAULT true,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `granted_by_user_id` INTEGER NULL,
    `reason` VARCHAR(500) NULL,

    INDEX `WorkspaceMemberPermission_action_idx`(`action`),
    INDEX `WorkspaceMemberPermission_is_allowed_idx`(`is_allowed`),
    UNIQUE INDEX `WorkspaceMemberPermission_workspace_member_id_action_key`(`workspace_member_id`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'DEVELOPER', 'PUBLISHER') NOT NULL,
    `action` VARCHAR(120) NOT NULL,

    INDEX `RolePermission_role_idx`(`role`),
    INDEX `RolePermission_action_idx`(`action`),
    UNIQUE INDEX `RolePermission_role_action_key`(`role`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `workspace_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assigned_by_user_id` INTEGER NULL,
    `removed_at` DATETIME(3) NULL,
    `removed_by_user_id` INTEGER NULL,

    INDEX `ProjectMember_user_id_idx`(`user_id`),
    INDEX `ProjectMember_workspace_id_idx`(`workspace_id`),
    INDEX `ProjectMember_is_active_idx`(`is_active`),
    UNIQUE INDEX `ProjectMember_project_id_user_id_key`(`project_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WorkspaceMember_role_idx` ON `WorkspaceMember`(`role`);

-- CreateIndex
CREATE INDEX `idx_workspace_role` ON `WorkspaceMember`(`workspace_id`, `role`);

-- CreateIndex
CREATE INDEX `idx_workspace_user` ON `WorkspaceMember`(`workspace_id`, `user_id`);

-- CreateIndex
CREATE UNIQUE INDEX `WorkspaceMember_workspace_id_user_id_key` ON `WorkspaceMember`(`workspace_id`, `user_id`);

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_role_changed_by_user_id_fkey` FOREIGN KEY (`role_changed_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_removed_by_user_id_fkey` FOREIGN KEY (`removed_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMemberPermission` ADD CONSTRAINT `WorkspaceMemberPermission_workspace_member_id_fkey` FOREIGN KEY (`workspace_member_id`) REFERENCES `WorkspaceMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMemberPermission` ADD CONSTRAINT `WorkspaceMemberPermission_granted_by_user_id_fkey` FOREIGN KEY (`granted_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_workspace_id_user_id_fkey` FOREIGN KEY (`workspace_id`, `user_id`) REFERENCES `WorkspaceMember`(`workspace_id`, `user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_removed_by_user_id_fkey` FOREIGN KEY (`removed_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
