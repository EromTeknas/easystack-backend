import type { Job } from "bullmq";
import { sendOtpEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../../../email.service";
import {
  EmailJobData,
  SendOtpEmailJobData,
  SendPasswordResetEmailJobData,
  SendWelcomeEmailJobData,
  sendOtpEmailJob,
  sendPasswordResetEmailJob,
  sendWelcomeEmailJob,
} from "./email.jobs";

export interface EmailJobHandlers {
  sendOtp(email: string, firstName: string, otpCode: string): Promise<boolean>;
  sendPasswordReset(email: string, firstName: string, token: string): Promise<boolean>;
  sendWelcome(email: string, firstName: string): Promise<boolean>;
}

const defaultHandlers: EmailJobHandlers = {
  sendOtp: sendOtpEmail,
  sendPasswordReset: sendPasswordResetEmail,
  sendWelcome: sendWelcomeEmail,
};

export class EmailJobProcessor {
  constructor(private readonly handlers: EmailJobHandlers = defaultHandlers) {}

  async process(job: Job<EmailJobData>): Promise<void> {
    switch (job.name) {
      case sendOtpEmailJob.jobName:
        return this.sendOtp(job.data as SendOtpEmailJobData);
      case sendPasswordResetEmailJob.jobName:
        return this.sendPasswordReset(job.data as SendPasswordResetEmailJobData);
      case sendWelcomeEmailJob.jobName:
        return this.sendWelcome(job.data as SendWelcomeEmailJobData);
      default:
        throw new Error(`Unsupported email job: ${job.name}`);
    }
  }

  private async sendOtp(data: SendOtpEmailJobData): Promise<void> {
    if (!(await this.handlers.sendOtp(data.email, data.firstName, data.otpCode))) {
      throw new Error("Failed to send OTP email");
    }
  }

  private async sendPasswordReset(data: SendPasswordResetEmailJobData): Promise<void> {
    if (!(await this.handlers.sendPasswordReset(data.email, data.firstName, data.token))) {
      throw new Error("Failed to send password reset email");
    }
  }

  private async sendWelcome(data: SendWelcomeEmailJobData): Promise<void> {
    if (!(await this.handlers.sendWelcome(data.email, data.firstName))) {
      throw new Error("Failed to send welcome email");
    }
  }
}
