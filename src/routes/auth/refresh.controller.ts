import { authenticationService } from "../../services/authentication";
import { auth } from "../../config/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";
import { getClientIP, getDeviceName } from "../../utils/validation";

export const refreshController = asyncHandler(async (req, res) => {
  const session = await authenticationService.refresh(
    req.cookies?.[auth.cookies.refreshTokenName],
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
    },
  });
});
