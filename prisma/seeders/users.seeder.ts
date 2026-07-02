import bcrypt from "bcrypt";
import {
  PrismaClient,
  SubscriptionStatus,
} from "@prisma/client";

import { fakeUsers } from "../data/users.data";

export async function seedUsers(prisma: PrismaClient) {
  console.log("🌱 Seeding Users...");

  for (const fakeUser of fakeUsers) {
    await prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(fakeUser.password, 10);

      const user = await tx.user.upsert({
        where: {
          email: fakeUser.email,
        },

        update: {},

        create: {
          email: fakeUser.email,
          firstName: fakeUser.firstName,
          lastName: fakeUser.lastName,
          password: hashedPassword,
          status: fakeUser.status,
          emailVerified: fakeUser.emailVerified,
        },
      });

      const workspace = await tx.workspace.upsert({
        where: {
          slug: fakeUser.workspace.slug,
        },

        update: {},

        create: {
          name: fakeUser.workspace.name,
          slug: fakeUser.workspace.slug,
          ownerId: user.id,
        },
      });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },

        update: {},

        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      const latestVersion = await tx.planVersion.findFirst({
        where: {
          isLatest: true,
          plan: {
            key: fakeUser.subscription.plan,
          },
        },

        include: {
          trial: true,
        },
      });

      if (!latestVersion) {
        throw new Error(
          `Latest version not found for ${fakeUser.subscription.plan}`,
        );
      }

      const startsAt = new Date();

      let expiresAt: Date | null = null;

      let status = SubscriptionStatus.ACTIVE;

      if (
        fakeUser.subscription.trial &&
        latestVersion.trial?.enabled
      ) {
        status = SubscriptionStatus.TRIAL;

        expiresAt = new Date(
          startsAt.getTime() +
            latestVersion.trial.durationDays *
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
          planVersionId: latestVersion.id,
          status,
          startsAt,
          expiresAt,
        },

        create: {
          userId: user.id,
          planVersionId: latestVersion.id,
          status,
          startsAt,
          expiresAt,
        },
      });
    });
  }

  console.log("✅ Users Seeded");
}