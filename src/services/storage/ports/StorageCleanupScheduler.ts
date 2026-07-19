export enum StorageDeletionReason {
  TEMPORARY_UPLOAD_COMPLETED = "TEMPORARY_UPLOAD_COMPLETED",
  REPLACED_BY_NEW_ASSET = "REPLACED_BY_NEW_ASSET",
  USER_REQUESTED_DELETION = "USER_REQUESTED_DELETION",
  ROLLBACK_AFTER_FAILURE = "ROLLBACK_AFTER_FAILURE",
  EXPIRED_UPLOAD = "EXPIRED_UPLOAD",
}

export interface ScheduleObjectDeletionInput {
  objectKey: string;
  assetId?: string;
  uploadIntentId?: string;
  reason: StorageDeletionReason;
}

export interface StorageCleanupScheduler {
  scheduleObjectDeletion(
    input: ScheduleObjectDeletionInput,
  ): Promise<void>;
}
