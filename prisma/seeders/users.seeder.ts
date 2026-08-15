import bcrypt from "bcrypt";
import { AuthProvider, PrismaClient, SubscriptionStatus } from "@prisma/client";

import { fakeUsers } from "../data/users.data";
import { UsageService } from "../../src/services/billing/services/usage.service";
import { BillingContextService } from "../../src/services/billing/cache/billing.context.service";
import ResourceIdService from "../../src/services/resource-id.service";
export async function seedUsers(prisma: PrismaClient) {
  console.log("🌱 Seeding Users...");

  /**
   * --------------------------------------------------------------------------
   * Load required data once
   * --------------------------------------------------------------------------
   */

  const ownerRole = await prisma.role.findUnique({
    where: {
      key: "WORKSPACE_OWNER",
    },
  });

  if (!ownerRole) {
    throw new Error(
      "WORKSPACE_OWNER role not found. Please run authorization seeder first.",
    );
  }

  const latestPlans = new Map(
    (
      await prisma.planVersion.findMany({
        where: {
          isLatest: true,
        },
        include: {
          plan: true,
          trial: true,
        },
      })
    ).map((version) => [version.plan.key, version]),
  );

  /**
   * --------------------------------------------------------------------------
   * Seed Users
   * --------------------------------------------------------------------------
   */

  for (const fakeUser of fakeUsers) {
    const passwordHash = await bcrypt.hash(fakeUser.password, 10);

    const planKey = fakeUser.subscription?.plan ?? "free";

    const latestPlan = latestPlans.get(planKey);

    if (!latestPlan) {
      throw new Error(`Plan '${planKey}' not found.`);
    }

    const seeded = await prisma.$transaction(async (tx) => {
      /**
       * ----------------------------------------------------------------------
       * User
       * ----------------------------------------------------------------------
       */

      const user = await tx.user.upsert({
        where: {
          email: fakeUser.email,
        },

        update: {
          firstName: fakeUser.firstName,
          lastName: fakeUser.lastName,
          status: fakeUser.status,
          emailVerified: fakeUser.emailVerified,
        },

        create: {
          resourceId: await ResourceIdService.generateUniqueUserId(tx),
          email: fakeUser.email,
          firstName: fakeUser.firstName,
          lastName: fakeUser.lastName,
          status: fakeUser.status,
          emailVerified: fakeUser.emailVerified,
        },
      });

      await tx.authAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.PASSWORD,
            providerAccountId: fakeUser.email,
          },
        },
        update: {
          userId: user.id,
          email: fakeUser.email,
          emailVerified: fakeUser.emailVerified,
          passwordHash,
        },
        create: {
          userId: user.id,
          provider: AuthProvider.PASSWORD,
          providerAccountId: fakeUser.email,
          email: fakeUser.email,
          emailVerified: fakeUser.emailVerified,
          passwordHash,
        },
      });

      /**
       * ----------------------------------------------------------------------
       * Workspace
       * ----------------------------------------------------------------------
       */

      let workspace = await tx.workspace.findFirst({
        where: {
          createdById: user.id,
        },
      });

      if (!workspace) {
        workspace = await tx.workspace.create({
          data: {
            resourceId: await ResourceIdService.generateUniqueWorkspaceId(tx),
            name: fakeUser.workspace.name,
            slug: fakeUser.workspace.slug,
            createdById: user.id,
          },
        });
      }

      /**
       * ----------------------------------------------------------------------
       * Workspace Member
       * ----------------------------------------------------------------------
       */

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },

        update: {
          roleId: ownerRole.id,
        },

        create: {
          workspaceId: workspace.id,
          userId: user.id,
          roleId: ownerRole.id,
        },
      });

      /**
       * ----------------------------------------------------------------------
       * Subscription
       * ----------------------------------------------------------------------
       */

      const startsAt = new Date();

      let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;

      let trialEndsAt: Date | null = null;

      if (fakeUser.subscription?.trial && latestPlan.trial?.enabled) {
        status = SubscriptionStatus.TRIAL;

        trialEndsAt = new Date(
          startsAt.getTime() +
            latestPlan.trial.durationDays * 24 * 60 * 60 * 1000,
        );
      }

      const subscription = await tx.subscription.upsert({
        where: {
          workspaceId: workspace.id,
        },

        update: {
          planVersionId: latestPlan.id,
          billingOwnerId: user.id,
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
        },

        create: {
          workspaceId: workspace.id,
          billingOwnerId: user.id,
          planVersionId: latestPlan.id,
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
        },
      });

      const existingHistory = await tx.subscriptionHistory.findFirst({
        where: {
          subscriptionId: subscription.id,
        },
      });

      if (!existingHistory) {
        await tx.subscriptionHistory.create({
          data: {
            workspaceId: workspace.id,
            subscriptionId: subscription.id,
            planVersionId: subscription.planVersionId,
            status: subscription.status,
            startsAt: subscription.startsAt,
            endsAt: subscription.expiresAt ?? subscription.trialEndsAt,
            reason: "Initial subscription",
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { defaultWorkspaceId: workspace.id },
      });

      return { userId: user.id, workspaceId: workspace.id };
    });
    try{
      // Initialize the usage rows in MySQL and push the state to Redis
      await UsageService.initialize(Number(seeded.workspaceId), latestPlan.id);
  
      // Ensure the main billing cache is warm
      await BillingContextService.refresh(Number(seeded.workspaceId));

    } catch (error) {
      console.error(`Error initializing usage or refreshing billing context for user ${fakeUser.email}:`, error);
    }
    console.log(`✓ ${fakeUser.email}`);
  }

  console.log("✅ Users Seeded");
}
