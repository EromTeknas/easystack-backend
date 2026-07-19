import type { Worker } from "bullmq";

export type WorkerGroup = "email" | "storage";

export interface WorkerGroupRegistration {
  create(): Promise<Worker[]>;
  shutdown?(): Promise<void>;
}

export const workerRegistry: Record<WorkerGroup, WorkerGroupRegistration> = {
  email: {
    create: async () => {
      const { createEmailWorkers } = await import(
        "../services/email/infrastructure/queue/createEmailWorkers"
      );
      return createEmailWorkers();
    },
  },
  storage: {
    create: async () => {
      const { createStorageWorkers } = await import(
        "../services/storage/infrastructure/queue/createStorageWorkers"
      );
      return createStorageWorkers();
    },
    shutdown: async () => {
      const { disconnectPrisma } = await import("../db/prisma");
      await disconnectPrisma();
    },
  },
};

export function isWorkerGroup(value: string): value is WorkerGroup {
  return value in workerRegistry;
}
