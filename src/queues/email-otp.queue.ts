import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

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
  await emailOtpQueue.add('SEND_OTP_EMAIL', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: 50
  });
}
