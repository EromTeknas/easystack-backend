import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../../../../config/redis';

export const releaseQueue = new Queue('releases-queue', {
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
