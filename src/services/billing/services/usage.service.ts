import { prisma } from "../../../db";
import { BillingCacheService } from "../cache/billing.cache.service.ts";
import { BILLING_CACHE_TTL_SECONDS } from "../cache/cache.constants.ts";
import { UsageCache } from "../cache/usage.cache.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { BillingQuotaResult } from "../types/index.ts";

export class UsageService {
  private static readonly usageCache = new UsageCache();
  private static readonly syncTimers = new Map<number, NodeJS.Timeout>();

  static async get(workspaceId: number) {
    const cache = await BillingContextService.get(workspaceId);
    return cache.usage;
  }

  static async list(workspaceId: number) {
    return await this.get(workspaceId);
  }

  static async initialize(workspaceId: number, _planVersionId?: number) {
    const cache = await BillingContextService.refresh(workspaceId);
    const quotaKeys = Object.keys(cache.quotas);

    if (quotaKeys.length > 0) {
      const quotas = await prisma.quota.findMany({
        where: { key: { in: quotaKeys } },
      });

      for (const quota of quotas) {
        await prisma.usage.upsert({
          where: { workspaceId_quotaId: { workspaceId, quotaId: quota.id } },
          create: {
            workspaceId,
            quotaId: quota.id,
            value: cache.usage[quota.key] ?? 0,
          },
          update: {
            value: cache.usage[quota.key] ?? 0,
          },
        });
      }
    }

    await this.seedRedisUsage(workspaceId, cache.usage);
    return cache.usage;
  }

  static async consume(workspaceId: number, quotaKey: string, amount: number = 1) {
    const cache = await BillingContextService.get(workspaceId);
    const currentValue = cache.usage[quotaKey] ?? 0;
    const nextValue = currentValue + amount;

    cache.usage[quotaKey] = nextValue;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    await this.usageCache.set(workspaceId, quotaKey, nextValue);
    this.scheduleSync(workspaceId);

    return nextValue;
  }

  static async release(workspaceId: number, quotaKey: string, amount: number = 1) {
    const cache = await BillingContextService.get(workspaceId);
    const currentValue = cache.usage[quotaKey] ?? 0;
    const nextValue = Math.max(0, currentValue - amount);

    cache.usage[quotaKey] = nextValue;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    await this.usageCache.set(workspaceId, quotaKey, nextValue);
    this.scheduleSync(workspaceId);

    return nextValue;
  }

  static async increment(workspaceId: number, quotaKey: string, amount: number = 1) {
    return await this.consume(workspaceId, quotaKey, amount);
  }

  static async decrement(workspaceId: number, quotaKey: string, amount: number = 1) {
    return await this.release(workspaceId, quotaKey, amount);
  }

  static async set(workspaceId: number, quotaKey: string, value: number) {
    const cache = await BillingContextService.get(workspaceId);
    cache.usage[quotaKey] = value;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    await this.usageCache.set(workspaceId, quotaKey, value);
    this.scheduleSync(workspaceId);
    return value;
  }

  static async reset(workspaceId: number, quotaKey?: string) {
    const cache = await BillingContextService.get(workspaceId);

    if (quotaKey) {
      cache.usage[quotaKey] = 0;
      await this.usageCache.set(workspaceId, quotaKey, 0);
    } else {
      for (const key of Object.keys(cache.usage)) {
        cache.usage[key] = 0;
        await this.usageCache.set(workspaceId, key, 0);
      }
    }

    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    this.scheduleSync(workspaceId);

    return cache.usage;
  }

  static async remaining(workspaceId: number, quotaKey: string): Promise<number | null> {
    const cache = await BillingContextService.get(workspaceId);
    const limit = cache.quotas[quotaKey] ?? null;

    if (limit === null) {
      return null;
    }

    return Math.max(0, limit - (cache.usage[quotaKey] ?? 0));
  }

  static async percent(workspaceId: number, quotaKey: string): Promise<number | null> {
    const cache = await BillingContextService.get(workspaceId);
    const limit = cache.quotas[quotaKey] ?? null;

    if (limit === null || limit === 0) {
      return null;
    }

    return Math.min(100, Math.round(((cache.usage[quotaKey] ?? 0) / limit) * 100));
  }

  static async hasRemaining(workspaceId: number, quotaKey: string, amount: number = 1): Promise<boolean> {
    const remaining = await this.remaining(workspaceId, quotaKey);
    return remaining === null ? true : remaining >= amount;
  }

  static async sync(workspaceId: number) {
    const cache = await BillingContextService.get(workspaceId);
    const rows = await prisma.usage.findMany({ where: { workspaceId }, include: { quota: true } });

    for (const [quotaKey, value] of Object.entries(cache.usage)) {
      const row = rows.find((item) => item.quota.key === quotaKey);

      if (row) {
        await prisma.usage.update({
          where: { workspaceId_quotaId: { workspaceId, quotaId: row.quotaId } },
          data: { value },
        });
      }
    }
  }

  static async flush(workspaceId: number) {
    await this.sync(workspaceId);
    await BillingContextService.invalidate(workspaceId);
  }

  private static async seedRedisUsage(workspaceId: number, usage: Record<string, number>) {
    for (const [quotaKey, value] of Object.entries(usage)) {
      await this.usageCache.set(workspaceId, quotaKey, value);
    }
  }

  private static scheduleSync(workspaceId: number) {
    const existing = this.syncTimers.get(workspaceId);

    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      console.log(`Syncing usage for workspace ${workspaceId}...`);
      void this.sync(workspaceId).finally(() => {
        this.syncTimers.delete(workspaceId);
      });
    }, 30_000);

    this.syncTimers.set(workspaceId, timer);
  }
}
