import { queueClient } from "../../../../infrastructure/queue";
import {
  SendOtpEmailJobData,
  SendPasswordResetEmailJobData,
  SendWelcomeEmailJobData,
  sendOtpEmailJob,
  sendPasswordResetEmailJob,
  sendWelcomeEmailJob,
  sendWorkspaceInviteEmailJob,
  SendWorkspaceInviteEmailJobData,
  sendReleaseNotificationEmailJob,
  SendReleaseNotificationEmailJobData,
} from "./email.jobs";

export const enqueueSendOtpEmailJob = (data: SendOtpEmailJobData): Promise<void> =>
  queueClient.enqueue(sendOtpEmailJob, data);

export const enqueueSendPasswordResetEmailJob = (
  data: SendPasswordResetEmailJobData,
): Promise<void> => queueClient.enqueue(sendPasswordResetEmailJob, data);

export const enqueueSendWelcomeEmailJob = (data: SendWelcomeEmailJobData): Promise<void> =>
  queueClient.enqueue(sendWelcomeEmailJob, data);

export const enqueueSendWorkspaceInviteEmailJob = (data: SendWorkspaceInviteEmailJobData): Promise<void> =>
  queueClient.enqueue(sendWorkspaceInviteEmailJob, data);

export const enqueueSendReleaseNotificationEmailJob = (data: SendReleaseNotificationEmailJobData): Promise<void> =>
  queueClient.enqueue(sendReleaseNotificationEmailJob, data);

