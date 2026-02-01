import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { JOB_SEND_WELCOME_EMAIL } from '../constants/queues';

export const WELCOME_EMAIL_QUEUE_NAME = 'welcome-email-queue';

export interface SendWelcomeEmailJobData {
  email: string;
  firstName: string;
}

export const welcomeEmailQueue = new Queue<SendWelcomeEmailJobData>(WELCOME_EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions
});

export async function enqueueSendWelcomeEmailJob(data: SendWelcomeEmailJobData): Promise<void> {
  await welcomeEmailQueue.add(JOB_SEND_WELCOME_EMAIL, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: 50
  });
}
