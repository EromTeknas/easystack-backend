import { StorageCleanupScheduler, ScheduleObjectDeletionInput } from "../../ports/StorageCleanupScheduler";
import { enqueueStorageObjectDeletion } from "./storage.producer";

export class BullMqStorageCleanupScheduler implements StorageCleanupScheduler {
  async scheduleObjectDeletion(input: ScheduleObjectDeletionInput): Promise<void> {
    await enqueueStorageObjectDeletion(input);
  }
}
