import { Request, Response, NextFunction } from 'express';

/**
 * Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors and pass them to error middleware
 *
 * Usage:
 * router.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   if (!user) throw new NotFoundError('User not found');
 *   res.json(user);
 * }));
 *
 * Benefits:
 * - No need for try-catch blocks in every route
 * - Errors are automatically caught and passed to error middleware
 * - Clean and readable route handlers
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
