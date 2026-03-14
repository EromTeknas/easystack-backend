import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed default plans for EasyStack
 */
async function seedPlans() {
  console.log('🌱 Seeding default plans...');

  // Free Plan
  await prisma.plans.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      displayName: 'Free',
      config: {
        limits: {
          projects: 3,
          environments: 1,
          users: 1,
          api_requests_per_minute: 60,
          storage_mb: 500,
          ai_tokens_monthly: 100000,
        },
        features: {
          custom_domain: false,
          team_collaboration: false,
          audit_logs: false,
        },
        pricing: {
          monthly: 0,
          yearly: 0,
          currency: 'USD',
        },
      },
    },
  });

  // Pro Plan
  await prisma.plans.upsert({
    where: { name: 'pro' },
    update: {},
    create: {
      name: 'pro',
      displayName: 'Pro',
      config: {
        limits: {
          projects: 20,
          environments: 5,
          users: 3,
          api_requests_per_minute: 300,
          storage_mb: 5000,
          ai_tokens_monthly: 1000000,
        },
        features: {
          custom_domain: true,
          team_collaboration: false,
          audit_logs: false,
        },
        pricing: {
          monthly: 29,
          yearly: 290,
          currency: 'USD',
        },
      },
    },
  });

  // Team Plan
  await prisma.plans.upsert({
    where: { name: 'team' },
    update: {},
    create: {
      name: 'team',
      displayName: 'Team',
      config: {
        limits: {
          projects: 100,
          environments: 20,
          users: 10,
          api_requests_per_minute: 1000,
          storage_mb: 20000,
          ai_tokens_monthly: 5000000,
        },
        features: {
          custom_domain: true,
          team_collaboration: true,
          audit_logs: true,
        },
        pricing: {
          monthly: 99,
          yearly: 990,
          currency: 'USD',
        },
      },
    },
  });

  // Enterprise Plan
  await prisma.plans.upsert({
    where: { name: 'enterprise' },
    update: {},
    create: {
      name: 'enterprise',
      displayName: 'Enterprise',
      config: {
        limits: {
          projects: null, // unlimited
          environments: null,
          users: null,
          api_requests_per_minute: null,
          storage_mb: null,
          ai_tokens_monthly: null,
        },
        features: {
          custom_domain: true,
          team_collaboration: true,
          audit_logs: true,
        },
        pricing: {
          monthly: 499,
          yearly: 4990,
          currency: 'USD',
        },
      },
    },
  });

  console.log('✅ Default plans seeded successfully');
}

seedPlans()
  .catch((e) => {
    console.error('❌ Error seeding plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
