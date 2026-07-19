-- Existing intents used the quarantine-and-copy workflow. The default preserves
-- their completion semantics while new intents persist their resolved strategy.
ALTER TABLE `storage_upload_intents`
    ADD COLUMN `uploadStrategy` ENUM('DIRECT', 'QUARANTINE') NOT NULL DEFAULT 'QUARANTINE';
