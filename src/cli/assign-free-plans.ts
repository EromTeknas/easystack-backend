import { prisma } from '../db/prisma';
import { BillingService } from '../services/billing.service';

/**
 * CLI script to assign free plan to all workspaces without subscriptions
 * Usage: npm run billing:assign-free
 */
async function assignFreePlans() {
  console.log('Finding workspaces without subscriptions...\n');
  
  const workspaces = await prisma.workspace.findMany({
    where: {
      subscription: null,
    },
    include: {
      members: {
        include: { role: true },
      },
    },
  });

  if (workspaces.length === 0) {
    console.log('All workspaces already have subscriptions!');
    process.exit(0);
  }

  console.log(`Found ${workspaces.length} workspace(s) without subscriptions\n`);

  let successCount = 0;
  let failCount = 0;

  for (const workspace of workspaces) {
    const owner = workspace.members.find((member) => member.role.key === "WORKSPACE_OWNER") ?? workspace.members[0];

    try {
      await BillingService.createFreeSubscription(workspace.id, owner?.userId);
      console.log(`OK [${workspace.id}] ${workspace.name}`);
      successCount++;
    } catch (error: any) {
      console.error(`FAILED [${workspace.id}] ${workspace.name}: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('='.repeat(50));
  
  process.exit(failCount > 0 ? 1 : 0);
}

assignFreePlans().catch((error) => {
  console.error('\nMigration failed:', error);
  process.exit(1);
});
