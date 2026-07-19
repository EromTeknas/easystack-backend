import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AppError } from '../errors';
import { GENERAL_ERROR_CODES } from '../constants/errorCodes';
import { ApiErrorBody } from '../utils/response';
import { environment, logLevel } from '../config';

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
    const requestId = (_req as any).requestId || 'unknown';
    const body: ApiErrorBody = {
      success: false,
      error: {
        message: err.message,
        code: err.errorCode,
        statusCode: err.statusCode,
        ...(err.details && { details: err.details }),
        requestId,
      },
    };

    res.setHeader('x-request-id', requestId);
    return res.status(err.statusCode).json(body);
  }

  // For unhandled errors, send generic 500 response (don't leak details in production)
  const isProduction = environment === 'prod';
  const statusCode = 500;
  const errorCode = GENERAL_ERROR_CODES.INTERNAL_SERVER_ERROR;

  const requestId = (_req as any).requestId || 'unknown';
  const body: ApiErrorBody = {
    success: false,
    error: {
      message: isProduction ? 'Internal server error' : err.message,
      code: errorCode,
      statusCode,
      requestId,
      ...(logLevel === 'debug' && !isProduction && { stack: err.stack as any }),
    },
  };

  res.setHeader('x-request-id', requestId);
  res.status(statusCode).json(body);
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
