import { prisma } from "../../../db";
import { BillingCacheService } from "../cache/billing.cache.service.ts";
import { BILLING_CACHE_TTL_SECONDS } from "../cache/cache.constants.ts";
import { UsageCache } from "../cache/usage.cache.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { BillingQuotaResult } from "../types/index.ts";
import { BillingLockService } from "../cache/billing.lock.service.ts";

export interface UsageOptions {
  scope?: string;
  scopeId?: string;
}

export class UsageService {
  private static readonly usageCache = new UsageCache();
  private static readonly syncTimers = new Map<number, NodeJS.Timeout>();

  static async get(workspaceId: number, quotaKey: string, options?: UsageOptions) {
    const cache = await BillingContextService.get(workspaceId);
    const scope = options?.scope || 'WORKSPACE';
    const scopeId = options?.scopeId || 'ALL';

    if (scope === 'WORKSPACE' && scopeId === 'ALL') {
      return cache.usage[quotaKey] ?? 0;
    }

    return cache.scopedUsage?.[quotaKey]?.[scope]?.[scopeId] ?? 0;
  }

  static async list(workspaceId: number) {
    const cache = await BillingContextService.get(workspaceId);
    return { usage: cache.usage, scopedUsage: cache.scopedUsage };
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
          where: { workspaceId_quotaId_scope_scopeId: { workspaceId, quotaId: quota.id, scope: 'WORKSPACE', scopeId: 'ALL' } },
          create: {
            workspaceId,
            quotaId: quota.id,
            scope: 'WORKSPACE',
            scopeId: 'ALL',
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

  static async consume(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions) {
    return await BillingLockService.withWorkspaceLock(workspaceId, () =>
      this.consumeWithinLock(workspaceId, quotaKey, amount, options),
    );
  }

  static async consumeWithinLock(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions) {
    const cache = await BillingContextService.get(workspaceId);
    const scope = options?.scope || 'WORKSPACE';
    const scopeId = options?.scopeId || 'ALL';
    
    let currentValue = 0;

    if (scope === 'WORKSPACE' && scopeId === 'ALL') {
      currentValue = cache.usage[quotaKey] ?? 0;
      cache.usage[quotaKey] = currentValue + amount;
      await this.usageCache.set(workspaceId, quotaKey, cache.usage[quotaKey]);
    } else {
      if (!cache.scopedUsage) cache.scopedUsage = {};
      if (!cache.scopedUsage[quotaKey]) cache.scopedUsage[quotaKey] = {};
      if (!cache.scopedUsage[quotaKey][scope]) cache.scopedUsage[quotaKey][scope] = {};
      currentValue = cache.scopedUsage[quotaKey][scope][scopeId] ?? 0;
      cache.scopedUsage[quotaKey][scope][scopeId] = currentValue + amount;
    }

    const nextValue = currentValue + amount;
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    this.scheduleSync(workspaceId);

    return nextValue;
  }

  static async release(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions) {
    return await BillingLockService.withWorkspaceLock(workspaceId, () =>
      this.releaseWithinLock(workspaceId, quotaKey, amount, options),
    );
  }

  static async releaseWithinLock(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions) {
    const cache = await BillingContextService.get(workspaceId);
    const scope = options?.scope || 'WORKSPACE';
    const scopeId = options?.scopeId || 'ALL';
    
    let currentValue = 0;

    if (scope === 'WORKSPACE' && scopeId === 'ALL') {
      currentValue = cache.usage[quotaKey] ?? 0;
      cache.usage[quotaKey] = Math.max(0, currentValue - amount);
      await this.usageCache.set(workspaceId, quotaKey, cache.usage[quotaKey]);
    } else {
      if (!cache.scopedUsage) cache.scopedUsage = {};
      if (!cache.scopedUsage[quotaKey]) cache.scopedUsage[quotaKey] = {};
      if (!cache.scopedUsage[quotaKey][scope]) cache.scopedUsage[quotaKey][scope] = {};
      currentValue = cache.scopedUsage[quotaKey][scope][scopeId] ?? 0;
      cache.scopedUsage[quotaKey][scope][scopeId] = Math.max(0, currentValue - amount);
    }

    const nextValue = Math.max(0, currentValue - amount);
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    this.scheduleSync(workspaceId);

    return nextValue;
  }

  static async increment(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions) {
    return await this.consume(workspaceId, quotaKey, amount, options);
  }

  static async decrement(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions) {
    return await this.release(workspaceId, quotaKey, amount, options);
  }

  static async set(workspaceId: number, quotaKey: string, value: number, options?: UsageOptions) {
    return await BillingLockService.withWorkspaceLock(workspaceId, () =>
      this.setWithinLock(workspaceId, quotaKey, value, options),
    );
  }

  static async setWithinLock(workspaceId: number, quotaKey: string, value: number, options?: UsageOptions) {
    const cache = await BillingContextService.get(workspaceId);
    const scope = options?.scope || 'WORKSPACE';
    const scopeId = options?.scopeId || 'ALL';

    if (scope === 'WORKSPACE' && scopeId === 'ALL') {
      cache.usage[quotaKey] = value;
      await this.usageCache.set(workspaceId, quotaKey, value);
    } else {
      if (!cache.scopedUsage) cache.scopedUsage = {};
      if (!cache.scopedUsage[quotaKey]) cache.scopedUsage[quotaKey] = {};
      if (!cache.scopedUsage[quotaKey][scope]) cache.scopedUsage[quotaKey][scope] = {};
      cache.scopedUsage[quotaKey][scope][scopeId] = value;
    }

    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    this.scheduleSync(workspaceId);
    return value;
  }

  static async reset(workspaceId: number, quotaKey?: string, options?: UsageOptions) {
    return await BillingLockService.withWorkspaceLock(workspaceId, () =>
      this.resetWithinLock(workspaceId, quotaKey, options),
    );
  }

  static async resetWithinLock(workspaceId: number, quotaKey?: string, options?: UsageOptions) {
    const cache = await BillingContextService.get(workspaceId);
    const scope = options?.scope || 'WORKSPACE';
    const scopeId = options?.scopeId || 'ALL';

    if (scope === 'WORKSPACE' && scopeId === 'ALL') {
      if (quotaKey) {
        cache.usage[quotaKey] = 0;
        await this.usageCache.set(workspaceId, quotaKey, 0);
      } else {
        for (const key of Object.keys(cache.usage)) {
          cache.usage[key] = 0;
          await this.usageCache.set(workspaceId, key, 0);
        }
      }
    } else {
      if (quotaKey && cache.scopedUsage?.[quotaKey]?.[scope]?.[scopeId]) {
        cache.scopedUsage[quotaKey][scope][scopeId] = 0;
      }
    }

    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    this.scheduleSync(workspaceId);

    return cache.usage;
  }

  static async remaining(workspaceId: number, quotaKey: string, options?: UsageOptions): Promise<number | null> {
    const cache = await BillingContextService.get(workspaceId);
    const limit = cache.quotas[quotaKey] ?? null;

    if (limit === null) {
      return null;
    }

    const used = await this.get(workspaceId, quotaKey, options);
    return Math.max(0, limit - used);
  }

  static async percent(workspaceId: number, quotaKey: string, options?: UsageOptions): Promise<number | null> {
    const cache = await BillingContextService.get(workspaceId);
    const limit = cache.quotas[quotaKey] ?? null;

    if (limit === null || limit === 0) {
      return null;
    }

    const used = await this.get(workspaceId, quotaKey, options);
    return Math.min(100, Math.round((used / limit) * 100));
  }

  static async hasRemaining(workspaceId: number, quotaKey: string, amount: number = 1, options?: UsageOptions): Promise<boolean> {
    const remaining = await this.remaining(workspaceId, quotaKey, options);
    return remaining === null ? true : remaining >= amount;
  }

  static async sync(workspaceId: number) {
    const cache = await BillingContextService.get(workspaceId);
    
    // Fetch all quotas once to map quotaKey to quotaId
    const allQuotas = await prisma.quota.findMany();
    const quotaMap = new Map(allQuotas.map(q => [q.key, q.id]));

    // Sync global usage
    for (const [quotaKey, value] of Object.entries(cache.usage || {})) {
      const quotaId = quotaMap.get(quotaKey);
      if (quotaId) {
        await prisma.usage.upsert({
          where: { workspaceId_quotaId_scope_scopeId: { workspaceId, quotaId, scope: 'WORKSPACE', scopeId: 'ALL' } },
          create: { workspaceId, quotaId, scope: 'WORKSPACE', scopeId: 'ALL', value },
          update: { value },
        });
      }
    }

    // Sync scoped usage
    if (cache.scopedUsage) {
      for (const [quotaKey, scopes] of Object.entries(cache.scopedUsage)) {
        const quotaId = quotaMap.get(quotaKey);
        if (quotaId && scopes) {
          for (const [scope, scopeIds] of Object.entries(scopes)) {
            if (scopeIds) {
              for (const [scopeId, value] of Object.entries(scopeIds)) {
                await prisma.usage.upsert({
                  where: { workspaceId_quotaId_scope_scopeId: { workspaceId, quotaId, scope, scopeId } },
                  create: { workspaceId, quotaId, scope, scopeId, value: value as number },
                  update: { value: value as number },
                });
              }
            }
          }
        }
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
