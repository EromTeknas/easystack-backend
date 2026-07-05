import { BillingErrorCode } from "./BillingErrorCode";

export interface BillingErrorMetadata {
  [key: string]: unknown;
}

export interface BillingErrorOptions {
  message: string;
  metadata?: BillingErrorMetadata;
  cause?: unknown;
}

export abstract class BillingError extends Error {
  abstract readonly code: BillingErrorCode;
  abstract readonly statusCode: number;

  readonly metadata?: BillingErrorMetadata;
  readonly isBillingError = true;

  constructor(options: BillingErrorOptions) {
    super(options.message, {
      cause: options.cause,
    });

    this.name = new.target.name;
    this.metadata = options.metadata ?? {};

    Error.captureStackTrace?.(this, this.constructor);
  }

  serialize() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }

  toJSON() {
    return this.serialize();
  }
}