import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import redisConnectionOptions from './redis';
import { TRANSLATION_QUEUE_NAME } from '../services/feed/infrastructure/queue/translation.queue';
import { EMAIL_QUEUE_NAME } from '../services/email/infrastructure/queue/email.jobs';
import { STORAGE_QUEUE_NAME } from '../services/storage/infrastructure/queue/storage.jobs';

export const setupBullBoard = (app: any) => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  // Register Queues
  const translationQueue = new Queue(TRANSLATION_QUEUE_NAME, { connection: redisConnectionOptions as any });
  const emailQueue = new Queue(EMAIL_QUEUE_NAME, { connection: redisConnectionOptions as any });
  const storageQueue = new Queue(STORAGE_QUEUE_NAME, { connection: redisConnectionOptions as any });

  createBullBoard({
    queues: [
      new BullMQAdapter(translationQueue),
      new BullMQAdapter(emailQueue),
      new BullMQAdapter(storageQueue)
    ],
    serverAdapter: serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());
};
