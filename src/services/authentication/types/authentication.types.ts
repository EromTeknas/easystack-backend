import type { AuthProvider, UserStatus } from "@prisma/client";

export interface ClientContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  deviceName?: string | undefined;
}

export interface AuthUser {
  id: number;
  resourceId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  status: UserStatus;
  defaultWorkspaceId: number | null;
  createdAt: Date;
}

export interface PublicAuthUser {
  id: string;
  resourceId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  status: UserStatus;
  createdAt: Date;
  defaultWorkspaceId: number | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedSession extends SessionTokens {
  user: AuthUser;
}

export interface RegisterPasswordInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  planKey?: string;
  redirectUrl?: string;
}

export interface LoginPasswordInput {
  email: string;
  password: string;
  redirectUrl?: string;
}

export interface ProviderLoginInput {
  provider: AuthProvider;
  credential: string;
  redirectUrl?: string;
}

export interface VerifyEmailInput {
  verificationToken: string;
  otpCode: string;
  redirectUrl?: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

export interface UnlinkProviderInput {
  currentPassword?: string;
  credential?: string;
}

export interface LogoutInput {
  refreshToken?: string | undefined;
  logoutFromAllDevices?: boolean;
}
