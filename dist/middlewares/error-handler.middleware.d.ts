import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
/**
 * Global Error Handling Middleware
 * This middleware catches all errors thrown in the application and formats them consistently
 *
 * Usage: Must be placed AFTER all other middleware and routes in server.ts
 * app.use(errorHandlerMiddleware);
 */
export declare const errorHandlerMiddleware: (err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * 404 Not Found Middleware
 * This middleware handles requests to undefined routes
 *
 * Usage: Must be placed AFTER all route definitions in server.ts
 * app.use(notFoundMiddleware);
 */
export declare const notFoundMiddleware: (_req: Request, _res: Response, next: NextFunction) => void;
export default errorHandlerMiddleware;
//# sourceMappingURL=error-handler.middleware.d.ts.map