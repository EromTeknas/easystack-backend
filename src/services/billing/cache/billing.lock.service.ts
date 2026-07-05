import { randomUUID } from "node:crypto";

import redis from "../../../config/redis";

const BILLING_LOCK_PREFIX = "billing:v1:lock:user";
const BILLING_LOCK_TTL_SECONDS = 15;
const BILLING_LOCK_WAIT_TIMEOUT_MS = 5_000;
const BILLING_LOCK_RETRY_DELAY_MS = 50;

export class BillingLockService {
  static async withUserLock<T>(
    userId: number,
    handler: () => Promise<T>,
    options?: {
      waitTimeoutMs?: number;
      ttlSeconds?: number;
    },
  ): Promise<T> {
    const lockKey = `${BILLING_LOCK_PREFIX}:${userId}`;
    const token = randomUUID();
    const waitTimeoutMs = options?.waitTimeoutMs ?? BILLING_LOCK_WAIT_TIMEOUT_MS;
    const ttlSeconds = options?.ttlSeconds ?? BILLING_LOCK_TTL_SECONDS;
    const expiresAt = Date.now() + waitTimeoutMs;

    while (true) {
      const acquired = await redis.set(lockKey, token, "EX", ttlSeconds, "NX");

      if (acquired === "OK") {
        break;
      }

      if (Date.now() >= expiresAt) {
        throw new Error(`Timed out waiting for billing lock on user ${userId}.`);
      }

      await new Promise((resolve) => setTimeout(resolve, BILLING_LOCK_RETRY_DELAY_MS));
    }

    try {
      return await handler();
    } finally {
      await redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        1,
        lockKey,
        token,
      );
    }
  }
}