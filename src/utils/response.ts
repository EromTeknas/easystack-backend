import { Response } from 'express';

export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
  meta?: Record<string, unknown>;
};

export type ApiErrorBody = {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: Record<string, any>;
    requestId: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export function ok<T>(
  res: Response,
  data: T,
  options?: { statusCode?: number; meta?: Record<string, unknown>; requestId?: string }
) {
  const statusCode = options?.statusCode ?? 200;
  const requestId = options?.requestId ?? (res.req as any)?.requestId ?? 'unknown';

  const body: ApiSuccess<T> = {
    success: true,
    data,
    requestId,
    ...(options?.meta ? { meta: options.meta } : {}),
  };

  res.setHeader('x-request-id', requestId);

  return res.status(statusCode).json(body);
}
