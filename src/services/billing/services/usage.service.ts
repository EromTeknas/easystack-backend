import { prisma } from "../../../db";
import { BillingCacheService } from "../cache/billing.cache.service.ts";
import { BILLING_CACHE_TTL_SECONDS } from "../cache/cache.constants.ts";
import { UsageCache } from "../cache/usage.cache.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { BillingQuotaResult } from "../types/index.ts";

export class UsageService {
  private static readonly usageCache = new UsageCache();
  private static readonly syncTimers = new Map<number, NodeJS.Timeout>();

  static async get(userId: number) {
    const cache = await BillingContextService.get(userId);
    return cache.usage;
  }

  static async list(userId: number) {
    return await this.get(userId);
  }

  static async initialize(userId: number, _planVersionId?: number) {
    const cache = await BillingContextService.refresh(userId);
    const quotaKeys = Object.keys(cache.quotas);

    if (quotaKeys.length > 0) {
      const quotas = await prisma.quota.findMany({
        where: { key: { in: quotaKeys } },
      });

      for (const quota of quotas) {
        await prisma.usage.upsert({
          where: { userId_quotaId: { userId, quotaId: quota.id } },
          create: {
            userId,
            quotaId: quota.id,
            value: cache.usage[quota.key] ?? 0,
          },
          update: {
            value: cache.usage[quota.key] ?? 0,
          },
        });
      }
    }

    await this.seedRedisUsage(userId, cache.usage);
    return cache.usage;
  }

  static async consume(userId: number, quotaKey: string, amount: number = 1) {
    const cache = await BillingContextService.get(userId);
    const currentValue = cache.usage[quotaKey] ?? 0;
    const nextValue = currentValue + amount;

    cache.usage[quotaKey] = nextValue;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    await this.usageCache.set(userId, quotaKey, nextValue);
    this.scheduleSync(userId);

    return nextValue;
  }

  static async release(userId: number, quotaKey: string, amount: number = 1) {
    const cache = await BillingContextService.get(userId);
    const currentValue = cache.usage[quotaKey] ?? 0;
    const nextValue = Math.max(0, currentValue - amount);

    cache.usage[quotaKey] = nextValue;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    await this.usageCache.set(userId, quotaKey, nextValue);
    this.scheduleSync(userId);

    return nextValue;
  }

  static async increment(userId: number, quotaKey: string, amount: number = 1) {
    return await this.consume(userId, quotaKey, amount);
  }

  static async decrement(userId: number, quotaKey: string, amount: number = 1) {
    return await this.release(userId, quotaKey, amount);
  }

  static async set(userId: number, quotaKey: string, value: number) {
    const cache = await BillingContextService.get(userId);
    cache.usage[quotaKey] = value;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    await this.usageCache.set(userId, quotaKey, value);
    this.scheduleSync(userId);
    return value;
  }

  static async reset(userId: number, quotaKey?: string) {
    const cache = await BillingContextService.get(userId);

    if (quotaKey) {
      cache.usage[quotaKey] = 0;
      await this.usageCache.set(userId, quotaKey, 0);
    } else {
      for (const key of Object.keys(cache.usage)) {
        cache.usage[key] = 0;
        await this.usageCache.set(userId, key, 0);
      }
    }

    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    this.scheduleSync(userId);

    return cache.usage;
  }

  static async remaining(userId: number, quotaKey: string): Promise<number | null> {
    const cache = await BillingContextService.get(userId);
    const limit = cache.quotas[quotaKey] ?? null;

    if (limit === null) {
      return null;
    }

    return Math.max(0, limit - (cache.usage[quotaKey] ?? 0));
  }

  static async percent(userId: number, quotaKey: string): Promise<number | null> {
    const cache = await BillingContextService.get(userId);
    const limit = cache.quotas[quotaKey] ?? null;

    if (limit === null || limit === 0) {
      return null;
    }

    return Math.min(100, Math.round(((cache.usage[quotaKey] ?? 0) / limit) * 100));
  }

  static async hasRemaining(userId: number, quotaKey: string, amount: number = 1): Promise<boolean> {
    const remaining = await this.remaining(userId, quotaKey);
    return remaining === null ? true : remaining >= amount;
  }

  static async sync(userId: number) {
    const cache = await BillingContextService.get(userId);
    const rows = await prisma.usage.findMany({ where: { userId }, include: { quota: true } });

    for (const [quotaKey, value] of Object.entries(cache.usage)) {
      const row = rows.find((item) => item.quota.key === quotaKey);

      if (row) {
        await prisma.usage.update({
          where: { userId_quotaId: { userId, quotaId: row.quotaId } },
          data: { value },
        });
      }
    }
  }

  static async flush(userId: number) {
    await this.sync(userId);
    await BillingContextService.invalidate(userId);
  }

  private static async seedRedisUsage(userId: number, usage: Record<string, number>) {
    for (const [quotaKey, value] of Object.entries(usage)) {
      await this.usageCache.set(userId, quotaKey, value);
    }
  }

  private static scheduleSync(userId: number) {
    const existing = this.syncTimers.get(userId);

    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.sync(userId).finally(() => {
        this.syncTimers.delete(userId);
      });
    }, 30_000);

    this.syncTimers.set(userId, timer);
  }
}
