import "express-serve-static-core";
import { BillingAuthorizationResult } from "../billing/types";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
    user?: {
      id: number;
      email: string;
      role: string;
    };
    workspace?: {
      id: string;
      role: string;
    };
    billing?: BillingAuthorizationResult;
  }
}
