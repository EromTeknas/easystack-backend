import type { QueueDescriptor } from "../../../../infrastructure/queue";

export const EMAIL_QUEUE_NAME = "email";

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

export type EmailJobData =
  | SendOtpEmailJobData
  | SendPasswordResetEmailJobData
  | SendWelcomeEmailJobData;

export const sendOtpEmailJob: QueueDescriptor<SendOtpEmailJobData> = {
  queueName: EMAIL_QUEUE_NAME,
  jobName: "SEND_OTP_EMAIL",
  defaultJobOptions: EMAIL_JOB_OPTIONS,
  describe: ({ email }) => ({ email }),
};

export const sendPasswordResetEmailJob: QueueDescriptor<SendPasswordResetEmailJobData> = {
  queueName: EMAIL_QUEUE_NAME,
  jobName: "SEND_PASSWORD_RESET_EMAIL",
  defaultJobOptions: EMAIL_JOB_OPTIONS,
  describe: ({ email }) => ({ email }),
};

export const sendWelcomeEmailJob: QueueDescriptor<SendWelcomeEmailJobData> = {
  queueName: EMAIL_QUEUE_NAME,
  jobName: "SEND_WELCOME_EMAIL",
  defaultJobOptions: EMAIL_JOB_OPTIONS,
  describe: ({ email }) => ({ email }),
};
