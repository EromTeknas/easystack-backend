import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError';
import logger from '../../utils/logger';
import { DeliveryRequest } from './request-id.middleware';

export function deliveryErrorMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const deliveryReq = req as DeliveryRequest;
  const requestId = deliveryReq.requestId;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.errorCode,
        message: err.message,
        statusCode: err.statusCode,
        requestId,
      },
    });
    return;
  }

  logger.error(`[Delivery API Error] ${err.message || String(err)}`, {
    stack: err.stack,
    requestId,
    url: req.originalUrl,
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected server error occurred.' : err.message,
      statusCode,
      requestId,
    },
  });
}

export function deliveryNotFoundMiddleware(req: Request, res: Response): void {
  const deliveryReq = req as DeliveryRequest;
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested delivery endpoint '${req.originalUrl}' does not exist.`,
      statusCode: 404,
      requestId: deliveryReq.requestId,
    },
  });
}
