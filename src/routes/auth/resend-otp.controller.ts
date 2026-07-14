import { authenticationService } from "../../services/authentication";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

export const resendOtpController = asyncHandler(async (req, res) => {
  const result = await authenticationService.resendEmailVerification(
    req.body?.verificationToken,
  );

  return ok(res, result);
});
