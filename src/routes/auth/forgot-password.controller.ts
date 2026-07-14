import logger from "../../utils/logger";
import { authenticationService } from "../../services/authentication";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

export const forgotPasswordController = asyncHandler(async (req, res) => {
  const email = req.body?.email;

  logger.info(`${req.method} ${req.originalUrl} request received`, {
    endpoint: "forgot-password",
    email,
    requestId: req.requestId,
  });

  try {
    const result = await authenticationService.requestPasswordReset(email);

    logger.info(`${req.method} ${req.originalUrl} request completed`, {
      endpoint: "forgot-password",
      email,
      result,
      requestId: req.requestId,
    });

    return ok(res, result);
  } finally {
    logger.info(`${req.method} ${req.originalUrl} request ended`, {
      endpoint: "forgot-password",
      email,
      requestId: req.requestId,
    });
  }
});
