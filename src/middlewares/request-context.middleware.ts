import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { asyncLocalStorage } from '../utils/request-context';

export default function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || undefined;
  const requestId = incoming || (typeof randomUUID === 'function' ? randomUUID() : String(Date.now()));

  asyncLocalStorage.run({ requestId }, () => {
    // attach to request for convenience (typed via declaration merging)
    (req as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
}
