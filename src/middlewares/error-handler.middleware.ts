import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AppError } from '../errors';

/**
 * Global Error Handling Middleware
 * This middleware catches all errors thrown in the application and formats them consistently
 *
 * Usage: Must be placed AFTER all other middleware and routes in server.ts
 * app.use(errorHandlerMiddleware);
 */
export const errorHandlerMiddleware = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log the error with full context
  if (err instanceof AppError) {
    logger.error(`[${err.errorCode}] ${err.message}`, {
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      isOperational: err.isOperational,
      details: err.details,
      stack: err.stack,
    });
  } else {
    // Programming error - log with full stack trace
    logger.error(`Unhandled Error: ${err.message}`, {
      stack: err.stack,
      type: err.constructor.name,
    });
  }

  // If it's an AppError, send the formatted response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.errorCode,
        statusCode: err.statusCode,
        ...(err.details && { details: err.details }),
        requestId: (_req as any).requestId || 'unknown',
      },
    });
  }

  // For unhandled errors, send generic 500 response (don't leak details in production)
  const isProduction = process.env.ENVIRONMENT === 'prod';
  const statusCode = 500;
  const errorCode = 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      message: isProduction ? 'Internal server error' : err.message,
      code: errorCode,
      statusCode,
      requestId: (_req as any).requestId || 'unknown',
      ...(process.env.LOG_LEVEL === 'debug' && !isProduction && { stack: err.stack }),
    },
  });
};

/**
 * 404 Not Found Middleware
 * This middleware handles requests to undefined routes
 *
 * Usage: Must be placed AFTER all route definitions in server.ts
 * app.use(notFoundMiddleware);
 */
export const notFoundMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  const error = new AppError(
    `Cannot ${_req.method} ${_req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

export default errorHandlerMiddleware;
