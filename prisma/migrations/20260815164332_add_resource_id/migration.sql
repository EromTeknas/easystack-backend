/*
  Warnings:

  - A unique constraint covering the columns `[resource_id]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resource_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resource_id]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `resource_id` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resource_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resource_id` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Project` ADD COLUMN `resource_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `resource_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Workspace` ADD COLUMN `resource_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Project_resource_id_key` ON `Project`(`resource_id`);

-- CreateIndex
CREATE UNIQUE INDEX `User_resource_id_key` ON `User`(`resource_id`);

-- CreateIndex
CREATE UNIQUE INDEX `Workspace_resource_id_key` ON `Workspace`(`resource_id`);
