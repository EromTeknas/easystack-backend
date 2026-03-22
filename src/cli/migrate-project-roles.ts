/**
 * Migration: Populate ProjectMemberRole for existing ProjectMembers
 *
 * This script adds project roles to all existing project members based on their workspace role:
 * - OWNER workspace members get [EDITOR, PUBLISHER, RELEASE_MANAGER]
 * - ADMIN workspace members get [EDITOR, PUBLISHER]
 * - Regular project members get [VIEWER]
 *
 * Usage: npx ts-node src/cli/migrate-project-roles.ts
 */

import { prisma } from '../db/prisma';
import logger from '../utils/logger';
import { ProjectRoleEnum } from '../constants/projectRoles';

const PROJECT_ROLE_MAP: Record<string, ProjectRoleEnum[]> = {
  OWNER: [ProjectRoleEnum.EDITOR, ProjectRoleEnum.PUBLISHER, ProjectRoleEnum.RELEASE_MANAGER],
  ADMIN: [ProjectRoleEnum.EDITOR, ProjectRoleEnum.PUBLISHER],
  USER: [ProjectRoleEnum.VIEWER],
};

async function migrateProjectRoles() {
  try {
    logger.info('Starting ProjectMemberRole migration...');

    // Get all project members
    const projectMembers = await prisma.projectMember.findMany({
      select: {
        id: true,
        projectId: true,
        userId: true,
        workspaceId: true,
      },
    });

    logger.info(`Found ${projectMembers.length} project members to process`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const projectMember of projectMembers) {
      try {
        // Get the user's workspace role
        const workspaceMember = await prisma.workspaceMember.findUnique({
          where: {
            uk_workspace_user: {
              workspaceId: projectMember.workspaceId,
              userId: projectMember.userId,
            },
          },
          select: { role: true },
        });

        if (!workspaceMember) {
          logger.warn(
            `Workspace member not found for user ${projectMember.userId} in workspace ${projectMember.workspaceId}`
          );
          skippedCount++;
          continue;
        }

        // Determine project roles based on workspace role
        const rolesToAssign = PROJECT_ROLE_MAP[workspaceMember.role] || [ProjectRoleEnum.VIEWER];

        // Check if roles already exist
        const existingRoles = await prisma.projectMemberRole.findMany({
          where: { projectMemberId: projectMember.id },
          select: { role: true },
        });

        if (existingRoles.length > 0) {
          logger.info(
            `Project member ${projectMember.id} already has ${existingRoles.length} roles, skipping`
          );
          skippedCount++;
          continue;
        }

        // Assign roles
        for (const role of rolesToAssign) {
          await prisma.projectMemberRole.create({
            data: {
              projectMemberId: projectMember.id,
              role,
            },
          });
        }

        processedCount++;

        if (processedCount % 100 === 0) {
          logger.info(`Processed ${processedCount} project members...`);
        }
      } catch (error) {
        logger.error(`Failed to migrate project member ${projectMember.id}`, {
          error,
        });
        throw error;
      }
    }

    logger.info(
      `Migration complete. Processed: ${processedCount}, Skipped: ${skippedCount}/${projectMembers.length}`
    );
  } catch (error) {
    logger.error('ProjectMemberRole migration failed', { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateProjectRoles();
