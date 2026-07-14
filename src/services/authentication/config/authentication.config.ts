export const authenticationConfig = {
  cacheVersion: "v1",
  publicSignupPlanKeys: new Set(["free"]),
  verificationLockSeconds: 15,
  tokenRetentionDays: 30,
} as const;
