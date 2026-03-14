/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `role` on the `WorkspaceMember` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.
  - A unique constraint covering the columns `[workspace_id,user_id,is_default]` on the table `WorkspaceMember` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `role`;

-- AlterTable
ALTER TABLE `WorkspaceMember` ADD COLUMN `is_default` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `role` ENUM('OWNER', 'ADMIN', 'DEVELOPER', 'PUBLISHER') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `WorkspaceMember_workspace_id_user_id_is_default_key` ON `WorkspaceMember`(`workspace_id`, `user_id`, `is_default`);
