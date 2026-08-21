import type { NextFunction, Request, Response } from "express";

import { auth } from "../../../../config/auth";
import { UnauthorizedError } from "../../../../errors";
import { authenticationService } from "../../authentication.module";

import { AUTH_ERROR_CODES } from "../../../../constants/errorCodes";

export const authenticateToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[auth.cookies.accessTokenName];
    const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];

    if (!token) {
      if (!refreshToken) {
        throw new UnauthorizedError("Session expired", AUTH_ERROR_CODES.SESSION_EXPIRED);
      } else {
        throw new UnauthorizedError("Access token expired", AUTH_ERROR_CODES.ACCESS_TOKEN_EXPIRED);
      }
    }

    const decoded = authenticationService.verifyAccessToken(token);

    req.user = {
      id: Number(decoded.sub),
      email: "",
      role: "",
    };

    next();
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    next(new UnauthorizedError("Authentication failed"));
  }
};

export const authenticate = authenticateToken;

export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[auth.cookies.accessTokenName];

    if (token) {
      const decoded = authenticationService.verifyAccessToken(token);
      req.user = {
        id: Number(decoded.sub),
        email: "",
        role: "",
      };
    }
  } catch {
    // Optional authentication intentionally ignores invalid or expired cookies.
  }

  next();
};
