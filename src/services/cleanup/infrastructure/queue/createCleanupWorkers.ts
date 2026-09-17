import { Worker } from 'bullmq';
import { createCleanupWorker } from './cleanup.worker';

export const createCleanupWorkers = (): Worker[] => {
  return [createCleanupWorker()];
};
