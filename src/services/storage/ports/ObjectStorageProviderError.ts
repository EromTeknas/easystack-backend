import { AppError } from "../../../errors";

export enum ObjectStorageProviderErrorCode {
  OBJECT_NOT_FOUND = "OBJECT_NOT_FOUND",
  ACCESS_DENIED = "ACCESS_DENIED",
  INVALID_REQUEST = "INVALID_REQUEST",
  TEMPORARY_FAILURE = "TEMPORARY_FAILURE",
  UNKNOWN = "UNKNOWN",
}

interface ObjectStorageProviderErrorOptions {
  code: ObjectStorageProviderErrorCode;
  message: string;
  cause?: unknown;
  retryable?: boolean | undefined;
  statusCode?: number | undefined;
}

export class ObjectStorageProviderError extends AppError {
  readonly code: ObjectStorageProviderErrorCode;
  readonly cause?: unknown;
  readonly retryable: boolean;

  constructor(
    options: ObjectStorageProviderErrorOptions,
  ) {
    super(options.message, options.statusCode ?? 500, options.code);

    this.name = "ObjectStorageProviderError";
    this.code = options.code;
    this.cause = options.cause;
    this.retryable = options.retryable ?? false;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
