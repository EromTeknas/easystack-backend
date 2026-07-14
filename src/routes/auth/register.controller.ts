import { authenticationService } from "../../services/authentication";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

export const registerController = asyncHandler(async (req, res) => {
  const result = await authenticationService.register(req.body);

  return ok(res, {
    ...result,
    nextStep: "verify-email",
  });
});
