import { authenticationService } from "../../services/authentication";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

export const resetPasswordController = asyncHandler(async (req, res) => {
  const result = await authenticationService.resetPassword(req.body);

  return ok(res, result);
});
