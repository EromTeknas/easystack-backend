import type { Job } from "bullmq";
import { StorageReconciliationService } from "../../application/StorageReconciliationService";
import type { ObjectStorageProvider } from "../../ports/ObjectStorageProvider";
import type { StoragePersistence } from "../../ports/StoragePersistence";
import {
  deleteStorageObjectJob,
  reconcileStorageJob,
  purgeCleanedUploadIntentsJob,
  StorageJobData,
} from "./storage.jobs";

export class StorageJobProcessor {
  constructor(
    private readonly persistence: StoragePersistence,
    private readonly objectStorage: ObjectStorageProvider,
    private readonly reconciliation: StorageReconciliationService,
    private readonly cleanedIntentRetentionDays: number,
  ) {}

  async process(job: Job<StorageJobData>): Promise<void> {
    switch (job.name) {
      case reconcileStorageJob.jobName:
        await this.reconciliation.reconcile();
        return;
      case deleteStorageObjectJob.jobName:
        await this.processDeletion(job);
        return;
      case purgeCleanedUploadIntentsJob.jobName:
        await this.persistence.deleteCleanedUploadIntents(
          new Date(Date.now() - this.cleanedIntentRetentionDays * 24 * 60 * 60 * 1_000),
          500,
        );
        return;
      default:
        throw new Error(`Unsupported storage job: ${job.name}`);
    }
  }

  private async processDeletion(job: Job<StorageJobData>): Promise<void> {
    if (!("objectKey" in job.data)) {
      throw new Error(`Invalid storage deletion payload for job: ${job.name}`);
    }
    await this.objectStorage.deleteObject(job.data.objectKey);
    await this.persistence.completeObjectCleanup({
      objectKey: job.data.objectKey,
      ...(job.data.assetId ? { assetId: job.data.assetId } : {}),
      ...(job.data.uploadIntentId ? { uploadIntentId: job.data.uploadIntentId } : {}),
      cleanedAt: new Date(),
    });
  }
}
