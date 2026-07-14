import { authenticationService } from "../../services/authentication";
import { auth } from "../../config/auth";
import WorkspaceRepository from "../../repositories/workspace.repository";
import { BillingService } from "../../services/billing/";
import { UnauthorizedError } from "../../errors";
import { asyncHandler } from "../../utils/asyncHandler";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";
import { getClientIP, getDeviceName } from "../../utils/validation";

export const getMeController = asyncHandler(async (req, res) => {
  const accessToken = req.cookies?.[auth.cookies.accessTokenName];
  let userId: string | null = null;

  if (accessToken) {
    try {
      userId = authenticationService.verifyAccessToken(accessToken).sub;
    } catch (error: any) {
      if (error?.message !== "Token expired") {
        throw error;
      }
    }
  }

  if (!userId) {
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
    userId = session.user.id.toString();
  }

  if (!userId) {
    throw new UnauthorizedError("Not authenticated");
  }

  const user = await authenticationService.getCurrentUser(userId);
  const workspaces = await WorkspaceRepository.getUserWorkspaces(Number(userId));
  const billing = user.defaultWorkspaceId
    ? await BillingService.get(user.defaultWorkspaceId)
    : null;
  const effectivePlan = user.defaultWorkspaceId
    ? await BillingService.getEffectivePlan(user.defaultWorkspaceId)
    : null;

  return ok(res, {
    user,
    workspaces: workspaces.map((workspace: any) => ({
      id: workspace.id,
      name: workspace.name,
      logoUrl: workspace.logo_url,
      role: workspace.role,
      createdAt: workspace.created_at,
    })),
    billing: {
      plan: effectivePlan,
      subscription: billing?.subscription ?? null,
      usage: billing?.usage ?? {},
      features: billing?.features ?? {},
    },
  });
});
