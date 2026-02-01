import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import logger from '../utils/logger';
import { EMAIL_OTP_QUEUE_NAME, SendOtpEmailJobData } from '../queues/email-otp.queue';
import { PASSWORD_RESET_QUEUE_NAME, SendPasswordResetEmailJobData } from '../queues/password-reset.queue';
import { WELCOME_EMAIL_QUEUE_NAME, SendWelcomeEmailJobData } from '../queues/welcome-email.queue';
import { sendOtpEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.service';

/**
 * Configurable BullMQ worker entrypoint.
 *
 * Supports running workers for one or many queues in a single process.
 *
 * Configuration options:
 * - WORKER_QUEUES env var: comma-separated list of queue ids, e.g. "email-otp,password-reset".
 *   If omitted, defaults to all known queues.
 * - Optionally, first CLI arg can override: `ts-node src/workers/index.worker.ts email-otp,password-reset`.
 */

// Known queue identifiers and their factories

type QueueId = 'email-otp' | 'password-reset' | 'welcome-email';

interface WorkerConfig {
  id: QueueId;
  queueName: string;
  createWorker: () => Worker;
}

const workerConfigs: WorkerConfig[] = [
  {
    id: 'email-otp',
    queueName: EMAIL_OTP_QUEUE_NAME,
    createWorker: () =>
      new Worker<SendOtpEmailJobData>(
        EMAIL_OTP_QUEUE_NAME,
        async (job: Job<SendOtpEmailJobData>) => {
          const { email, firstName, otpCode } = job.data;

          logger.info('Processing SEND_OTP_EMAIL job', {
            jobId: job.id,
            email
          });

          const success = await sendOtpEmail(email, firstName, otpCode);
          if (!success) {
            throw new Error('Failed to send OTP email');
          }

          logger.info('SEND_OTP_EMAIL job completed', {
            jobId: job.id,
            email
          });
        },
        { connection: redisConnectionOptions }
      )
  },
  {
    id: 'password-reset',
    queueName: PASSWORD_RESET_QUEUE_NAME,
    createWorker: () =>
      new Worker<SendPasswordResetEmailJobData>(
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
        { connection: redisConnectionOptions }
      )
  },
  {
    id: 'welcome-email',
    queueName: WELCOME_EMAIL_QUEUE_NAME,
    createWorker: () =>
      new Worker<SendWelcomeEmailJobData>(
        WELCOME_EMAIL_QUEUE_NAME,
        async (job: Job<SendWelcomeEmailJobData>) => {
          const { email, firstName } = job.data;

          logger.info('Processing SEND_WELCOME_EMAIL job', {
            jobId: job.id,
            email
          });

          const success = await sendWelcomeEmail(email, firstName);
          if (!success) {
            throw new Error('Failed to send welcome email');
          }

          logger.info('SEND_WELCOME_EMAIL job completed', {
            jobId: job.id,
            email
          });
        },
        { connection: redisConnectionOptions }
      )
  }
];

function parseEnabledQueues(): QueueId[] {
  // CLI arg takes precedence if provided: `ts-node ... email-otp,password-reset`
  const cliArg = process.argv[2];
  const raw = cliArg || process.env.WORKER_QUEUES;

  if (!raw || raw.trim() === '') {
    // Default: all queues
    return workerConfigs.map((c) => c.id);
  }

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is QueueId => s === 'email-otp' || s === 'password-reset' || s === 'welcome-email');
}

function main() {
  const enabledIds = parseEnabledQueues();

  if (enabledIds.length === 0) {
    logger.warn('No valid queues configured for worker. Exiting.');
    process.exit(0);
  }

  logger.info('Starting workers for queues', { queues: enabledIds });

  const workers: Worker[] = [];

  for (const cfg of workerConfigs) {
    if (!enabledIds.includes(cfg.id)) continue;

    const worker = cfg.createWorker();

    worker.on('completed', (job: Job) => {
      logger.info('Job completed', { queue: cfg.id, jobId: job.id });
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error('Job failed', { queue: cfg.id, jobId: job?.id, error: err });
    });

    workers.push(worker);
  }

  logger.info('Worker process started');
}

main();
