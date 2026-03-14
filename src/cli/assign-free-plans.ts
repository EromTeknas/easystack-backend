import { prisma } from '../db/prisma';
import { BillingService } from '../services/billing.service';

/**
 * CLI script to assign free plan to all users without subscriptions
 * Usage: npm run billing:assign-free
 */
async function assignFreePlans() {
  console.log('🔄 Finding users without subscriptions...\n');
  
  const users = await prisma.user.findMany({
    where: {
      subscriptions: null,
    },
  });

  if (users.length === 0) {
    console.log('✅ All users already have subscriptions!');
    process.exit(0);
  }

  console.log(`Found ${users.length} user(s) without subscriptions\n`);

  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    try {
      await BillingService.createFreeSubscription(user.id);
      console.log(`✅ [${user.id}] ${user.email}`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ [${user.id}] ${user.email}: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('='.repeat(50));
  
  process.exit(failCount > 0 ? 1 : 0);
}

assignFreePlans().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
