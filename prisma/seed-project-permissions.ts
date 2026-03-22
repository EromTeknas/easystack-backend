/**
 * Seed script for ProjectRolePermission
 * Populates the ProjectRolePermission table with default role→permission mappings
 *
 * Usage: npx ts-node prisma/seed-project-permissions.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  ProjectRoleEnum,
  ProjectPermissionAction,
  ROLE_PERMISSION_MAP,
} from '../src/constants/projectRoles';

const prisma = new PrismaClient();

async function seedProjectPermissions() {
  console.log('Seeding ProjectRolePermission...');

  try {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSION_MAP)) {
      for (const action of permissions) {
        await prisma.projectRolePermission.upsert({
          where: {
            uk_project_role_action: {
              role: role as ProjectRoleEnum,
              action,
            },
          },
          create: {
            role: role as ProjectRoleEnum,
            action,
          },
          update: {},
        });
      }

      console.log(`✓ Seeded permissions for role: ${role}`);
    }

    const count = await prisma.projectRolePermission.count();
    console.log(`\n✅ ProjectRolePermission seeding complete. Total records: ${count}`);
  } catch (error) {
    console.error('❌ Failed to seed ProjectRolePermission:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedProjectPermissions();
