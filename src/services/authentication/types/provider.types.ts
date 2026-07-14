import type { AuthProvider } from "@prisma/client";

export interface VerifyProviderCredentialInput {
  credential: string;
}

export interface VerifiedProviderIdentity {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuthenticationProvider {
  readonly provider: AuthProvider;

  verifyCredential(
    input: VerifyProviderCredentialInput,
  ): Promise<VerifiedProviderIdentity>;
}
