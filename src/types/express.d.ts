import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    user?: {
      id: number;
      email: string;
      role: string;
    };
    billingCheck?: {
      allowed: boolean;
      limit: number | null;
      used: number;
      remaining: number | null;
    };
  }
}
