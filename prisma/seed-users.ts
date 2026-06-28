import { PrismaClient, SubscriptionStatus, UserStatus } from "@prisma/client";
import { fakeUsers } from "./seeders/data/users.data";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seedUsers() {
  console.log("🌱 Seeding fake users with workspaces and subscriptions...");

  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);

  // Get or create FREE plan
  const freePlan = await prisma.plan.findUnique({
    where: {
      key: "free",
    },
    include: {
      versions: {
        orderBy: {
          version: "desc",
        },
        take: 1,
      },
    },
  });

  if (!freePlan) {
    throw new Error("Free plan not found. Run plan seeder first.");
  }

  const freePlanVersion = freePlan.versions[0];

  if (!freePlanVersion) {
    throw new Error("Free plan has no versions.");
  }

  const workspaceOwnerRole = await prisma.role.findUnique({
    where: {
      key: "WORKSPACE_OWNER",
    },
  });

  if (!workspaceOwnerRole) {
    throw new Error(
      "WORKSPACE_OWNER role not found. Run authorization seeder.",
    );
  }

  for (const userData of fakeUsers) {
    try {
      // Hash the password
      const passwordHash = await bcrypt.hash(userData.password, bcryptRounds);

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: {
            email: userData.email,
          },

          update: {
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            status: userData.status ?? UserStatus.PENDING_VERIFICATION,
            emailVerified: userData.emailVerified ?? false,
          },

          create: {
            email: userData.email,
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            status: userData.status ?? UserStatus.PENDING_VERIFICATION,
            emailVerified: userData.emailVerified ?? false,
          },
        });

        const workspaceName =
          userData.workspaceName ?? `${userData.firstName}'s Workspace`;


        
        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            createdById: user.id,
          },
        });
        

        await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: workspace.id,
              userId: user.id,
            },
          },

          update: {
            roleId: workspaceOwnerRole.id,
            removedAt: null,
          },

          create: {
            workspaceId: workspace.id,
            userId: user.id,
            roleId: workspaceOwnerRole.id,
          },
        });

        await tx.subscription.upsert({
          where: {
            userId: user.id,
          },

          update: {
            planId: freePlan.id,
            planVersionId: freePlanVersion.id,
            status: SubscriptionStatus.ACTIVE,
            startsAt: new Date(),
            expiresAt: null,
          },

          create: {
            userId: user.id,
            planId: freePlan.id,
            planVersionId: freePlanVersion.id,
            status: SubscriptionStatus.ACTIVE,
            startsAt: new Date(),
            expiresAt: null,
          },
        });

        console.log(`✅ Seeded ${user.email} -> ${workspace.name}`);
      });
    } catch (error) {
      console.error(`❌ Error seeding user ${userData.email}:`, error);
    }
  }

  console.log("✅ User seeding with workspaces and subscriptions completed!");
}

// Main execution
seedUsers()
  .catch((error) => {
    console.error("🚨 Error during seeding:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
