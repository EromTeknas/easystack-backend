/*
  Warnings:

  - You are about to drop the column `slug` on the `Workspace` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Workspace_slug_idx` ON `Workspace`;

-- DropIndex
DROP INDEX `Workspace_slug_key` ON `Workspace`;

-- AlterTable
ALTER TABLE `Workspace` DROP COLUMN `slug`;

-- CreateIndex
CREATE UNIQUE INDEX `Project_slug_key` ON `Project`(`slug`);

-- CreateIndex
CREATE INDEX `Project_slug_idx` ON `Project`(`slug`);
