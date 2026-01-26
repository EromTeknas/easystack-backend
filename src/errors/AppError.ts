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
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'BAD_REQUEST', true, details);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 - Unauthorized
 * The request lacks valid authentication credentials
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access', details?: Record<string, any>) {
    super(message, 401, 'UNAUTHORIZED', true, details);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 - Forbidden
 * The client is authenticated but does not have access rights to the resource
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', details?: Record<string, any>) {
    super(message, 403, 'FORBIDDEN', true, details);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 - Not Found
 * The requested resource could not be found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: Record<string, any>) {
    super(message, 404, 'NOT_FOUND', true, details);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 - Conflict
 * The request conflicts with the current state of the server (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: Record<string, any>) {
    super(message, 409, 'CONFLICT', true, details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 - Unprocessable Entity
 * The request is well-formed but contains semantic errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 422, 'VALIDATION_ERROR', true, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 429 - Too Many Requests
 * The user has sent too many requests in a given amount of time (rate limiting)
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', details?: Record<string, any>) {
    super(message, 429, 'TOO_MANY_REQUESTS', true, details);
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}

/**
 * 500 - Internal Server Error
 * The server encountered an unexpected condition
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', true, details);
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 501 - Not Implemented
 * The server does not support the functionality required to fulfill the request
 */
export class NotImplementedError extends AppError {
  constructor(message: string = 'Feature not implemented', details?: Record<string, any>) {
    super(message, 501, 'NOT_IMPLEMENTED', true, details);
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}

/**
 * 503 - Service Unavailable
 * The server is temporarily unable to handle the request (maintenance, overloaded, etc.)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: Record<string, any>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', true, details);
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
      'DATABASE_CONNECTION_ERROR',
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
      'DATABASE_OPERATION_ERROR',
      true,
      originalError ? { originalError: originalError.message } : undefined
    );
    Object.setPrototypeOf(this, DatabaseOperationError.prototype);
  }
}
