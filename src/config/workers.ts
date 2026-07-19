import { env } from "./env";

export const workersConfig = {
  group: env.WORKER_GROUP,
} as const;
