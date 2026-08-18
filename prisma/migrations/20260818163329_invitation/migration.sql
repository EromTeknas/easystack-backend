-- CreateTable
CREATE TABLE `WorkspaceInvitation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace_id` INTEGER NOT NULL,
    `inviter_id` INTEGER NOT NULL,
    `invitee_id` INTEGER NULL,
    `invitee_email` VARCHAR(191) NOT NULL,
    `workspace_role_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `token` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkspaceInvitation_token_key`(`token`),
    INDEX `WorkspaceInvitation_workspace_id_idx`(`workspace_id`),
    INDEX `WorkspaceInvitation_invitee_email_idx`(`invitee_email`),
    INDEX `WorkspaceInvitation_invitee_id_idx`(`invitee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvitationProjectAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invitation_id` INTEGER NOT NULL,
    `project_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,

    INDEX `InvitationProjectAssignment_invitation_id_idx`(`invitation_id`),
    INDEX `InvitationProjectAssignment_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkspaceInvitation` ADD CONSTRAINT `WorkspaceInvitation_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceInvitation` ADD CONSTRAINT `WorkspaceInvitation_inviter_id_fkey` FOREIGN KEY (`inviter_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceInvitation` ADD CONSTRAINT `WorkspaceInvitation_invitee_id_fkey` FOREIGN KEY (`invitee_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceInvitation` ADD CONSTRAINT `WorkspaceInvitation_workspace_role_id_fkey` FOREIGN KEY (`workspace_role_id`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvitationProjectAssignment` ADD CONSTRAINT `InvitationProjectAssignment_invitation_id_fkey` FOREIGN KEY (`invitation_id`) REFERENCES `WorkspaceInvitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvitationProjectAssignment` ADD CONSTRAINT `InvitationProjectAssignment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvitationProjectAssignment` ADD CONSTRAINT `InvitationProjectAssignment_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
