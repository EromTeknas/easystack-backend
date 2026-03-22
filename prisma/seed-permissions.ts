/**
 * Seed script: Initialize role permissions
 * Run: npx prisma db seed
 * Or: ts-node prisma/seed-permissions.ts
 */

import { PrismaClient, WorkspaceMember_role } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Array<{ role: WorkspaceMember_role; action: string }> = [
  // OWNER permissions (documented for reference; OWNER has implicit full access)
  { role: 'OWNER', action: 'workspace.update.name' },
  { role: 'OWNER', action: 'workspace.update.logo' },
  { role: 'OWNER', action: 'workspace.delete' },
  { role: 'OWNER', action: 'workspace.members.add' },
  { role: 'OWNER', action: 'workspace.members.remove' },
  { role: 'OWNER', action: 'workspace.members.assign_role' },
  { role: 'OWNER', action: 'project.create' },
  { role: 'OWNER', action: 'project.update.name' },
  { role: 'OWNER', action: 'project.delete' },
  { role: 'OWNER', action: 'project.members.add' },
  { role: 'OWNER', action: 'project.members.remove' },

  // ADMIN permissions (high access, limited by role)
  { role: 'ADMIN', action: 'workspace.update.name' },
  { role: 'ADMIN', action: 'workspace.update.logo' },
  { role: 'ADMIN', action: 'workspace.members.add' },
  { role: 'ADMIN', action: 'workspace.members.remove' },
  { role: 'ADMIN', action: 'project.create' },
  { role: 'ADMIN', action: 'project.update.name' },
  { role: 'ADMIN', action: 'project.delete' },
  { role: 'ADMIN', action: 'project.members.add' },
  { role: 'ADMIN', action: 'project.members.remove' },

  // MEMBER permissions (limited, project-scoped)
  { role: 'USER', action: 'project.update.name' },
];

async function seedPermissions() {
  console.log('🌱 Seeding role permissions...');

  for (const permission of ROLE_PERMISSIONS) {
    const existing = await prisma.rolePermission.findUnique({
      where: {
        uk_role_action: {
          role: permission.role as WorkspaceMember_role,
          action: permission.action,
        },
      },
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          role: permission.role as WorkspaceMember_role,
          action: permission.action,
        },
      });
      console.log(`  ✓ Created ${permission.role} → ${permission.action}`);
    }
  }

  console.log('✨ Role permissions seeded successfully');
}

async function main() {
  try {
    await seedPermissions();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
