import { authenticationService } from "../../services/authentication";
import { auth } from "../../config/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { BadRequestError } from "../../errors";

export const listSessionsController = asyncHandler(async (req, res) => {
  const result = await authenticationService.listSessions(
    req.user!.id.toString(),
    req.cookies?.[auth.cookies.refreshTokenName],
  );

  return ok(res, result);
});

export const revokeSessionController = asyncHandler(async (req, res) => {
  const sessionId = Number(req.params.sessionId);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new BadRequestError("Valid sessionId is required");
  }

  const result = await authenticationService.revokeSession(
    req.user!.id.toString(),
    sessionId,
    req.cookies?.[auth.cookies.refreshTokenName],
  );

  return ok(res, result);
});

export const revokeOtherSessionsController = asyncHandler(async (req, res) => {
  const result = await authenticationService.revokeOtherSessions(
    req.user!.id.toString(),
    req.cookies?.[auth.cookies.refreshTokenName],
  );

  return ok(res, result);
});
