import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { PASSWORD_RESET_QUEUE_NAME, SendPasswordResetEmailJobData } from '../queues/password-reset.queue';
import { redisConnectionOptions } from '../config/redis';
import logger from '../utils/logger';
import { sendPasswordResetEmail } from '../services/email.service';

const worker = new Worker<SendPasswordResetEmailJobData>(
  PASSWORD_RESET_QUEUE_NAME,
  async (job: Job<SendPasswordResetEmailJobData>) => {
    const { email, firstName, token, userId } = job.data;

    logger.info('Processing SEND_PASSWORD_RESET_EMAIL job', {
      jobId: job.id,
      email,
      userId
    });

    const success = await sendPasswordResetEmail(email, firstName, token, userId);
    if (!success) {
      throw new Error('Failed to send password reset email');
    }

    logger.info('SEND_PASSWORD_RESET_EMAIL job completed', {
      jobId: job.id,
      email,
      userId
    });
  },
  {
    connection: redisConnectionOptions
  }
);

worker.on('completed', (job: Job) => {
  logger.info('Password reset job completed', { jobId: job.id });
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error('Password reset job failed', { jobId: job?.id, error: err });
});

logger.info('Password reset worker started');
