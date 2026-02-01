import { redisClient } from '../config/redis';
import { auth } from '../config/auth';
import { hashToken, verifyTokenHash } from '../utils/password';

const PASSWORD_RESET_PREFIX = 'password_reset:';

interface PasswordResetRecord {
  hash: string;
}

function getPasswordResetKey(userId: string): string {
  return `${PASSWORD_RESET_PREFIX}${userId}`;
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Generate high-entropy token
  const token = require('crypto').randomBytes(32).toString('hex');
  const tokenHash = await hashToken(token);

  const key = getPasswordResetKey(userId);

  await redisClient.hset(key, {
    hash: tokenHash
  });

  const ttlSeconds = auth.passwordReset.expiryMinutes * 60;
  await redisClient.expire(key, ttlSeconds);

  return token;
}

async function getPasswordResetRecord(userId: string): Promise<PasswordResetRecord | null> {
  const key = getPasswordResetKey(userId);
  const data = await redisClient.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  return { hash: data.hash! };
}

export async function verifyAndConsumePasswordResetToken(userId: string, token: string): Promise<boolean> {
  const key = getPasswordResetKey(userId);
  const record = await getPasswordResetRecord(userId);

  if (!record) {
    return false;
  }

  const isValid = await verifyTokenHash(token, record.hash);
  if (!isValid) {
    return false;
  }

  // Invalidate token immediately after successful use
  await redisClient.del(key);
  return true;
}
