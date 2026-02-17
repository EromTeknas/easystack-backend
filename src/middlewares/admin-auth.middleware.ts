import { Request, Response, NextFunction } from 'express';

export const adminDashboardAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // TODO: Add authentication logic for EasyStack internal admin dashboard.
  return next();
};
