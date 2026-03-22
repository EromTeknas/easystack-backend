import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RolePermissionSeed {
  role: 'ADMIN' | 'MEMBER';
  actions: string[];
}

/**
 * Seed role-based permissions
 * 
 * IMPORTANT: Only ADMIN and MEMBER (USER) defaults are seeded
 * OWNER permissions are implicit (not stored in database)
 * 
 * OWNER has all permissions granted implicitly:
 * - workspace.read, workspace.update.name, workspace.update.logo
 * - workspace.members.add, workspace.members.remove, workspace.members.change_role
 * - workspace.permissions.grant, workspace.permissions.revoke
 * - workspace.delete (only OWNER)
 * - project.read, project.update.name, project.update.description
 * - project.delete, project.members.add, project.members.remove
 */
const rolePermissions: RolePermissionSeed[] = [
  {
    role: 'ADMIN',
    actions: [
      'workspace.read',
      'workspace.update.name',
      'workspace.update.logo',
      'workspace.members.add',
      'workspace.members.remove',
      'workspace.permissions.grant',
      'workspace.permissions.revoke',
      'project.read',
      'project.update.name',
      'project.update.description',
      'project.delete',
      'project.members.add',
      'project.members.remove',
    ],
  },
  {
    role: 'MEMBER',
    actions: [
      'workspace.read',
      'project.read',
    ],
  },
];

async function main() {
  console.log('🌱 Seeding role permissions...');
  console.log('   Note: OWNER permissions are implicit and not stored in database');
  console.log('');

  for (const { role, actions } of rolePermissions) {
    console.log(`   ${role}:`);
    for (const action of actions) {
      await prisma.rolePermission.upsert({
        where: { uk_role_action: { role: role as any, action } },
        update: {}, // No update needed, just ensure exists
        create: {
          role: role as any,
          action,
        },
      });
      console.log(`     ✓ ${action}`);
    }
    console.log('');
  }

  const counts = await prisma.rolePermission.groupBy({
    by: ['role'],
    _count: true,
  });

  console.log('📊 Seeded Permissions Summary:');
  counts.forEach(({ role, _count }) => {
    console.log(`  ${role}: ${_count} permissions`);
  });
  console.log(`  OWNER: implicit full access (not stored)`);
  console.log(`  Total stored: ${counts.reduce((sum, c) => sum + c._count, 0)} permissions`);

  console.log('\n✅ Role permissions seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
