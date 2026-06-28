/*
  Warnings:

  - You are about to drop the column `subdomain` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_at` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_by_user_id` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `project_id` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `removed_by_user_id` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `ProjectMember` table. All the data in the column will be lost.
  - You are about to drop the column `workspace_id` on the `ProjectMember` table. All the data in the column will be lost.
  - The primary key for the `RolePermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `action` on the `RolePermission` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `RolePermission` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `RolePermission` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `is_default` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `removed_by_user_id` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `role_changed_at` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `role_changed_by_user_id` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `workspace_id` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the `ProjectMemberRole` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectRolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkspaceMemberPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_versions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[workspace_id,slug]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,workspaceMemberId]` on the table `ProjectMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workspaceId,userId]` on the table `WorkspaceMember` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `created_by` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceMemberId` to the `ProjectMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `family_id` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permissionId` to the `RolePermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `RolePermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Workspace` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `WorkspaceMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `WorkspaceMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `WorkspaceMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Project` DROP FOREIGN KEY `Project_workspace_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMember` DROP FOREIGN KEY `ProjectMember_assigned_by_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMember` DROP FOREIGN KEY `ProjectMember_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMember` DROP FOREIGN KEY `ProjectMember_removed_by_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMember` DROP FOREIGN KEY `ProjectMember_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMember` DROP FOREIGN KEY `ProjectMember_workspace_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMember` DROP FOREIGN KEY `ProjectMember_workspace_id_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMemberRole` DROP FOREIGN KEY `ProjectMemberRole_assigned_by_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ProjectMemberRole` DROP FOREIGN KEY `ProjectMemberRole_project_member_id_fkey`;

-- DropForeignKey
ALTER TABLE `WorkspaceMember` DROP FOREIGN KEY `WorkspaceMember_removed_by_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `WorkspaceMember` DROP FOREIGN KEY `WorkspaceMember_role_changed_by_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `WorkspaceMember` DROP FOREIGN KEY `WorkspaceMember_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `WorkspaceMember` DROP FOREIGN KEY `WorkspaceMember_workspace_id_fkey`;

-- DropForeignKey
ALTER TABLE `WorkspaceMemberPermission` DROP FOREIGN KEY `WorkspaceMemberPermission_granted_by_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `WorkspaceMemberPermission` DROP FOREIGN KEY `WorkspaceMemberPermission_workspace_member_id_fkey`;

-- DropForeignKey
ALTER TABLE `plan_versions` DROP FOREIGN KEY `plan_versions_plan_id_fkey`;

-- DropForeignKey
ALTER TABLE `subscriptions` DROP FOREIGN KEY `subscriptions_plan_id_fkey`;

-- DropForeignKey
ALTER TABLE `subscriptions` DROP FOREIGN KEY `subscriptions_user_id_fkey`;

-- DropIndex
DROP INDEX `Project_subdomain_key` ON `Project`;

-- DropIndex
DROP INDEX `Project_workspace_id_subdomain_key` ON `Project`;

-- DropIndex
DROP INDEX `ProjectMember_assigned_by_user_id_fkey` ON `ProjectMember`;

-- DropIndex
DROP INDEX `ProjectMember_is_active_idx` ON `ProjectMember`;

-- DropIndex
DROP INDEX `ProjectMember_project_id_user_id_key` ON `ProjectMember`;

-- DropIndex
DROP INDEX `ProjectMember_removed_by_user_id_fkey` ON `ProjectMember`;

-- DropIndex
DROP INDEX `ProjectMember_user_id_idx` ON `ProjectMember`;

-- DropIndex
DROP INDEX `ProjectMember_workspace_id_idx` ON `ProjectMember`;

-- DropIndex
DROP INDEX `ProjectMember_workspace_id_user_id_fkey` ON `ProjectMember`;

-- DropIndex
DROP INDEX `RolePermission_action_idx` ON `RolePermission`;

-- DropIndex
DROP INDEX `RolePermission_role_action_key` ON `RolePermission`;

-- DropIndex
DROP INDEX `RolePermission_role_idx` ON `RolePermission`;

-- DropIndex
DROP INDEX `WorkspaceMember_removed_by_user_id_fkey` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `WorkspaceMember_role_changed_by_user_id_fkey` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `WorkspaceMember_role_idx` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `WorkspaceMember_user_id_fkey` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `WorkspaceMember_workspace_id_user_id_is_default_key` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `WorkspaceMember_workspace_id_user_id_key` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `idx_workspace_role` ON `WorkspaceMember`;

-- DropIndex
DROP INDEX `idx_workspace_user` ON `WorkspaceMember`;

-- AlterTable
ALTER TABLE `Project` DROP COLUMN `subdomain`,
    ADD COLUMN `created_by` INTEGER NOT NULL,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ProjectMember` DROP COLUMN `assigned_at`,
    DROP COLUMN `assigned_by_user_id`,
    DROP COLUMN `is_active`,
    DROP COLUMN `project_id`,
    DROP COLUMN `removed_by_user_id`,
    DROP COLUMN `user_id`,
    DROP COLUMN `workspace_id`,
    ADD COLUMN `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `projectId` INTEGER NOT NULL,
    ADD COLUMN `roleId` INTEGER NOT NULL,
    ADD COLUMN `workspaceMemberId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `RefreshToken` ADD COLUMN `family_id` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `RolePermission` DROP PRIMARY KEY,
    DROP COLUMN `action`,
    DROP COLUMN `id`,
    DROP COLUMN `role`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `permissionId` INTEGER NOT NULL,
    ADD COLUMN `roleId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`roleId`, `permissionId`);

-- AlterTable
ALTER TABLE `User` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Workspace` ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `WorkspaceMember` DROP COLUMN `created_at`,
    DROP COLUMN `is_default`,
    DROP COLUMN `removed_by_user_id`,
    DROP COLUMN `role`,
    DROP COLUMN `role_changed_at`,
    DROP COLUMN `role_changed_by_user_id`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `user_id`,
    DROP COLUMN `workspace_id`,
    ADD COLUMN `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `roleId` INTEGER NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    ADD COLUMN `workspaceId` INTEGER NOT NULL;

-- DropTable
DROP TABLE `ProjectMemberRole`;

-- DropTable
DROP TABLE `ProjectRolePermission`;

-- DropTable
DROP TABLE `WorkspaceMemberPermission`;

-- DropTable
DROP TABLE `plan_versions`;

-- DropTable
DROP TABLE `plans`;

-- DropTable
DROP TABLE `subscriptions`;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `scope` ENUM('WORKSPACE', 'PROJECT') NOT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT true,
    `workspace_id` INTEGER NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_key_key`(`key`),
    INDEX `Role_scope_idx`(`scope`),
    INDEX `Role_workspace_id_idx`(`workspace_id`),
    INDEX `Role_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Permission_key_key`(`key`),
    INDEX `Permission_resource_idx`(`resource`),
    INDEX `Permission_action_idx`(`action`),
    UNIQUE INDEX `Permission_resource_action_key`(`resource`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Plan_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `config` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlanVersion_planId_idx`(`planId`),
    UNIQUE INDEX `PlanVersion_planId_version_key`(`planId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `plan_version_id` INTEGER NOT NULL,
    `status` ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'TRIAL',
    `custom_override` JSON NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `planId` INTEGER NULL,

    UNIQUE INDEX `Subscription_user_id_key`(`user_id`),
    INDEX `Subscription_plan_version_id_idx`(`plan_version_id`),
    INDEX `Subscription_status_idx`(`status`),
    INDEX `Subscription_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Project_created_by_idx` ON `Project`(`created_by`);

-- CreateIndex
CREATE UNIQUE INDEX `Project_workspace_id_slug_key` ON `Project`(`workspace_id`, `slug`);

-- CreateIndex
CREATE INDEX `ProjectMember_projectId_idx` ON `ProjectMember`(`projectId`);

-- CreateIndex
CREATE INDEX `ProjectMember_workspaceMemberId_idx` ON `ProjectMember`(`workspaceMemberId`);

-- CreateIndex
CREATE INDEX `ProjectMember_roleId_idx` ON `ProjectMember`(`roleId`);

-- CreateIndex
CREATE UNIQUE INDEX `ProjectMember_projectId_workspaceMemberId_key` ON `ProjectMember`(`projectId`, `workspaceMemberId`);

-- CreateIndex
CREATE INDEX `RefreshToken_family_id_idx` ON `RefreshToken`(`family_id`);

-- CreateIndex
CREATE INDEX `RefreshToken_expires_at_idx` ON `RefreshToken`(`expires_at`);

-- CreateIndex
CREATE INDEX `RolePermission_permissionId_idx` ON `RolePermission`(`permissionId`);

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);

-- CreateIndex
CREATE UNIQUE INDEX `Workspace_slug_key` ON `Workspace`(`slug`);

-- CreateIndex
CREATE INDEX `Workspace_created_by_idx` ON `Workspace`(`created_by`);

-- CreateIndex
CREATE INDEX `Workspace_slug_idx` ON `Workspace`(`slug`);

-- CreateIndex
CREATE INDEX `WorkspaceMember_workspaceId_idx` ON `WorkspaceMember`(`workspaceId`);

-- CreateIndex
CREATE INDEX `WorkspaceMember_userId_idx` ON `WorkspaceMember`(`userId`);

-- CreateIndex
CREATE INDEX `WorkspaceMember_roleId_idx` ON `WorkspaceMember`(`roleId`);

-- CreateIndex
CREATE UNIQUE INDEX `WorkspaceMember_workspaceId_userId_key` ON `WorkspaceMember`(`workspaceId`, `userId`);

-- AddForeignKey
-- ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_workspaceMemberId_fkey` FOREIGN KEY (`workspaceMemberId`) REFERENCES `WorkspaceMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanVersion` ADD CONSTRAINT `PlanVersion_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_plan_version_id_fkey` FOREIGN KEY (`plan_version_id`) REFERENCES `PlanVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- -- RenameIndex
-- ALTER TABLE `RefreshToken` RENAME INDEX `RefreshToken_user_id_fkey` TO `RefreshToken_user_id_idx`;
