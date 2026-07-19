import type { Worker } from "bullmq";
import { workersConfig } from "../config/workers";
import { closeQueues } from "../infrastructure/queue";
import logger from "../utils/logger";
import { isWorkerGroup, WorkerGroup, workerRegistry } from "./registry";

type WorkerSelection = WorkerGroup | "all";

function parseSelection(): WorkerSelection {
  const raw = process.argv[2] ?? workersConfig.group ?? "all";
  if (raw === "all" || isWorkerGroup(raw)) return raw;
  throw new Error(`Invalid worker group '${raw}'. Expected: ${[
    ...Object.keys(workerRegistry), "all",
  ].join(", ")}`);
}

async function main(): Promise<void> {
  const selection = parseSelection();
  const groups = selection === "all"
    ? Object.keys(workerRegistry) as WorkerGroup[]
    : [selection];
  const workers: Worker[] = (await Promise.all(
    groups.map((group) => workerRegistry[group].create()),
  )).flat();

  logger.info("Standalone queue worker process started", {
    selection, groups, workerCount: workers.length, processId: process.pid,
  });

  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (signal: string): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      logger.info("Standalone queue worker process stopping", { signal, groups });
      await Promise.all(workers.map((worker) => worker.close()));
      await closeQueues();
      await Promise.all(groups.map((group) => workerRegistry[group].shutdown?.()));
      logger.info("Standalone queue worker process stopped", { signal });
    })();
    return shutdownPromise;
  };

  const handleSignal = (signal: string): void => {
    void shutdown(signal)
      .then(() => { process.exitCode = 0; })
      .catch((error: unknown) => {
        logger.error("Standalone queue worker shutdown failed", {
          signal,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        process.exitCode = 1;
      });
  };
  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
}

void main().catch((error: unknown) => {
  logger.error("Standalone queue worker process failed to start", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
