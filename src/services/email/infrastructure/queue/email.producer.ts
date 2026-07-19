import { queueClient } from "../../../../infrastructure/queue";
import {
  SendOtpEmailJobData,
  SendPasswordResetEmailJobData,
  SendWelcomeEmailJobData,
  sendOtpEmailJob,
  sendPasswordResetEmailJob,
  sendWelcomeEmailJob,
} from "./email.jobs";

export const enqueueSendOtpEmailJob = (data: SendOtpEmailJobData): Promise<void> =>
  queueClient.enqueue(sendOtpEmailJob, data);

export const enqueueSendPasswordResetEmailJob = (
  data: SendPasswordResetEmailJobData,
): Promise<void> => queueClient.enqueue(sendPasswordResetEmailJob, data);

export const enqueueSendWelcomeEmailJob = (data: SendWelcomeEmailJobData): Promise<void> =>
  queueClient.enqueue(sendWelcomeEmailJob, data);
