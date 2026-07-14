import { authenticationService } from "../../services/authentication";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

export const forgotPasswordController = asyncHandler(async (req, res) => {
  const result = await authenticationService.requestPasswordReset(req.body?.email);

  return ok(res, result);
});
