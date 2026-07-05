import { BillingError } from "./BillingError";

export function isBillingError(error: unknown): error is BillingError {
  return error instanceof BillingError;
}