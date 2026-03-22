/*
  Warnings:

  - The values [MEMBER,DEVELOPER,PUBLISHER] on the enum `RolePermission_role` will be removed. If these variants are still used in the database, this will fail.
  - The values [MEMBER,DEVELOPER,PUBLISHER] on the enum `RolePermission_role` will be removed. If these variants are still used in the database, this will fail.

*/

-- Clean up old role permission data for deprecated roles
DELETE FROM `RolePermission` WHERE `role` IN ('MEMBER', 'DEVELOPER', 'PUBLISHER');

-- AlterTable
ALTER TABLE `RolePermission` MODIFY `role` ENUM('OWNER', 'ADMIN', 'USER') NOT NULL;

-- AlterTable
ALTER TABLE `WorkspaceMember` MODIFY `role` ENUM('OWNER', 'ADMIN', 'USER') NOT NULL;

-- CreateTable
CREATE TABLE `ProjectMemberRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_member_id` INTEGER NOT NULL,
    `role` ENUM('EDITOR', 'PUBLISHER', 'RELEASE_MANAGER', 'VIEWER') NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assigned_by_user_id` INTEGER NULL,

    INDEX `ProjectMemberRole_role_idx`(`role`),
    INDEX `ProjectMemberRole_project_member_id_idx`(`project_member_id`),
    UNIQUE INDEX `ProjectMemberRole_project_member_id_role_key`(`project_member_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectRolePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('EDITOR', 'PUBLISHER', 'RELEASE_MANAGER', 'VIEWER') NOT NULL,
    `action` VARCHAR(120) NOT NULL,

    INDEX `ProjectRolePermission_role_idx`(`role`),
    INDEX `ProjectRolePermission_action_idx`(`action`),
    UNIQUE INDEX `ProjectRolePermission_role_action_key`(`role`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectMemberRole` ADD CONSTRAINT `ProjectMemberRole_project_member_id_fkey` FOREIGN KEY (`project_member_id`) REFERENCES `ProjectMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMemberRole` ADD CONSTRAINT `ProjectMemberRole_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
