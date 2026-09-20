import { PrismaClient } from "@prisma/client";
import { UsageService } from "../services/billing/services/usage.service";

const prisma = new PrismaClient();

async function backfillWorkspaces() {
  console.log("Searching for workspaces without a subscription...");

  const workspaces = await prisma.workspace.findMany({
    where: {
      subscription: null,
    },
  });

  if (workspaces.length === 0) {
    console.log("No orphaned workspaces found. All workspaces have subscriptions!");
    return;
  }

  console.log(`Found ${workspaces.length} workspaces without a subscription. Backfilling with Free Plan...`);

  const freePlan = await prisma.plan.findUnique({
    where: { key: "free" },
    include: {
      versions: {
        where: { isLatest: true },
        orderBy: { version: "desc" },
        take: 1,
        include: { trial: true, quotas: { select: { quotaId: true } } },
      },
    },
  });

  if (!freePlan || !freePlan.versions[0]) {
    throw new Error("Free plan version not found in database.");
  }

  const planVersion = freePlan.versions[0];
  const now = new Date();

  for (const workspace of workspaces) {
    console.log(`Provisioning Workspace ID: ${workspace.id}`);

    await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          billingOwnerId: workspace.createdById,
          planVersionId: planVersion.id,
          status: "ACTIVE",
          startsAt: now,
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          workspaceId: workspace.id,
          subscriptionId: subscription.id,
          planVersionId: planVersion.id,
          status: "ACTIVE",
          startsAt: now,
          reason: "BACKFILL_SCRIPT",
        },
      });

      if (planVersion.quotas.length > 0) {
        await tx.usage.createMany({
          data: planVersion.quotas.map((quota) => ({
            workspaceId: workspace.id,
            quotaId: quota.quotaId,
            value: 0,
          })),
          skipDuplicates: true,
        });
      }
    });

    await UsageService.initialize(workspace.id);
  }

  console.log("Backfill complete!");
}

backfillWorkspaces()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    setTimeout(() => process.exit(0), 100);
  });
