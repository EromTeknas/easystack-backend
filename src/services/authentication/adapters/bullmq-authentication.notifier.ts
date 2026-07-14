import { enqueueSendOtpEmailJob } from "../../../queues/email-otp.queue";
import { enqueueSendPasswordResetEmailJob } from "../../../queues/password-reset.queue";
import { enqueueSendWelcomeEmailJob } from "../../../queues/welcome-email.queue";
import logger from "../../../utils/logger";
import type { AuthenticationNotifier } from "./authentication-notifier";

export class BullMqAuthenticationNotifier implements AuthenticationNotifier {
  sendVerificationOtp(input: {
    email: string;
    firstName: string;
    otpCode: string;
  }): Promise<void> {
    logger.info("Queueing authentication verification OTP email", {
      email: input.email,
    });

    return enqueueSendOtpEmailJob(input);
  }

  sendPasswordReset(input: {
    email: string;
    firstName: string;
    token: string;
  }): Promise<void> {
    logger.info("Queueing authentication password reset email", {
      email: input.email,
    });

    return enqueueSendPasswordResetEmailJob(input);
  }

  sendWelcome(input: {
    email: string;
    firstName: string;
  }): Promise<void> {
    logger.info("Queueing authentication welcome email", {
      email: input.email,
    });

    return enqueueSendWelcomeEmailJob(input);
  }
}
