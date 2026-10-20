import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../../../../config/redis';
import { ReleaseService } from '../../../release.service';
import { prisma } from '../../../../db';
import logger from '../../../../utils/logger';
import { 
  SCHEDULED_RELEASE_QUEUE_NAME, 
  DEPLOYMENT_QUEUE_NAME 
} from './scheduled-release.queue';

export const startReleaseWorker = (): Worker[] => {
  // 1. Worker for periodic scheduled releases sweep
  const cronWorker = new Worker(
    'releases-queue',
    async (job: Job) => {
      switch (job.name) {
        case 'execute-scheduled-releases':
          await processScheduledReleases();
          break;
        case 'execute-release':
          if (job.data && job.data.releaseId) {
            await ReleaseService.executeRelease(job.data.releaseId);
          }
          break;
        default:
          logger.warn(`[ReleaseWorker] Unknown job type: ${job.name}`);
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: 1,
    }
  );

  // 2. Worker for delayed scheduled release jobs
  const scheduledWorker = new Worker(
    SCHEDULED_RELEASE_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'execute-scheduled-release') {
        const { releaseId, projectId } = job.data;
        logger.info(`[ScheduledReleaseWorker] Delayed job fired for release ${releaseId}`);

        const release = await prisma.release.findUnique({
          where: { id: releaseId }
        });

        if (release && release.status === 'SCHEDULED') {
          await ReleaseService.executeRelease(releaseId, projectId);
          logger.info(`[ScheduledReleaseWorker] Release ${releaseId} execution initiated`);
        } else {
          logger.info(`[ScheduledReleaseWorker] Skipping release ${releaseId} (current status: ${release?.status})`);
        }
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: 2,
    }
  );

  // 3. Worker for multi-stage deployment processing
  const deploymentWorker = new Worker(
    DEPLOYMENT_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'process-deployment') {
        const { releaseId } = job.data;
        logger.info(`[DeploymentWorker] Processing deployment job for release ${releaseId}`);
        await ReleaseService.performDeployment(releaseId);
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: 1, // Run 1 deployment at a time for safety
    }
  );

  const workers = [cronWorker, scheduledWorker, deploymentWorker];

  workers.forEach((w) => {
    w.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[ReleaseWorker] Queue ${w.name} job ${job?.id} failed:`, err);
    });
  });

  return workers;
};

/**
 * Fallback cron sweep for any SCHEDULED releases
 * that have reached their scheduledAt time.
 */
async function processScheduledReleases() {
  const pendingReleases = await prisma.release.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: {
        lte: new Date(),
      },
    },
  });

  for (const release of pendingReleases) {
    try {
      logger.info(`[ReleaseWorker:Cron] Executing overdue scheduled release ${release.id}...`);
      await ReleaseService.executeRelease(release.id, release.projectId);
    } catch (error) {
      logger.error(`[ReleaseWorker:Cron] Failed to initiate execution for release ${release.id}:`, error);
    }
  }
}
