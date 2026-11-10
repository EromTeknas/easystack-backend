/*
  Warnings:

  - You are about to drop the `EnvironmentState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Feed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReleaseItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `EnvironmentState` DROP FOREIGN KEY `EnvironmentState_environment_id_fkey`;

-- DropForeignKey
ALTER TABLE `EnvironmentState` DROP FOREIGN KEY `EnvironmentState_feed_id_fkey`;

-- DropForeignKey
ALTER TABLE `Feed` DROP FOREIGN KEY `Feed_project_id_fkey`;

-- DropForeignKey
ALTER TABLE `ReleaseItem` DROP FOREIGN KEY `ReleaseItem_feed_id_fkey`;

-- DropForeignKey
ALTER TABLE `ReleaseItem` DROP FOREIGN KEY `ReleaseItem_release_id_fkey`;

-- DropTable
DROP TABLE `EnvironmentState`;

-- DropTable
DROP TABLE `Feed`;

-- DropTable
DROP TABLE `ReleaseItem`;
