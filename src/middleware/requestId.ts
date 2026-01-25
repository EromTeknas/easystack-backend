import { Request, Response, NextFunction } from 'express';
import { asyncLocalStorage } from '../context/asyncLocal';
import { randomUUID } from 'crypto';

export default function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || undefined;
  const requestId = incoming || (typeof randomUUID === 'function' ? randomUUID() : String(Date.now()));

  asyncLocalStorage.run({ requestId }, () => {
    // attach to request for handlers that read it directly
    (req as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
}
