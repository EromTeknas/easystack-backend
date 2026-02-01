import crypto from 'crypto';
import { redisClient } from '../config/redis';
import { auth } from '../config/auth';

const PASSWORD_RESET_PREFIX = 'password_reset:';

interface PasswordResetRecord {
  userId: string;
}

function getPasswordResetKey(token: string): string {
  return `${PASSWORD_RESET_PREFIX}${token}`;
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Generate high-entropy token
  const token = crypto.randomBytes(32).toString('hex');
  const key = getPasswordResetKey(token);

  await redisClient.hset(key, {
    userId
  });

  const ttlSeconds = auth.passwordReset.expiryMinutes * 60;
  await redisClient.expire(key, ttlSeconds);

  return token;
}

async function getPasswordResetRecord(token: string): Promise<PasswordResetRecord | null> {
  const key = getPasswordResetKey(token);
  const data = await redisClient.hgetall(key);
  if (!data || Object.keys(data).length === 0 || !data.userId) {
    return null;
  }
  return { userId: data.userId };
}

// Returns the associated userId if token is valid and consumed; otherwise null
export async function verifyAndConsumePasswordResetToken(token: string): Promise<string | null> {
  const key = getPasswordResetKey(token);
  const record = await getPasswordResetRecord(token);

  if (!record) {
    return null;
  }

  // Invalidate token immediately after successful use
  await redisClient.del(key);
  return record.userId;
}
