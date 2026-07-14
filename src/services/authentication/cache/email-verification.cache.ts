import { randomBytes, randomUUID } from "node:crypto";

import { redisClient } from "../../../config/redis";
import { auth } from "../../../config/auth";
import { authenticationConfig } from "../config/authentication.config";
import type { EmailVerificationRecord } from "../types/cache.types";
import { AuthenticationCacheKeys } from "./authentication-cache.keys";

export class EmailVerificationCache {
  async create(input: {
    userId: string;
    email: string;
    otpHash: string;
    planKey: string;
  }): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const key = AuthenticationCacheKeys.emailVerification(token);
    const userKey = AuthenticationCacheKeys.emailVerificationForUser(
      input.userId,
    );
    const ttl = auth.otp.expiryMinutes * 60;

    const record: EmailVerificationRecord = {
      userId: input.userId,
      email: input.email,
      otpHash: input.otpHash,
      purpose: "EMAIL_VERIFICATION",
      attempts: 0,
      maxAttempts: auth.otp.maxAttempts,
      planKey: input.planKey,
    };

    const previousKey = await redisClient.get(userKey);
    const pipeline = redisClient.multi();

    if (previousKey) {
      pipeline.del(previousKey);
    }

    pipeline.set(key, JSON.stringify(record), "EX", ttl);
    pipeline.set(userKey, key, "EX", ttl);
    await pipeline.exec();

    return token;
  }

  async get(token: string): Promise<EmailVerificationRecord | null> {
    const value = await redisClient.get(
      AuthenticationCacheKeys.emailVerification(token),
    );

    if (!value) {
      return null;
    }

    try {
      const record = JSON.parse(value) as EmailVerificationRecord;
      const currentKey = await redisClient.get(
        AuthenticationCacheKeys.emailVerificationForUser(record.userId),
      );
      const tokenKey = AuthenticationCacheKeys.emailVerification(token);

      if (currentKey !== tokenKey) {
        await redisClient.del(tokenKey);
        return null;
      }

      return record;
    } catch {
      await this.delete(token);
      return null;
    }
  }

  async replaceOtp(token: string, otpHash: string): Promise<boolean> {
    const record = await this.get(token);

    if (!record) {
      return false;
    }

    record.otpHash = otpHash;
    record.attempts = 0;

    await redisClient.set(
      AuthenticationCacheKeys.emailVerification(token),
      JSON.stringify(record),
      "EX",
      auth.otp.expiryMinutes * 60,
    );

    return true;
  }

  async incrementAttempts(token: string): Promise<EmailVerificationRecord | null> {
    const key = AuthenticationCacheKeys.emailVerification(token);

    const script = `
      local value = redis.call('GET', KEYS[1])
      if not value then return nil end
      local record = cjson.decode(value)
      record.attempts = (record.attempts or 0) + 1
      local ttl = redis.call('TTL', KEYS[1])
      if ttl <= 0 then ttl = tonumber(ARGV[1]) end
      redis.call('SET', KEYS[1], cjson.encode(record), 'EX', ttl)
      return cjson.encode(record)
    `;

    const result = await redisClient.eval(
      script,
      1,
      key,
      auth.otp.expiryMinutes * 60,
    );

    return result ? (JSON.parse(String(result)) as EmailVerificationRecord) : null;
  }

  async delete(token: string): Promise<void> {
    const key = AuthenticationCacheKeys.emailVerification(token);
    const record = await this.getWithoutCleanup(key);

    if (!record) {
      await redisClient.del(key);
      return;
    }

    const userKey = AuthenticationCacheKeys.emailVerificationForUser(
      record.userId,
    );
    const script = `
      redis.call('DEL', KEYS[1])
      if redis.call('GET', KEYS[2]) == KEYS[1] then
        redis.call('DEL', KEYS[2])
      end
      return 1
    `;

    await redisClient.eval(script, 2, key, userKey);
  }

  async acquireLock(token: string): Promise<string | null> {
    const owner = randomUUID();
    const result = await redisClient.set(
      AuthenticationCacheKeys.emailVerificationLock(token),
      owner,
      "EX",
      authenticationConfig.verificationLockSeconds,
      "NX",
    );

    return result === "OK" ? owner : null;
  }

  async releaseLock(token: string, owner: string): Promise<void> {
    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `;

    await redisClient.eval(
      script,
      1,
      AuthenticationCacheKeys.emailVerificationLock(token),
      owner,
    );
  }

  private async getWithoutCleanup(
    key: string,
  ): Promise<EmailVerificationRecord | null> {
    const value = await redisClient.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as EmailVerificationRecord;
    } catch {
      return null;
    }
  }
}
