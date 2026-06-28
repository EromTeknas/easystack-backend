import { prisma } from '../db/prisma';
import { redisClient } from '../config/redis';
import { getUserUsage, getCurrentMonth, incrementUsage as incrementUsageModel } from '../repositories/usage.model';
import { BILLING_CACHE_KEYS, BILLING_CACHE_TTL, PLAN_NAMES } from '../constants/billing';
import { AppError } from '../errors';
import type { EffectivePlan, PlanConfig, UsageData } from '../types/billing';

/**
 * Billing Service - Core business logic for plans, subscriptions, and usage
 */
export class BillingService {
  /**
   * Deep merge two objects (for plan config override)
   */
  private static deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  private static isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get effective plan for a user (with custom overrides applied)
   */
  static async getEffectivePlan(userId: number): Promise<EffectivePlan> {
    // Try cache first
    const cacheKey = BILLING_CACHE_KEYS.USER_PLAN(userId);
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis cache error:', err);
    }

    // Fetch from database
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { planVersion: {
        include: { plan: true }
      } },
    });

    if (!subscription) {
      throw new AppError('No active subscription found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // Base plan config
    const basePlan = subscription.planVersion.config;

    // Apply custom overrides if they exist
    let finalConfig = basePlan as unknown as PlanConfig;

    const effectivePlan: EffectivePlan = {
      id: subscription.planVersion.planId,
      name: subscription.planVersion.plan.key,
      displayName: subscription.planVersion.plan.displayName,
      config: finalConfig
    };

    // Cache the result
    try {
      await redisClient.setex(
        cacheKey,
        BILLING_CACHE_TTL.PLAN,
        JSON.stringify(effectivePlan)
      );
    } catch (err) {
      console.error('Redis cache set error:', err);
    }

    return effectivePlan;
  }

  /**
   * Get current usage for a user
   */
  static async getUserUsage(userId: number, month?: string): Promise<UsageData> {
    const targetMonth = month || getCurrentMonth();
    
    // Try cache first
    const cacheKey = BILLING_CACHE_KEYS.USER_USAGE(userId, targetMonth);
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis cache error:', err);
    }

    // Fetch from MongoDB
    const usage = await getUserUsage(userId, targetMonth);

    // Cache the result
    try {
      await redisClient.setex(
        cacheKey,
        BILLING_CACHE_TTL.USAGE,
        JSON.stringify(usage)
      );
    } catch (err) {
      console.error('Redis cache set error:', err);
    }

    return usage;
  }

  /**
   * Check if user can perform an action based on their plan limits
   */
  static async canPerformAction(
    userId: number,
    featureKey: string
  ): Promise<{ allowed: boolean; limit: number | null; used: number; remaining: number | null }> {
    const plan = await this.getEffectivePlan(userId);
    const usage = await this.getUserUsage(userId);

    const limit = plan.config.limits[featureKey] ?? null;
    const used = usage[featureKey] || 0;

    // null limit means unlimited
    if (limit === null) {
      return { allowed: true, limit: null, used, remaining: null };
    }

    const allowed = used < limit;
    const remaining = limit - used;

    return { allowed, limit, used, remaining };
  }

  /**
   * Check if user has a specific feature enabled
   */
  static async hasFeature(userId: number, featureKey: string): Promise<boolean> {
    const plan = await this.getEffectivePlan(userId);
    return plan.config.features[featureKey] || false;
  }

  /**
   * Increment usage counter for a user
   */
  static async incrementUsage(
    userId: number,
    featureKey: string,
    amount: number = 1
  ): Promise<void> {
    await incrementUsageModel(userId, featureKey, amount);

    // Invalidate cache
    const month = getCurrentMonth();
    const cacheKey = BILLING_CACHE_KEYS.USER_USAGE(userId, month);
    
    try {
      await redisClient.del(cacheKey);
    } catch (err) {
      console.error('Redis cache del error:', err);
    }
  }

  /**
   * Invalidate plan cache for a user (call after subscription updates)
   */
  static async invalidatePlanCache(userId: number): Promise<void> {
    const cacheKey = BILLING_CACHE_KEYS.USER_PLAN(userId);
    
    try {
      await redisClient.del(cacheKey);
    } catch (err) {
      console.error('Redis cache del error:', err);
    }
  }
}
