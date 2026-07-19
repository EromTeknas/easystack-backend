import { closeQueues } from "../infrastructure/queue";
import {
  scheduleDailyCleanedIntentRetention,
  scheduleHourlyStorageReconciliation,
} from "../services/storage/infrastructure/queue/storage.producer";
import logger from "../utils/logger";

async function main(): Promise<void> {
  try {
    await scheduleHourlyStorageReconciliation();
    await scheduleDailyCleanedIntentRetention();
    logger.info("Queue schedules registered", {
      schedules: [
        "storage-reconciliation-hourly",
        "storage-cleaned-intent-retention-daily",
      ],
    });
  } finally {
    await closeQueues();
  }
}

void main().catch((error: unknown) => {
  logger.error("Queue schedule registration failed", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
