import type { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";

const SENSITIVE_FIELDS = new Set([
  "password",
  "confirmPassword",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "verificationToken",
  "otp",
  "otpCode",
  "authorization",
  "cookie",
  "secret",
  "clientSecret",
]);

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((result, [key, nestedValue]) => {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeValue(nestedValue);
      }

      return result;
    }, {});
  }

  return value;
}

function getRequestPath(req: Request): string {
  return req.originalUrl || req.url;
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();
  const method = req.method;
  const path = getRequestPath(req);

  logger.info(`HTTP request started ${method} ${path}`, {
    method,
    path,
    requestId: req.headers["x-request-id"],
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    userId: (req as any).user?.id,
    body: sanitizeValue(req.body),
    query: sanitizeValue(req.query),
    params: sanitizeValue(req.params),
  });

  let completed = false;

  const logCompletion = (event: "finish" | "close") => {
    if (completed) {
      return;
    }

    completed = true;

    const durationNanoseconds = process.hrtime.bigint() - startedAt;
    const durationMs = Number(durationNanoseconds) / 1_000_000;

    const metadata = {
      method,
      path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      requestId: req.headers["x-request-id"],
      userId: (req as any).user?.id,
      event,
    };

    if (event === "close" && !res.writableFinished) {
      logger.warn(`HTTP request connection closed before completion ${method} ${path}`, metadata);
      return;
    }

    if (res.statusCode >= 500) {
      logger.error(`HTTP request completed ${method} ${path}`, metadata);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP request completed ${method} ${path}`, metadata);
    } else {
      logger.info(`HTTP request completed ${method} ${path}`, metadata);
    }
  };

  res.once("finish", () => logCompletion("finish"));
  res.once("close", () => logCompletion("close"));

  next();
}
