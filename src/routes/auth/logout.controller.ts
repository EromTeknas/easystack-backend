import { authenticationService } from "../../services/authentication";
import { auth } from "../../config/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { clearAuthCookies } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";

export const logoutController = asyncHandler(async (req, res) => {
  await authenticationService.logout({
    refreshToken: req.cookies?.[auth.cookies.refreshTokenName],
    logoutFromAllDevices: req.body?.logoutFromAllDevices,
  });

  clearAuthCookies(res);

  return ok(res, {
    message: "Logged out successfully",
  });
});
