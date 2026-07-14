import { authenticationService } from "../../services/authentication";
import { auth } from "../../config/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";
import { getClientIP, getDeviceName } from "../../utils/validation";
import { redirectUrlService } from "../../services/authentication/services/redirect-url.service";

export const verifyEmailController = asyncHandler(async (req, res) => {
  const redirectUrl = redirectUrlService.resolve(
    req.body?.redirectUrl ?? req.query?.redirectUrl,
  );

  const session = await authenticationService.verifyEmail(req.body, {
    ipAddress: getClientIP(req),
    userAgent: req.headers["user-agent"] as string | undefined,
    deviceName: getDeviceName((req.headers["user-agent"] as string) ?? ""),
  });

  setAccessTokenCookie(res, session.accessToken);
  setRefreshTokenCookie(res, session.refreshToken);

  return ok(res, {
    user: {
      id: session.user.id.toString(),
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      emailVerified: session.user.emailVerified,
      onboardingCompleted: session.user.onboardingCompleted,
      defaultWorkspaceId: session.user.defaultWorkspaceId,
    },
    expiresIn: auth.accessTokenExpirySeconds,
    redirectUrl,
  });
});
