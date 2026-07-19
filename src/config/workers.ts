import { env } from "./env";

export const workersConfig = {
  enabledQueues: env.WORKER_QUEUES,
} as const;
