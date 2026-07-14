import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { JOB_SEND_OTP_EMAIL } from '../constants/queues';
import logger from '../utils/logger';

export const EMAIL_OTP_QUEUE_NAME = 'email-otp-queue';

export interface SendOtpEmailJobData {
  email: string;
  firstName: string;
  otpCode: string;
}

export const emailOtpQueue = new Queue<SendOtpEmailJobData>(EMAIL_OTP_QUEUE_NAME, {
  connection: redisConnectionOptions
});

export async function enqueueSendOtpEmailJob(data: SendOtpEmailJobData): Promise<void> {
  logger.info('Adding OTP email job to queue', {
    queue: EMAIL_OTP_QUEUE_NAME,
    jobName: JOB_SEND_OTP_EMAIL,
    email: data.email,
  });

  const job = await emailOtpQueue.add(JOB_SEND_OTP_EMAIL, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: 50
  });

  logger.info('OTP email job added to queue', {
    queue: EMAIL_OTP_QUEUE_NAME,
    jobName: JOB_SEND_OTP_EMAIL,
    jobId: job.id,
    email: data.email,
  });
}
