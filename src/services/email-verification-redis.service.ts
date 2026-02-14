import crypto from 'crypto';
import { redisClient } from '../config/redis';
import { auth } from '../config/auth';

const EMAIL_VERIFICATION_PREFIX = 'email_verification:';

export type EmailVerificationPurpose = 'EMAIL_VERIFICATION';

export interface EmailVerificationRecord {
  userId: string;
  email: string;
  purpose: EmailVerificationPurpose;
  otpHash: string;
}

function getEmailVerificationKey(token: string): string {
  return `${EMAIL_VERIFICATION_PREFIX}${token}`;
}

/**
 * Create a short-lived email verification token stored in Redis.
 * The token maps to userId, email, otpHash, and purpose so that the
 * verification endpoint can be called using only the token + OTP.
 */
export async function createEmailVerificationToken(
  userId: string,
  email: string,
  otpHash: string,
  purpose: EmailVerificationPurpose = 'EMAIL_VERIFICATION'
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const key = getEmailVerificationKey(token);

  await redisClient.hset(key, {
    userId,
    email,
    otpHash,
    purpose
  });

  const ttlSeconds = auth.otp.expiryMinutes * 60;
  await redisClient.expire(key, ttlSeconds);

  return token;
}

export async function getEmailVerificationRecord(token: string): Promise<EmailVerificationRecord | null> {
  const key = getEmailVerificationKey(token);
  const data = await redisClient.hgetall(key);

  if (!data || Object.keys(data).length === 0 || !data.userId || !data.email || !data.otpHash || !data.purpose) {
    return null;
  }

  return {
    userId: data.userId,
    email: data.email,
    otpHash: data.otpHash,
    purpose: data.purpose as EmailVerificationPurpose
  };
}

export async function deleteEmailVerificationToken(token: string): Promise<void> {
  const key = getEmailVerificationKey(token);
  await redisClient.del(key);
}

export async function updateEmailVerificationOtpHash(token: string, otpHash: string): Promise<void> {
  const key = getEmailVerificationKey(token);
  await redisClient.hset(key, { otpHash });

  // Optionally refresh TTL to give the new OTP a full validity window
  const ttlSeconds = auth.otp.expiryMinutes * 60;
  await redisClient.expire(key, ttlSeconds);
}
