import { randomBytes, randomUUID } from "node:crypto";

import { redisClient } from "../../../config/redis";
import { auth } from "../../../config/auth";
import { authenticationConfig } from "../config/authentication.config";
import type { PasswordResetRecord } from "../types/cache.types";
import { AuthenticationCacheKeys } from "./authentication-cache.keys";

export class PasswordResetCache {
  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const key = AuthenticationCacheKeys.passwordReset(token);
    const userKey = AuthenticationCacheKeys.passwordResetForUser(userId);
    const ttl = auth.passwordReset.expiryMinutes * 60;
    const record: PasswordResetRecord = { userId };

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

  async get(token: string): Promise<PasswordResetRecord | null> {
    const value = await redisClient.get(
      AuthenticationCacheKeys.passwordReset(token),
    );

    if (!value) {
      return null;
    }

    try {
      const record = JSON.parse(value) as PasswordResetRecord;
      const currentKey = await redisClient.get(
        AuthenticationCacheKeys.passwordResetForUser(record.userId),
      );
      const tokenKey = AuthenticationCacheKeys.passwordReset(token);

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

  async delete(token: string): Promise<void> {
    const key = AuthenticationCacheKeys.passwordReset(token);
    const value = await redisClient.get(key);

    if (!value) {
      await redisClient.del(key);
      return;
    }

    let record: PasswordResetRecord;

    try {
      record = JSON.parse(value) as PasswordResetRecord;
    } catch {
      await redisClient.del(key);
      return;
    }

    const userKey = AuthenticationCacheKeys.passwordResetForUser(record.userId);
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
      `${AuthenticationCacheKeys.passwordReset(token)}:lock`,
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
      `${AuthenticationCacheKeys.passwordReset(token)}:lock`,
      owner,
    );
  }
}
