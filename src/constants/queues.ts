// Centralized queue and job name constants

export const QUEUE_ID_EMAIL_OTP = 'email-otp' as const;
export const QUEUE_ID_PASSWORD_RESET = 'password-reset' as const;
export const QUEUE_ID_WELCOME_EMAIL = 'welcome-email' as const;

export type QueueId =
  | typeof QUEUE_ID_EMAIL_OTP
  | typeof QUEUE_ID_PASSWORD_RESET
  | typeof QUEUE_ID_WELCOME_EMAIL;

export const JOB_SEND_OTP_EMAIL = 'SEND_OTP_EMAIL' as const;
export const JOB_SEND_PASSWORD_RESET_EMAIL = 'SEND_PASSWORD_RESET_EMAIL' as const;
export const JOB_SEND_WELCOME_EMAIL = 'SEND_WELCOME_EMAIL' as const;
