-- Move authentication credentials into provider accounts and add durable refresh-session IDs.
CREATE TABLE `AuthAccount` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `provider` ENUM('PASSWORD', 'GOOGLE', 'MICROSOFT', 'GITHUB') NOT NULL,
  `provider_account_id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `email_verified` BOOLEAN NOT NULL DEFAULT false,
  `password_hash` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `last_used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AuthAccount_provider_provider_account_id_key`(`provider`, `provider_account_id`),
  UNIQUE INDEX `AuthAccount_user_id_provider_key`(`user_id`, `provider`),
  INDEX `AuthAccount_user_id_idx`(`user_id`),
  INDEX `AuthAccount_email_idx`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AuthAccount` (
  `user_id`,
  `provider`,
  `provider_account_id`,
  `email`,
  `email_verified`,
  `password_hash`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  'PASSWORD',
  `email`,
  `email`,
  `email_verified`,
  `password_hash`,
  `created_at`,
  `updated_at`
FROM `User`
WHERE `password_hash` IS NOT NULL;

ALTER TABLE `User`
  DROP COLUMN `password_hash`;

ALTER TABLE `AuthAccount`
  ADD CONSTRAINT `AuthAccount_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `RefreshToken`
  ADD COLUMN `jti` VARCHAR(191) NULL,
  ADD COLUMN `replaced_by_jti` VARCHAR(191) NULL;

UPDATE `RefreshToken`
SET `jti` = UUID()
WHERE `jti` IS NULL;

ALTER TABLE `RefreshToken`
  MODIFY `jti` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `RefreshToken_jti_key` ON `RefreshToken`(`jti`);
