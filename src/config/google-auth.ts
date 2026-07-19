import { env } from "./env";

export const googleAuthConfig = {
  clientId: env.GOOGLE_AUTH_CLIENT_ID,
} as const;
