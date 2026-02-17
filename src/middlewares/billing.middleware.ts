import { Response, NextFunction } from 'express';
import { BillingService } from '../services/billing.service';
import { AppError } from '../errors';

/**
 * Billing guard middleware - checks if user has enough quota for a specific feature
 * Usage: app.post("/projects", billingGuard("projects"), createProject);
 */
export function billingGuard(featureKey: string) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      // Ensure user is authenticated
      if (!req.user?.id) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const userId = req.user.id;

      // Check if user can perform the action
      const check = await BillingService.canPerformAction(userId, featureKey);

      if (!check.allowed) {
        throw new AppError(
          `Quota exceeded for ${featureKey}. Limit: ${check.limit}, Used: ${check.used}`,
          403,
          'QUOTA_EXCEEDED',
          {
            feature: featureKey,
            limit: check.limit,
            used: check.used,
            remaining: check.remaining,
          }
        );
      }

      // Attach billing info to request for later use
      req.billingCheck = check;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Feature guard middleware - checks if user has a specific feature enabled
 * Usage: app.post("/custom-domain", featureGuard("custom_domain"), setCustomDomain);
 */
export function featureGuard(featureKey: string) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      // Ensure user is authenticated
      if (!req.user?.id) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const userId = req.user.id;

      // Check if user has the feature
      const hasFeature = await BillingService.hasFeature(userId, featureKey);

      if (!hasFeature) {
        throw new AppError(
          `Feature '${featureKey}' is not available in your plan`,
          403,
          'FEATURE_NOT_AVAILABLE',
          { feature: featureKey }
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Usage tracking middleware - automatically increment usage after successful request
 * Usage: app.post("/ai/generate", billingGuard("ai_tokens"), trackUsage("ai_tokens", 1000), aiHandler);
 */
export function trackUsage(featureKey: string, amount: number | ((req: any) => number) = 1) {
  return async (req: any, res: Response, next: NextFunction) => {
    // Store the original send function
    const originalSend = res.send;

    // Override res.send to track usage after successful response
    res.send = function (data: any) {
      // Only track on successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id;
        if (userId) {
          const usageAmount = typeof amount === 'function' ? amount(req) : amount;
          
          // Fire and forget - don't block response
          BillingService.incrementUsage(userId, featureKey, usageAmount).catch((err) => {
            console.error('Failed to track usage:', err);
          });
        }
      }

      // Call the original send
      return originalSend.call(this, data);
    };

    next();
  };
}

