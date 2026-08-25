import { Queue } from 'bullmq';
import redisConnectionOptions from '../../../../config/redis';

export const TRANSLATION_QUEUE_NAME = 'translation-queue';

export const translationQueue = new Queue(TRANSLATION_QUEUE_NAME, {
  connection: redisConnectionOptions as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
