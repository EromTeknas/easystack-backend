import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../../../../config/redis';
import logger from '../../../../utils/logger';

export const SCHEDULED_RELEASE_QUEUE_NAME = 'scheduled-releases-queue';
export const DEPLOYMENT_QUEUE_NAME = 'deployment-releases-queue';

export const scheduledReleaseQueue = new Queue(SCHEDULED_RELEASE_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const deploymentQueue = new Queue(DEPLOYMENT_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 1, // Deployments are managed with state machine
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function scheduleReleaseJob(
  releaseId: number,
  projectId: number,
  scheduledAt: Date
): Promise<void> {
  const jobId = `scheduled-release-${releaseId}`;
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  // Remove existing delayed job if rescheduling
  try {
    const existing = await scheduledReleaseQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
      logger.info(`[ScheduledReleaseQueue] Removed previous scheduled job ${jobId}`);
    }
  } catch (err) {
    logger.warn(`[ScheduledReleaseQueue] Could not remove existing job ${jobId}: ${err}`);
  }

  await scheduledReleaseQueue.add(
    'execute-scheduled-release',
    { releaseId, projectId },
    {
      jobId,
      delay,
    }
  );

  logger.info(`[ScheduledReleaseQueue] Enqueued release ${releaseId} with delay ${delay}ms (jobId: ${jobId})`);
}

export async function cancelScheduledReleaseJob(releaseId: number): Promise<void> {
  const jobId = `scheduled-release-${releaseId}`;
  try {
    const existing = await scheduledReleaseQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
      logger.info(`[ScheduledReleaseQueue] Cancelled scheduled job ${jobId}`);
    }
  } catch (err) {
    logger.warn(`[ScheduledReleaseQueue] Error removing job ${jobId}: ${err}`);
  }
}

export async function enqueueDeploymentJob(
  releaseId: number,
  projectId: number,
  userId?: number
): Promise<void> {
  const jobId = `deploy-release-${releaseId}-${Date.now()}`;
  await deploymentQueue.add(
    'process-deployment',
    { releaseId, projectId, userId },
    { jobId }
  );
  logger.info(`[DeploymentQueue] Enqueued deployment for release ${releaseId}`);
}
