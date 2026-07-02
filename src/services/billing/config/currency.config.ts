export const Currencies = {
  INR: "INR",
  USD: "USD",
  EUR: "EUR",
} as const;

export type Currency = (typeof Currencies)[keyof typeof Currencies];