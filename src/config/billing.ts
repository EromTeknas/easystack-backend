import { env } from "./env";

export const billingConfig = {
  resetTestMode: env.BILLING_RESET_TEST_MODE,
} as const;
