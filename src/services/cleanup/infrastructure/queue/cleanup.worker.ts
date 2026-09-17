import { Worker, Job } from 'bullmq';
import redisConnectionOptions from '../../../../config/redis';
import { CLEANUP_QUEUE_NAME, CleanupJobData } from './cleanup.queue';
import { cleanupProjectExternalData, cleanupWorkspaceExternalData } from '../../../cleanup.service';
import { deletionLogger as logger } from '../../../../utils/logger';

export const createCleanupWorker = () => {
  return new Worker<CleanupJobData>(
    CLEANUP_QUEUE_NAME,
    async (job: Job<CleanupJobData>) => {
      logger.info(`Processing cleanup job ${job.id} for ${job.data.type}`);
      if (job.data.type === 'project') {
        await cleanupProjectExternalData(job.data.projectId, job.data.feedIds, job.data.projectResourceId);
      } else if (job.data.type === 'workspace') {
        await cleanupWorkspaceExternalData(job.data.workspaceId, job.data.projectIds, job.data.feedIds, job.data.workspaceResourceId);
      }
    },
    {
      connection: redisConnectionOptions as any,
      concurrency: 2,
    }
  );
};
