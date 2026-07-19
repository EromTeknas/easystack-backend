import { enqueue } from "../core/queue";
import {
  SendOtpEmailJobData,
  SendPasswordResetEmailJobData,
  SendWelcomeEmailJobData,
  sendOtpEmailJob,
  sendPasswordResetEmailJob,
  sendWelcomeEmailJob,
} from "../jobs/email.jobs";

export const enqueueSendOtpEmailJob = (data: SendOtpEmailJobData): Promise<void> =>
  enqueue(sendOtpEmailJob, data);

export const enqueueSendPasswordResetEmailJob = (
  data: SendPasswordResetEmailJobData,
): Promise<void> => enqueue(sendPasswordResetEmailJob, data);

export const enqueueSendWelcomeEmailJob = (data: SendWelcomeEmailJobData): Promise<void> =>
  enqueue(sendWelcomeEmailJob, data);
