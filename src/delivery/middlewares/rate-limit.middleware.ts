import { Response, NextFunction } from 'express';
import { AuthenticatedDeliveryRequest } from './api-key-auth.middleware';
import { DeliveryRateLimiterService } from '../services/delivery-rate-limiter.service';

export async function deliveryRateLimitMiddleware(
  req: AuthenticatedDeliveryRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const context = req.deliveryContext;
  if (!context || !context.apiKeyId) {
    next();
    return;
  }

  const limit = context.rateLimitPerMinute || 600;
  const result = await DeliveryRateLimiterService.checkLimit(context.apiKeyId, limit);

  // Standard rate limiting headers
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(result.resetSeconds));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Maximum ${result.limit} requests per minute allowed for this API key. Please retry in ${result.retryAfterSeconds} seconds.`,
        statusCode: 429,
        requestId: req.requestId,
      },
    });
    return;
  }

  next();
}
