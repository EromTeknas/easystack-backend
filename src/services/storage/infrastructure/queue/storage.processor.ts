import type { Job } from "bullmq";
import { StorageReconciliationService } from "../../application/StorageReconciliationService";
import type { ObjectStorageProvider } from "../../ports/ObjectStorageProvider";
import type { StoragePersistence } from "../../ports/StoragePersistence";
import {
  deleteStorageObjectJob,
  reconcileStorageJob,
  StorageJobData,
} from "./storage.jobs";

export class StorageJobProcessor {
  constructor(
    private readonly persistence: StoragePersistence,
    private readonly objectStorage: ObjectStorageProvider,
    private readonly reconciliation: StorageReconciliationService,
  ) {}

  async process(job: Job<StorageJobData>): Promise<void> {
    switch (job.name) {
      case reconcileStorageJob.jobName:
        await this.reconciliation.reconcile();
        return;
      case deleteStorageObjectJob.jobName:
        await this.processDeletion(job);
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
    if (job.data.assetId) await this.persistence.markAssetDeleted(job.data.assetId);
  }
}
