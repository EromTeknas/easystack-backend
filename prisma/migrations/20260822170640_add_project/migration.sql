-- AlterTable
ALTER TABLE `Project` ADD COLUMN `supported_languages` JSON NULL;

-- CreateTable
CREATE TABLE `Environment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Environment_project_id_idx`(`project_id`),
    UNIQUE INDEX `Environment_project_id_name_key`(`project_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feed` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `base_language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Feed_project_id_idx`(`project_id`),
    UNIQUE INDEX `Feed_project_id_name_key`(`project_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnvironmentState` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `environment_id` INTEGER NOT NULL,
    `feed_id` INTEGER NOT NULL,
    `active_version_id` VARCHAR(191) NOT NULL,

    INDEX `EnvironmentState_environment_id_idx`(`environment_id`),
    INDEX `EnvironmentState_feed_id_idx`(`feed_id`),
    UNIQUE INDEX `EnvironmentState_environment_id_feed_id_key`(`environment_id`, `feed_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Environment` ADD CONSTRAINT `Environment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feed` ADD CONSTRAINT `Feed_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentState` ADD CONSTRAINT `EnvironmentState_environment_id_fkey` FOREIGN KEY (`environment_id`) REFERENCES `Environment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnvironmentState` ADD CONSTRAINT `EnvironmentState_feed_id_fkey` FOREIGN KEY (`feed_id`) REFERENCES `Feed`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
