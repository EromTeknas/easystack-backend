import { GENERAL_ERROR_CODES } from '../constants/errorCodes';

/**
 * Base Application Error Class
 * All application errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any> | undefined;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details || undefined;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - Bad Request
 * The server cannot process the request due to client error (validation, malformed syntax, etc.)
 */
export class BadRequestError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Bad request';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.BAD_REQUEST;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 400, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 - Unauthorized
 * The request lacks valid authentication credentials
 */
export class UnauthorizedError extends AppError {
  constructor(message?: string, errorCode?: string, details?: Record<string, any>) {
    const finalMessage = message ?? 'Unauthorized access';
    const finalCode = errorCode ?? GENERAL_ERROR_CODES.UNAUTHORIZED;
    super(finalMessage, 401, finalCode, true, details);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 - Forbidden
 * The client is authenticated but does not have access rights to the resource
 */
export class ForbiddenError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Access forbidden';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.FORBIDDEN;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 403, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 - Not Found
 * The requested resource could not be found
 */
export class NotFoundError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Resource not found';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.NOT_FOUND;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 404, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 - Conflict
 * The request conflicts with the current state of the server (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message?: string, errorCode?: string, details?: Record<string, any>) {
    const finalMessage = message ?? 'Resource conflict';
    const finalCode = errorCode ?? GENERAL_ERROR_CODES.CONFLICT;
    super(finalMessage, 409, finalCode, true, details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 - Unprocessable Entity
 * The request is well-formed but contains semantic errors
 */
export class ValidationError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Validation error';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.VALIDATION_ERROR;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 422, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 429 - Too Many Requests
 * The user has sent too many requests in a given amount of time (rate limiting)
 */
export class TooManyRequestsError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Too many requests';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.TOO_MANY_REQUESTS;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 429, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}

/**
 * 500 - Internal Server Error
 * The server encountered an unexpected condition
 */
export class InternalServerError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Internal server error';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.INTERNAL_SERVER_ERROR;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 500, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 501 - Not Implemented
 * The server does not support the functionality required to fulfill the request
 */
export class NotImplementedError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Feature not implemented';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.NOT_IMPLEMENTED;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 501, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}

/**
 * 503 - Service Unavailable
 * The server is temporarily unable to handle the request (maintenance, overloaded, etc.)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message?: string, errorCodeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const finalMessage = message ?? 'Service temporarily unavailable';
    const hasCustomCode = typeof errorCodeOrDetails === 'string';
    const finalCode = hasCustomCode ? errorCodeOrDetails : GENERAL_ERROR_CODES.SERVICE_UNAVAILABLE;
    const finalDetails = hasCustomCode ? details : (errorCodeOrDetails as Record<string, any> | undefined);

    super(finalMessage, 503, finalCode, true, finalDetails);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Database Connection Error
 * Failed to connect to database
 */
export class DatabaseConnectionError extends AppError {
  constructor(dbName: string, originalError?: Error) {
    super(
      `Failed to connect to ${dbName}`,
      503,
      GENERAL_ERROR_CODES.DATABASE_CONNECTION_ERROR,
      true,
      originalError ? { originalError: originalError.message } : undefined
    );
    Object.setPrototypeOf(this, DatabaseConnectionError.prototype);
  }
}

/**
 * Database Operation Error
 * An error occurred during a database operation
 */
export class DatabaseOperationError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Database operation failed: ${operation}`,
      500,
      GENERAL_ERROR_CODES.DATABASE_OPERATION_ERROR,
      true,
      originalError ? { originalError: originalError.message } : undefined
    );
    Object.setPrototypeOf(this, DatabaseOperationError.prototype);
  }
}
