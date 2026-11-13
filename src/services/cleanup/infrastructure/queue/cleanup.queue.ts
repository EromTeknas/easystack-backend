import { Queue } from 'bullmq';
import redisConnectionOptions from '../../../../config/redis';

export const CLEANUP_QUEUE_NAME = 'cleanup-queue';

export const cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, {
  connection: redisConnectionOptions as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

export type CleanupJobData =
  | { type: 'project'; projectId: number; projectResourceId: string }
  | { type: 'workspace'; workspaceId: number; projectIds: number[]; workspaceResourceId: string };

export const enqueueCleanupJob = async (data: CleanupJobData) => {
  await cleanupQueue.add(`cleanup-${data.type}-${'projectId' in data ? data.projectId : data.workspaceId}`, data);
};
