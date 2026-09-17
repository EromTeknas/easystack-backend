import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';
import { WorkspaceInviteService } from '../../src/services/workspace/workspace-invite.service';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('Role Assignment and Invitation Security', async (t) => {
  const inviter = await prisma.user.create({
    data: {
      email: `inviter-${Date.now()}@example.com`,
      firstName: 'Inviter',
      lastName: 'User',
      resourceId: `usr1_${Date.now()}`
    }
  });

  const workspace1 = await prisma.workspace.create({
    data: {
      name: `Workspace 1`,
      slug: `ws1-${Date.now()}`,
      createdById: inviter.id,
      resourceId: `ws1_${Date.now()}`
    }
  });

  const workspace2 = await prisma.workspace.create({
    data: {
      name: `Workspace 2`,
      slug: `ws2-${Date.now()}`,
      createdById: inviter.id,
      resourceId: `ws2_${Date.now()}`
    }
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Project in WS2',
      slug: `proj2-${Date.now()}`,
      workspaceId: workspace2.id,
      createdById: inviter.id,
      resourceId: `proj2_${Date.now()}`
    }
  });

  const guestRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_GUEST' } });
  const editorRole = await prisma.role.findUnique({ where: { key: 'PROJECT_EDITOR' } });
  const ownerRole = await prisma.role.findUnique({ where: { key: 'PROJECT_OWNER' } });

  assert.ok(guestRole);
  assert.ok(editorRole);
  assert.ok(ownerRole);

  // 1. Test cross-workspace project IDs in invitations (must throw)
  await assert.rejects(
    WorkspaceInviteService.sendInvite(workspace1.id, inviter.id, 'Inviter', {
      email: `victim-${Date.now()}@example.com`,
      workspaceRoleId: guestRole.id,
      projectAssignments: [{ projectId: project2.id, roleId: editorRole.id }]
    }),
    (err: any) => err.message === 'One or more assigned projects do not belong to this workspace'
  );

  // 2. Test assigning PROJECT_OWNER via invite (must throw)
  await assert.rejects(
    WorkspaceInviteService.sendInvite(workspace2.id, inviter.id, 'Inviter', {
      email: `victim2-${Date.now()}@example.com`,
      workspaceRoleId: guestRole.id,
      projectAssignments: [{ projectId: project2.id, roleId: ownerRole.id }]
    }),
    (err: any) => err.message === 'PROJECT_OWNER cannot be assigned via invitation'
  );

  // Clean up
  await prisma.project.delete({ where: { id: project2.id } });
  await prisma.workspace.delete({ where: { id: workspace1.id } });
  await prisma.workspace.delete({ where: { id: workspace2.id } });
  await prisma.user.delete({ where: { id: inviter.id } });
});
