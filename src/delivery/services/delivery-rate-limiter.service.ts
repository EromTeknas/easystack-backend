import crypto from 'crypto';
import { redisClient } from '../../db/redis';
import logger from '../../utils/logger';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

local clearBefore = now - window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    local remaining = limit - currentCount - 1
    return { 1, remaining, math.ceil(window / 1000) }
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfter = 1
    if oldest and #oldest >= 2 then
        local oldestScore = tonumber(oldest[2])
        local waitMs = (oldestScore + window) - now
        if waitMs > 0 then
            retryAfter = math.ceil(waitMs / 1000)
        end
    end
    return { 0, 0, retryAfter }
end
`;

export const DeliveryRateLimiterService = {
  getRateLimitKey(apiKeyId: number): string {
    return `ratelimit:apikey:${apiKeyId}`;
  },

  async checkLimit(
    apiKeyId: number,
    limitPerMinute: number = 600,
    windowMs: number = 60000
  ): Promise<RateLimitResult> {
    const key = this.getRateLimitKey(apiKeyId);
    const now = Date.now();
    const uniqueId = `${now}-${crypto.randomBytes(6).toString('hex')}`;

    try {
      const result = (await redisClient.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        now,
        windowMs,
        limitPerMinute,
        uniqueId
      )) as [number, number, number];

      const allowed = result[0] === 1;
      const remaining = Number(result[1]);
      const retryAfterSeconds = Number(result[2]);
      const resetSeconds = Math.max(1, Math.ceil(windowMs / 1000));

      return {
        allowed,
        limit: limitPerMinute,
        remaining: Math.max(0, remaining),
        resetSeconds,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    } catch (error) {
      logger.error(`[DeliveryRateLimiter] Redis rate check failed: ${String(error)}`);
      // Fail open to avoid blocking live traffic if Redis encounters transient error
      return {
        allowed: true,
        limit: limitPerMinute,
        remaining: limitPerMinute - 1,
        resetSeconds: Math.ceil(windowMs / 1000),
        retryAfterSeconds: 1,
      };
    }
  },
};
