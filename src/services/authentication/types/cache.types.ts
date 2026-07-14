export type EmailVerificationPurpose = "EMAIL_VERIFICATION";

export interface EmailVerificationRecord {
  userId: string;
  email: string;
  otpHash: string;
  purpose: EmailVerificationPurpose;
  attempts: number;
  maxAttempts: number;
  planKey: string;
}

export interface PasswordResetRecord {
  userId: string;
}
