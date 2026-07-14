import { authenticationService } from "../../services/authentication";
import { redirectUrlService } from "../../services/authentication/services/redirect-url.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

export const registerController = asyncHandler(async (req, res) => {
  const redirectUrl = redirectUrlService.resolve(
    req.body?.redirectUrl ?? req.query?.redirectUrl,
  );

  const result = await authenticationService.register(req.body);

  return ok(res, {
    ...result,
    nextStep: "verify-email",
    redirectUrl,
  });
});
