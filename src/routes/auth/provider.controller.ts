import { authenticationService } from "../../services/authentication";
import { auth } from "../../config/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";
import { getClientIP, getDeviceName } from "../../utils/validation";
import { redirectUrlService } from "../../services/authentication/services/redirect-url.service";
import { BadRequestError } from "../../errors";

export const googleLoginController = asyncHandler(async (req, res) => {
  const redirectUrl = redirectUrlService.resolve(
    req.body?.redirectUrl ?? req.query?.redirectUrl,
  );

  const session = await authenticationService.loginWithGoogle(
    req.body?.credential,
    {
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"] as string | undefined,
      deviceName: getDeviceName((req.headers["user-agent"] as string) ?? ""),
    },
  );

  setAccessTokenCookie(res, session.accessToken);
  setRefreshTokenCookie(res, session.refreshToken);

  return ok(res, {
    user: {
      id: session.user.id.toString(),
      resourceId: session.user.resourceId,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      onboardingCompleted: session.user.onboardingCompleted,
      defaultWorkspaceId: session.user.defaultWorkspaceId,
    },
    expiresIn: auth.accessTokenExpirySeconds,
    redirectUrl,
  });
});

export const linkGoogleController = asyncHandler(async (req, res) => {
  const result = await authenticationService.linkGoogle(
    req.user!.id.toString(),
    req.body?.credential,
  );

  return ok(res, result);
});

export const addPasswordController = asyncHandler(async (req, res) => {
  if (!req.body?.password) {
    throw new BadRequestError("Password is required");
  }
  
  const result = await authenticationService.addPasswordMethod(
    req.user!.id.toString(),
    req.body.password,
  );

  return ok(res, result);
});

export const getAuthProvidersController = asyncHandler(async (req, res) => {
  const result = await authenticationService.getLinkedAuthProviders(
    req.user!.id.toString(),
  );

  return ok(res, result);
});
