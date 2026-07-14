import { authenticationService } from "../../services/authentication";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";
import { getClientIP, getDeviceName } from "../../utils/validation";

export const googleLoginController = asyncHandler(async (req, res) => {
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
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      onboardingCompleted: session.user.onboardingCompleted,
      defaultWorkspaceId: session.user.defaultWorkspaceId,
    },
  });
});

export const linkGoogleController = asyncHandler(async (req, res) => {
  const result = await authenticationService.linkGoogle(
    req.user!.id.toString(),
    req.body?.credential,
  );

  return ok(res, result);
});
