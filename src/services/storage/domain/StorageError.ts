import { AppError } from "../../../errors";

export enum StorageErrorCode {
  INVALID_TARGET = "INVALID_TARGET",
  INVALID_FILE = "INVALID_FILE",
  MIME_TYPE_NOT_ALLOWED = "MIME_TYPE_NOT_ALLOWED",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  MIME_EXTENSION_NOT_SUPPORTED = "MIME_EXTENSION_NOT_SUPPORTED",

  UPLOAD_INTENT_NOT_FOUND = "UPLOAD_INTENT_NOT_FOUND",
  UPLOAD_INTENT_EXPIRED = "UPLOAD_INTENT_EXPIRED",
  UPLOAD_INTENT_ALREADY_COMPLETED = "UPLOAD_INTENT_ALREADY_COMPLETED",
  UPLOAD_INTENT_FAILED = "UPLOAD_INTENT_FAILED",
  UPLOAD_INTENT_FORBIDDEN = "UPLOAD_INTENT_FORBIDDEN",

  UPLOADED_OBJECT_NOT_FOUND = "UPLOADED_OBJECT_NOT_FOUND",
  UPLOADED_OBJECT_INVALID = "UPLOADED_OBJECT_INVALID",

  ASSET_NOT_FOUND = "ASSET_NOT_FOUND",
  PRIVATE_ASSET_ACCESS_DENIED = "PRIVATE_ASSET_ACCESS_DENIED",

  STORAGE_PROVIDER_ERROR = "STORAGE_PROVIDER_ERROR",
  STORAGE_PERSISTENCE_ERROR = "STORAGE_PERSISTENCE_ERROR",
}

interface StorageErrorOptions {
  code: StorageErrorCode;
  message: string;
  statusCode: number;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class StorageError extends AppError {
  readonly code: StorageErrorCode;
  readonly statusCode: number;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(options: StorageErrorOptions) {
    super(options.message, options.statusCode, options.code, options.details);

    this.name = "StorageError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.cause = options.cause;
    this.details = options.details!;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}