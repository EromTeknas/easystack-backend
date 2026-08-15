import {
  AuthProvider,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  UserStatus,
} from "@prisma/client";

import { BadRequestError, InternalServerError } from "../../../errors";
import type { VerifiedProviderIdentity } from "../types/provider.types";
import type { AuthUser } from "../types/authentication.types";
import ResourceIdService from "../../resource-id.service";

const authUserSelect = {
  id: true,
  resourceId: true,
  email: true,
  firstName: true,
  lastName: true,
  emailVerified: true,
  onboardingCompleted: true,
  status: true,
  defaultWorkspaceId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type TransactionClient = Prisma.TransactionClient;

export interface ProvisioningResult {
  user: AuthUser;
  workspaceId: number;
}

export class AccountProvisioningRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async activateAndProvisionExistingUser(
    userId: number,
    planKey: string,
  ): Promise<ProvisioningResult> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          status: UserStatus.ACTIVE,
        },
        select: authUserSelect,
      });

      await tx.authAccount.updateMany({
        where: {
          userId,
          provider: AuthProvider.PASSWORD,
        },
        data: { emailVerified: true },
      });

      const workspaceId = await this.ensureWorkspaceAndInitialPlan(
        tx,
        user,
        planKey,
      );

      return {
        user: { ...user, defaultWorkspaceId: workspaceId },
        workspaceId,
      };
    });
  }

  async createExternalUserAndProvision(input: {
    identity: VerifiedProviderIdentity;
    planKey: string;
  }): Promise<ProvisioningResult> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          resourceId: await ResourceIdService.generateUniqueUserId(tx),
          email: input.identity.email,
          firstName: input.identity.firstName,
          lastName: input.identity.lastName,
          emailVerified: true,
          status: UserStatus.ACTIVE,
        },
        select: authUserSelect,
      });

      await tx.authAccount.create({
        data: {
          userId: user.id,
          provider: input.identity.provider,
          providerAccountId: input.identity.providerAccountId,
          email: input.identity.email,
          emailVerified: input.identity.emailVerified,
          ...(input.identity.metadata
            ? { metadata: input.identity.metadata as Prisma.InputJsonValue }
            : {}),
          lastUsedAt: new Date(),
        },
      });

      const workspaceId = await this.ensureWorkspaceAndInitialPlan(
        tx,
        user,
        input.planKey,
      );

      return {
        user: { ...user, defaultWorkspaceId: workspaceId },
        workspaceId,
      };
    });
  }

  private async ensureWorkspaceAndInitialPlan(
    tx: TransactionClient,
    user: AuthUser,
    planKey: string,
  ): Promise<number> {
    const ownerRole = await tx.role.findUnique({
      where: { key: "WORKSPACE_OWNER" },
      select: { id: true },
    });

    if (!ownerRole) {
      throw new InternalServerError(
        "Workspace owner role not found. Ensure authorization roles are seeded.",
      );
    }

    const existingMembership = await tx.workspaceMember.findFirst({
      where: {
        userId: user.id,
        removedAt: null,
      },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });

    let workspaceId = existingMembership?.workspaceId ?? user.defaultWorkspaceId;

    if (!workspaceId) {
      const workspace = await tx.workspace.create({
        data: {
          resourceId: await ResourceIdService.generateUniqueWorkspaceId(tx),
          name: user.firstName ? `${user.firstName}'s Workspace` : "My Workspace",
          slug: this.buildDefaultWorkspaceSlug(user.email, user.id),
          createdById: user.id,
        },
        select: { id: true },
      });

      workspaceId = workspace.id;

      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          roleId: ownerRole.id,
        },
      });
    }

    if (user.defaultWorkspaceId !== workspaceId) {
      await tx.user.update({
        where: { id: user.id },
        data: { defaultWorkspaceId: workspaceId },
      });
    }

    const existingSubscription = await tx.subscription.findUnique({
      where: { workspaceId },
      select: { id: true },
    });

    if (!existingSubscription) {
      const plan = await tx.plan.findUnique({
        where: { key: planKey },
        include: {
          versions: {
            where: { isLatest: true },
            orderBy: { version: "desc" },
            take: 1,
            include: {
              trial: true,
              quotas: {
                select: { quotaId: true },
              },
            },
          },
        },
      });

      const planVersion = plan?.versions[0];

      if (!plan || !plan.isActive || !plan.isPublic || !planVersion) {
        throw new BadRequestError(`Signup plan '${planKey}' is unavailable`);
      }

      const now = new Date();
      const hasTrial = plan.key !== "free" && planVersion.trial?.enabled === true;
      const status = hasTrial
        ? SubscriptionStatus.TRIAL
        : SubscriptionStatus.ACTIVE;
      const trialEndsAt = hasTrial
        ? new Date(
            now.getTime() +
              (planVersion.trial?.durationDays ?? 0) * 24 * 60 * 60 * 1000,
          )
        : null;

      const subscription = await tx.subscription.create({
        data: {
          workspaceId,
          billingOwnerId: user.id,
          planVersionId: planVersion.id,
          status,
          startsAt: now,
          trialEndsAt,
        },
        select: { id: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          workspaceId,
          subscriptionId: subscription.id,
          planVersionId: planVersion.id,
          status,
          startsAt: now,
          reason: "ACCOUNT_ACTIVATION",
        },
      });

      if (planVersion.quotas.length > 0) {
        await tx.usage.createMany({
          data: planVersion.quotas.map((quota) => ({
            workspaceId,
            quotaId: quota.quotaId,
            value: 0,
          })),
          skipDuplicates: true,
        });
      }
    }

    return workspaceId;
  }

  private buildDefaultWorkspaceSlug(email: string, userId: number): string {
    const localPart = email.split("@")[0] ?? "workspace";
    const base =
      localPart
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "workspace";

    return `${base}-${userId}`;
  }
}
