import type { QueueDescriptor } from "../core/queue";

const EMAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export interface SendOtpEmailJobData {
  email: string;
  firstName: string;
  otpCode: string;
}

export interface SendPasswordResetEmailJobData {
  email: string;
  firstName: string;
  token: string;
}

export interface SendWelcomeEmailJobData {
  email: string;
  firstName: string;
}

export const sendOtpEmailJob: QueueDescriptor<SendOtpEmailJobData> = {
  queueName: "email-otp-queue",
  jobName: "SEND_OTP_EMAIL",
  defaultJobOptions: EMAIL_JOB_OPTIONS,
  describe: ({ email }) => ({ email }),
};

export const sendPasswordResetEmailJob: QueueDescriptor<SendPasswordResetEmailJobData> = {
  queueName: "password-reset-queue",
  jobName: "SEND_PASSWORD_RESET_EMAIL",
  defaultJobOptions: EMAIL_JOB_OPTIONS,
  describe: ({ email }) => ({ email }),
};

export const sendWelcomeEmailJob: QueueDescriptor<SendWelcomeEmailJobData> = {
  queueName: "welcome-email-queue",
  jobName: "SEND_WELCOME_EMAIL",
  defaultJobOptions: EMAIL_JOB_OPTIONS,
  describe: ({ email }) => ({ email }),
};
