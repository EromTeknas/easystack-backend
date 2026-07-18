import {
  CompleteUploadTransactionInput,
  CompleteUploadTransactionResult,
  StorageAssetRecord,
  StorageUploadIntentRecord,
} from "../domain/storage.records";

export interface StoragePersistence {
  createUploadIntent(
    intent: StorageUploadIntentRecord,
  ): Promise<void>;

  findUploadIntentById(
    uploadIntentId: string,
  ): Promise<StorageUploadIntentRecord | null>;

  findAssetById(
    assetId: string,
  ): Promise<StorageAssetRecord | null>;

  findActiveAssetsByTarget(
    targetKey: string,
  ): Promise<StorageAssetRecord[]>;

  findExpiredUploadIntents(before: Date, limit: number): Promise<StorageUploadIntentRecord[]>;
  findUploadIntentsRequiringTemporaryCleanup(before: Date, limit: number): Promise<StorageUploadIntentRecord[]>;
  markUploadIntentExpired(uploadIntentId: string): Promise<boolean>;
  findDeletionPendingAssets(limit: number): Promise<StorageAssetRecord[]>;

  /**
   * Must run in one database transaction:
   *
   * 1. Verify intent is still CREATED.
   * 2. Create the new asset.
   * 3. Mark intent COMPLETED.
   * 4. For SINGLE targets, mark old assets DELETION_PENDING.
   */
  completeUpload(
    input: CompleteUploadTransactionInput,
  ): Promise<CompleteUploadTransactionResult>;

  markUploadIntentFailed(
    uploadIntentId: string,
    reason: string,
  ): Promise<void>;

  /**
   * Removes the asset from active queries and marks it for
   * asynchronous physical deletion.
   */
  requestAssetDeletion(
    assetId: string,
    expectedTargetKey: string,
    deletedById: string,
  ): Promise<StorageAssetRecord>;

  markAssetDeleted(assetId: string): Promise<void>;
}
