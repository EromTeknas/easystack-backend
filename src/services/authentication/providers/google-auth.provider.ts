import { AuthProvider } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";

import { InternalServerError, UnauthorizedError } from "../../../errors";
import { googleAuthConfig } from "../config/google-auth.config";
import type {
  AuthenticationProvider,
  VerifiedProviderIdentity,
  VerifyProviderCredentialInput,
} from "../types/provider.types";

export class GoogleAuthenticationProvider implements AuthenticationProvider {
  readonly provider = AuthProvider.GOOGLE;

  private readonly client = new OAuth2Client(googleAuthConfig.clientId);

  async verifyCredential({
    credential,
  }: VerifyProviderCredentialInput): Promise<VerifiedProviderIdentity> {
    if (!googleAuthConfig.clientId) {
      throw new InternalServerError("Google authentication is not configured");
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: googleAuthConfig.clientId,
      });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new UnauthorizedError("Google account could not be verified");
      }

      return {
        provider: AuthProvider.GOOGLE,
        providerAccountId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: true,
        firstName: payload.given_name ?? null,
        lastName: payload.family_name ?? null,
        avatarUrl: payload.picture ?? null,
        metadata: {
          hostedDomain: payload.hd ?? null,
          locale: payload.locale ?? null,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }

      throw new UnauthorizedError("Invalid Google credential");
    }
  }
}
