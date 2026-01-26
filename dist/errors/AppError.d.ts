/**
 * Base Application Error Class
 * All application errors should extend this class
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly errorCode: string;
    readonly isOperational: boolean;
    readonly details?: Record<string, any> | undefined;
    constructor(message: string, statusCode: number, errorCode: string, isOperational?: boolean, details?: Record<string, any>);
}
/**
 * 400 - Bad Request
 * The server cannot process the request due to client error (validation, malformed syntax, etc.)
 */
export declare class BadRequestError extends AppError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 401 - Unauthorized
 * The request lacks valid authentication credentials
 */
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 403 - Forbidden
 * The client is authenticated but does not have access rights to the resource
 */
export declare class ForbiddenError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 404 - Not Found
 * The requested resource could not be found
 */
export declare class NotFoundError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 409 - Conflict
 * The request conflicts with the current state of the server (e.g., duplicate entry)
 */
export declare class ConflictError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 422 - Unprocessable Entity
 * The request is well-formed but contains semantic errors
 */
export declare class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * 429 - Too Many Requests
 * The user has sent too many requests in a given amount of time (rate limiting)
 */
export declare class TooManyRequestsError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 500 - Internal Server Error
 * The server encountered an unexpected condition
 */
export declare class InternalServerError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 501 - Not Implemented
 * The server does not support the functionality required to fulfill the request
 */
export declare class NotImplementedError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * 503 - Service Unavailable
 * The server is temporarily unable to handle the request (maintenance, overloaded, etc.)
 */
export declare class ServiceUnavailableError extends AppError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Database Connection Error
 * Failed to connect to database
 */
export declare class DatabaseConnectionError extends AppError {
    constructor(dbName: string, originalError?: Error);
}
/**
 * Database Operation Error
 * An error occurred during a database operation
 */
export declare class DatabaseOperationError extends AppError {
    constructor(operation: string, originalError?: Error);
}
//# sourceMappingURL=AppError.d.ts.map