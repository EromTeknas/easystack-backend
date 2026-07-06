import { AppError } from "../../../errors/AppError";
import { BillingErrorCode } from "./BillingErrorCode";

export abstract class BillingError extends AppError {
  readonly isBillingError = true;

  constructor(
    message: string,
    statusCode: number,
    code: BillingErrorCode,
    metadata?: Record<string, any>
  ) {
    // Pass the standard properties up to AppError
    super(message, statusCode, code, metadata);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
