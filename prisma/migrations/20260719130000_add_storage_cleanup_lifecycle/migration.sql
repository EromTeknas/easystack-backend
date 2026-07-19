ALTER TABLE `storage_upload_intents`
    MODIFY COLUMN `status` ENUM(
        'CREATED',
        'COMPLETED',
        'EXPIRED',
        'CLEANUP_PENDING',
        'CLEANED',
        'FAILED'
    ) NOT NULL DEFAULT 'CREATED',
    ADD COLUMN `cleanedAt` DATETIME(3) NULL;
