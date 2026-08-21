import { Request, Response, NextFunction } from 'express';
import { app } from '../config';

export const delayMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only apply in local environment if SIMULATE_DELAY is true
  if (app.environment === 'local' && app.simulateDelay) {
    // Generate a random delay between 1000ms (1s) and 2000ms (2s)
    const delay = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
    setTimeout(() => {
      next();
    }, delay);
  } else {
    next();
  }
};
