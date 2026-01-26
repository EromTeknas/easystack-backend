import rateLimit from 'express-rate-limit';
import { getClientIP } from '../utils/validation';

/**
 * Rate limiter for authentication endpoints
 * Limits to 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts, please try again later',
        statusCode: 429
      }
    });
  }
});

/**
 * Rate limiter for general API endpoints
 * Limits to 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req)
});

/**
 * Rate limiter for strict operations (account deletion, etc)
 * Limits to 3 requests per hour per IP
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req)
});
