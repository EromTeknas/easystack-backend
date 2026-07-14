import { enqueueSendOtpEmailJob } from "../../../queues/email-otp.queue";
import { enqueueSendPasswordResetEmailJob } from "../../../queues/password-reset.queue";
import { enqueueSendWelcomeEmailJob } from "../../../queues/welcome-email.queue";
import type { AuthenticationNotifier } from "./authentication-notifier";

export class BullMqAuthenticationNotifier implements AuthenticationNotifier {
  sendVerificationOtp(input: {
    email: string;
    firstName: string;
    otpCode: string;
  }): Promise<void> {
    return enqueueSendOtpEmailJob(input);
  }

  sendPasswordReset(input: {
    email: string;
    firstName: string;
    token: string;
  }): Promise<void> {
    return enqueueSendPasswordResetEmailJob(input);
  }

  sendWelcome(input: {
    email: string;
    firstName: string;
  }): Promise<void> {
    return enqueueSendWelcomeEmailJob(input);
  }
}
