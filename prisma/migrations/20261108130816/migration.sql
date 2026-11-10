-- CreateTable
CREATE TABLE `project_assets` (
    `id` VARCHAR(64) NOT NULL,
    `project_id` INTEGER NOT NULL,
    `storage_asset_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `alt_text` VARCHAR(500) NULL,
    `caption` TEXT NULL,
    `file_type` VARCHAR(32) NOT NULL,
    `mime_type` VARCHAR(128) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `public_url` VARCHAR(1024) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration` DOUBLE NULL,
    `created_by_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `removed_at` DATETIME(3) NULL,

    UNIQUE INDEX `project_assets_storage_asset_id_key`(`storage_asset_id`),
    INDEX `project_assets_project_id_removed_at_created_at_idx`(`project_id`, `removed_at`, `created_at`),
    INDEX `project_assets_project_id_file_type_removed_at_idx`(`project_id`, `file_type`, `removed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `environment_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `key_prefix` VARCHAR(32) NOT NULL,
    `key_hash` VARCHAR(64) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `rate_limit_per_minute` INTEGER NOT NULL DEFAULT 600,
    `allowed_origins` JSON NULL,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `api_keys_key_hash_key`(`key_hash`),
    INDEX `api_keys_project_id_environment_id_idx`(`project_id`, `environment_id`),
    INDEX `api_keys_key_prefix_idx`(`key_prefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_assets` ADD CONSTRAINT `project_assets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assets` ADD CONSTRAINT `project_assets_storage_asset_id_fkey` FOREIGN KEY (`storage_asset_id`) REFERENCES `storage_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_environment_id_fkey` FOREIGN KEY (`environment_id`) REFERENCES `Environment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
