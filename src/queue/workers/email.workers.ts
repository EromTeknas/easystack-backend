import { Job, Worker } from "bullmq";
import { sendOtpEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../../services/email.service";
import { createQueueWorker } from "../core/worker";
import {
  SendOtpEmailJobData,
  SendPasswordResetEmailJobData,
  SendWelcomeEmailJobData,
  sendOtpEmailJob,
  sendPasswordResetEmailJob,
  sendWelcomeEmailJob,
} from "../jobs/email.jobs";

export function createEmailWorkers(): Worker[] {
  return [
    createQueueWorker<SendOtpEmailJobData>({
      id: "email-otp",
      group: "email",
      queueName: sendOtpEmailJob.queueName,
      processor: async (job: Job<SendOtpEmailJobData>) => {
        const { email, firstName, otpCode } = job.data;
        if (!(await sendOtpEmail(email, firstName, otpCode))) {
          throw new Error("Failed to send OTP email");
        }
      },
    }),
    createQueueWorker<SendPasswordResetEmailJobData>({
      id: "password-reset-email",
      group: "email",
      queueName: sendPasswordResetEmailJob.queueName,
      processor: async (job: Job<SendPasswordResetEmailJobData>) => {
        const { email, firstName, token } = job.data;
        if (!(await sendPasswordResetEmail(email, firstName, token))) {
          throw new Error("Failed to send password reset email");
        }
      },
    }),
    createQueueWorker<SendWelcomeEmailJobData>({
      id: "welcome-email",
      group: "email",
      queueName: sendWelcomeEmailJob.queueName,
      processor: async (job: Job<SendWelcomeEmailJobData>) => {
        const { email, firstName } = job.data;
        if (!(await sendWelcomeEmail(email, firstName))) {
          throw new Error("Failed to send welcome email");
        }
      },
    }),
  ];
}
