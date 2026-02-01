import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { EMAIL_OTP_QUEUE_NAME, SendOtpEmailJobData } from '../queues/email-otp.queue';
import { redisConnectionOptions } from '../config/redis';
import logger from '../utils/logger';
import { sendOtpEmail } from '../services/email.service';

const worker = new Worker<SendOtpEmailJobData>(
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
  {
    connection: redisConnectionOptions
  }
);

worker.on('completed', (job: Job) => {
  logger.info('Email OTP job completed', { jobId: job.id });
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error('Email OTP job failed', { jobId: job?.id, error: err });
});

logger.info('Email OTP worker started');
