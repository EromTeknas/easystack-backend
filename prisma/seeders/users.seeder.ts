import bcrypt from "bcrypt";
import {
  PrismaClient,
  SubscriptionStatus,
} from "@prisma/client";

import { fakeUsers } from "../data/users.data";

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

    await prisma.$transaction(async (tx) => {
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
          email: fakeUser.email,
          firstName: fakeUser.firstName,
          lastName: fakeUser.lastName,
          passwordHash,
          status: fakeUser.status,
          emailVerified: fakeUser.emailVerified,
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
            name: fakeUser.workspace.name,
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

      let status: SubscriptionStatus =
        SubscriptionStatus.ACTIVE;

      let trialEndsAt: Date | null = null;

      if (
        fakeUser.subscription?.trial &&
        latestPlan.trial?.enabled
      ) {
        status = SubscriptionStatus.TRIAL;

        trialEndsAt = new Date(
          startsAt.getTime() +
            latestPlan.trial.durationDays *
              24 *
              60 *
              60 *
              1000,
        );
      }

      await tx.subscription.upsert({
        where: {
          userId: user.id,
        },

        update: {
          planVersionId: latestPlan.id,
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
        },

        create: {
          userId: user.id,
          planVersionId: latestPlan.id,
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
        },
      });
    });

    console.log(`✓ ${fakeUser.email}`);
  }

  console.log("✅ Users Seeded");
}