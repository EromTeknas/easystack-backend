import { PrismaClient, User_status } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Generate fake users for testing purposes
 */
interface FakeUserConfig {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  status?: User_status;
  emailVerified?: boolean;
  workspaceName?: string;
}

const fakeUsers: FakeUserConfig[] = [
  {
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    password: 'Test@12345678',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Alice's Workspace",
  },
  {
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Smith',
    password: 'Test@98765432',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Bob's Workspace",
  },
  {
    email: 'charlie@example.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    password: 'Test@11223344',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Charlie's Workspace",
  },
  {
    email: 'diana@example.com',
    firstName: 'Diana',
    lastName: 'Prince',
    password: 'Test@55667788',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Diana's Workspace",
  },
  {
    email: 'evan@example.com',
    firstName: 'Evan',
    lastName: 'Davis',
    password: 'Test@99887766',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Evan's Workspace",
  },
  {
    email: 'fiona@example.com',
    firstName: 'Fiona',
    lastName: 'Wilson',
    password: 'Test@44332211',
    status: 'PENDING_VERIFICATION',
    emailVerified: false,
    workspaceName: "Fiona's Workspace",
  },
  {
    email: 'george@example.com',
    firstName: 'George',
    lastName: 'Miller',
    password: 'Test@77554433',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "George's Workspace",
  },
  {
    email: 'helen@example.com',
    firstName: 'Helen',
    lastName: 'Taylor',
    password: 'Test@88664422',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Helen's Workspace",
  },
  {
    email: 'ian@example.com',
    firstName: 'Ian',
    lastName: 'Anderson',
    password: 'Test@22334455',
    status: 'INACTIVE',
    emailVerified: true,
    workspaceName: "Ian's Workspace",
  },
  {
    email: 'julia@example.com',
    firstName: 'Julia',
    lastName: 'Thomas',
    password: 'Test@66778899',
    status: 'ACTIVE',
    emailVerified: true,
    workspaceName: "Julia's Workspace",
  },
];

async function seedUsers() {
  console.log('🌱 Seeding fake users with workspaces and subscriptions...');

  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  // Get or create FREE plan
  const freePlan = await prisma.plans.findFirst({
    where: { name: 'free' },
  });

  if (!freePlan) {
    throw new Error('FREE plan not found. Run seed:plans first.');
  }

  for (const userData of fakeUsers) {
    try {
      // Hash the password
      const passwordHash = await bcrypt.hash(userData.password, bcryptRounds);

      // Create or update user with workspace and subscription
      const user = await prisma.$transaction(async (tx) => {
        // Step 1: Create or update user
        const user = await tx.user.upsert({
          where: { email: userData.email },
          update: {
            status: userData.status || 'PENDING_VERIFICATION',
            emailVerified: userData.emailVerified ?? false,
          },
          create: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            passwordHash,
            status: userData.status || 'PENDING_VERIFICATION',
            emailVerified: userData.emailVerified ?? false,
          },
        });

        // Step 2: Create default workspace for user (if not already exists)
        const workspaceName = userData.workspaceName || `${userData.firstName}'s Workspace`;
        const existingWorkspace = await tx.workspace.findFirst({
          where: {
            name: workspaceName,
            createdBy: user.id,
          },
        });

        if (!existingWorkspace) {
          const workspace = await tx.workspace.create({
            data: {
              name: workspaceName,
              createdBy: user.id,
            },
          });

          // Step 3: Add user as OWNER of their workspace
          await tx.workspaceMember.create({
            data: {
              workspaceId: workspace.id,
              userId: user.id,
              role: 'OWNER',
              isDefault: true,
            },
          });

          console.log(`✅ Seeded user: ${user.email} (ID: ${user.id}) with workspace: "${workspace.name}"`);
        } else {
          console.log(`✅ Seeded user: ${user.email} (ID: ${user.id}) - workspace already exists`);
        }

        // Step 4: Create or update subscription with FREE plan
        await tx.subscriptions.upsert({
          where: { userId: user.id },
          update: {
            planId: freePlan.id,
            status: 'ACTIVE',
          },
          create: {
            userId: user.id,
            planId: freePlan.id,
            status: 'ACTIVE',
          },
        });

        return user;
      });
    } catch (error) {
      console.error(`❌ Error seeding user ${userData.email}:`, error);
    }
  }

  console.log('✅ User seeding with workspaces and subscriptions completed!');
}

// Main execution
seedUsers()
  .catch((error) => {
    console.error('🚨 Error during seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
