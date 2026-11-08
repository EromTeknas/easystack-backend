import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface DeliveryRequest extends Request {
  requestId?: string;
}

export function requestIdMiddleware(req: DeliveryRequest, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim()) 
    ? incomingId.trim() 
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
