/*
  Warnings:

  - You are about to drop the column `logo_url` on the `Workspace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Workspace` DROP COLUMN `logo_url`,
    ADD COLUMN `logo_asset_id` VARCHAR(191) NULL;
