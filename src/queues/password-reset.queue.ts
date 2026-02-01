import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { JOB_SEND_PASSWORD_RESET_EMAIL } from '../constants/queues';

export const PASSWORD_RESET_QUEUE_NAME = 'password-reset-queue';

export interface SendPasswordResetEmailJobData {
  email: string;
  firstName: string;
  token: string;
}

export const passwordResetQueue = new Queue<SendPasswordResetEmailJobData>(PASSWORD_RESET_QUEUE_NAME, {
  connection: redisConnectionOptions
});

export async function enqueueSendPasswordResetEmailJob(data: SendPasswordResetEmailJobData): Promise<void> {
  await passwordResetQueue.add(JOB_SEND_PASSWORD_RESET_EMAIL, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: 50
  });
}
