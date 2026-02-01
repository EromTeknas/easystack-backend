import { redisClient } from '../config/redis';
import { auth } from '../config/auth';
import { verifyOtp } from '../utils/otp';

const OTP_PREFIX = 'email_otp:';

interface OtpRedisRecord {
  hash: string;
  attempts: number;
  maxAttempts: number;
}

function getOtpKey(userId: string): string {
  return `${OTP_PREFIX}${userId}`;
}

export async function storeUserOtp(userId: string, otpHash: string): Promise<void> {
  const key = getOtpKey(userId);
  const maxAttempts = auth.otp.maxAttempts;

  await redisClient.hset(key, {
    hash: otpHash,
    attempts: '0',
    maxAttempts: String(maxAttempts)
  });

  // Set TTL in seconds
  const ttlSeconds = auth.otp.expiryMinutes * 60;
  await redisClient.expire(key, ttlSeconds);
}

export async function deleteUserOtp(userId: string): Promise<void> {
  const key = getOtpKey(userId);
  await redisClient.del(key);
}

export async function getUserOtpRecord(userId: string): Promise<OtpRedisRecord | null> {
  const key = getOtpKey(userId);
  const data = await redisClient.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    hash: data.hash!,
    attempts: parseInt(data.attempts || '0', 10),
    maxAttempts: parseInt(data.maxAttempts || String(auth.otp.maxAttempts), 10)
  };
}

export type OtpVerificationStatus = 'VALID' | 'INVALID' | 'NOT_FOUND' | 'TOO_MANY_ATTEMPTS';

export interface OtpVerificationResult {
  status: OtpVerificationStatus;
  attempts?: number;
  maxAttempts?: number;
}

export async function verifyUserOtpFromRedis(userId: string, otpCode: string): Promise<OtpVerificationResult> {
  const key = getOtpKey(userId);
  const record = await getUserOtpRecord(userId);

  if (!record) {
    return { status: 'NOT_FOUND' };
  }

  if (record.attempts >= record.maxAttempts) {
    return {
      status: 'TOO_MANY_ATTEMPTS',
      attempts: record.attempts,
      maxAttempts: record.maxAttempts
    };
  }

  const isValid = await verifyOtp(otpCode, record.hash);

  if (!isValid) {
    const attempts = await redisClient.hincrby(key, 'attempts', 1);
    return {
      status: 'INVALID',
      attempts,
      maxAttempts: record.maxAttempts
    };
  }

  // Valid OTP - delete key to prevent reuse
  await deleteUserOtp(userId);

  return { status: 'VALID' };
}
