import { Response, NextFunction } from 'express';
import { ApiKeyAuthService } from '../services/api-key-auth.service';
import { DeliveryContext } from '../types/delivery.types';
import { DeliveryRequest } from './request-id.middleware';

export interface AuthenticatedDeliveryRequest extends DeliveryRequest {
  deliveryContext: DeliveryContext;
}

export async function apiKeyAuthMiddleware(
  req: DeliveryRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const query = req.query as Record<string, any>;
  // Reject API key in query parameters to prevent leakage in server access logs and browser histories
  if (query.api_key || query.apiKey || query.key || query.token) {
    res.status(401).json({
      error: {
        code: 'FORBIDDEN_QUERY_AUTH',
        message:
          "API keys must not be passed in URL query parameters. Use the 'x-api-key' header or 'Authorization: Bearer <key>'.",
        statusCode: 401,
        requestId: req.requestId,
      },
    });
    return;
  }

  // Extract from header: x-api-key or Authorization: Bearer
  let rawKey: string | undefined;

  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    rawKey = headerKey.trim();
  } else if (typeof req.headers.authorization === 'string') {
    const parts = req.headers.authorization.split(' ');
    const scheme = parts[0];
    const token = parts[1];
    if (parts.length === 2 && scheme?.toLowerCase() === 'bearer' && token) {
      rawKey = token.trim();
    }
  }

  if (!rawKey) {
    res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message:
          "Missing API key. Provide via 'x-api-key' header or 'Authorization: Bearer <key>'.",
        statusCode: 401,
        requestId: req.requestId,
      },
    });
    return;
  }

  try {
    const context = await ApiKeyAuthService.verifyKey(rawKey);

    if (!context) {
      res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid or has been revoked.',
          statusCode: 401,
          requestId: req.requestId,
        },
      });
      return;
    }

    // CORS / Allowed Origins check if configured
    if (context.allowedOrigins && context.allowedOrigins.length > 0) {
      const origin = req.headers.origin;
      if (
        origin &&
        !context.allowedOrigins.includes(origin) &&
        !context.allowedOrigins.includes('*')
      ) {
        res.status(403).json({
          error: {
            code: 'ORIGIN_FORBIDDEN',
            message: `Origin '${origin}' is not authorized to use this API key.`,
            statusCode: 403,
            requestId: req.requestId,
          },
        });
        return;
      }
    }

    (req as AuthenticatedDeliveryRequest).deliveryContext = context;
    next();
  } catch (error) {
    next(error);
  }
}
