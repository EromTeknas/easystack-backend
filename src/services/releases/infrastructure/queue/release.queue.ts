import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../../../../config/redis';

export const RELEASES_QUEUE_NAME = 'releases-queue';

export const releaseQueue = new Queue(RELEASES_QUEUE_NAME, {
  connection: redisConnectionOptions,
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
