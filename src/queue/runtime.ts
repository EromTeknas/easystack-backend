import { Worker } from "bullmq";
import { workersConfig } from "../config/workers";
import logger from "../utils/logger";
import { closeProducerQueues } from "./core/queue";
import { WorkerGroup } from "./core/worker";
import { createEmailWorkers } from "./workers/email.workers";

type WorkerSelection = WorkerGroup | "all";
const selections: readonly WorkerSelection[] = ["email", "storage", "all"];

function parseSelection(): WorkerSelection {
  const raw = process.argv[2] ?? workersConfig.group ?? "all";
  if (selections.includes(raw as WorkerSelection)) return raw as WorkerSelection;
  throw new Error(`Invalid worker group '${raw}'. Expected: ${selections.join(", ")}`);
}

async function main(): Promise<void> {
  const selection = parseSelection();
  const workers: Worker[] = [];

  if (selection === "email" || selection === "all") {
    workers.push(...createEmailWorkers());
  }
  if (selection === "storage" || selection === "all") {
    const { createStorageWorkers } = await import("./workers/storage.worker");
    workers.push(...await createStorageWorkers());
  }

  logger.info("Standalone queue worker process started", {
    selection,
    workerCount: workers.length,
    processId: process.pid,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Standalone queue worker process stopping", { signal, workerCount: workers.length });
    await Promise.all(workers.map((worker) => worker.close()));
    await closeProducerQueues();
    if (selection === "storage" || selection === "all") {
      const { disconnectPrisma } = await import("../db/prisma");
      await disconnectPrisma();
    }
    logger.info("Standalone queue worker process stopped", { signal });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((error: unknown) => {
  logger.error("Standalone queue worker process failed to start", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
