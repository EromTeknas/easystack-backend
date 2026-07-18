import { StorageCleanupScheduler, StorageDeletionReason } from "../ports/StorageCleanupScheduler";
import { StoragePersistence } from "../ports/StoragePersistence";

export class StorageReconciliationService {
  constructor(
    private readonly persistence: StoragePersistence,
    private readonly cleanupScheduler: StorageCleanupScheduler,
    private readonly batchSize = 100,
  ) {}

  async reconcile(now = new Date()): Promise<void> {
    const expired = await this.persistence.findExpiredUploadIntents(now, this.batchSize);
    for (const intent of expired) {
      if (await this.persistence.markUploadIntentExpired(intent.id)) {
        await this.cleanupScheduler.scheduleObjectDeletion({
          objectKey: intent.temporaryObjectKey,
          reason: StorageDeletionReason.EXPIRED_UPLOAD,
        });
      }
    }

    const cleanupIntents = await this.persistence.findUploadIntentsRequiringTemporaryCleanup(
      new Date(now.getTime() - 60 * 60 * 1000),
      this.batchSize,
    );
    const pendingAssets = await this.persistence.findDeletionPendingAssets(this.batchSize);

    await Promise.all([
      ...cleanupIntents.map((intent) => this.cleanupScheduler.scheduleObjectDeletion({
        objectKey: intent.temporaryObjectKey,
        reason: intent.status === "EXPIRED"
          ? StorageDeletionReason.EXPIRED_UPLOAD
          : StorageDeletionReason.TEMPORARY_UPLOAD_COMPLETED,
      })),
      ...pendingAssets.map((asset) => this.cleanupScheduler.scheduleObjectDeletion({
        objectKey: asset.objectKey,
        assetId: asset.id,
        reason: StorageDeletionReason.USER_REQUESTED_DELETION,
      })),
    ]);
  }
}
