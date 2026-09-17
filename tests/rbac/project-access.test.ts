import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';
import { AuthorizationBuilder } from '../../src/services/authorization/services/buid-cache.service';
import { AuthorizationRepository } from '../../src/services/authorization/repositories/authorization.repository';
import { UserInviteService } from '../../src/services/user/user-invite.service';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('Workspace vs Project Memberships', async (t) => {
  // We need to test the logic we just fixed in UserInviteService.
  // We will create a test user, workspace, and an existing workspace member.
  
  const testUser = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      resourceId: `usr_${Date.now()}`
    }
  });

  const inviter = await prisma.user.create({
    data: {
      email: `inviter-${Date.now()}@example.com`,
      firstName: 'Inviter',
      lastName: 'User',
      resourceId: `usr2_${Date.now()}`
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Test Workspace ${Date.now()}`,
      slug: `test-workspace-${Date.now()}`,
      createdById: inviter.id,
      resourceId: `ws_${Date.now()}`
    }
  });

  const memberRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_MEMBER' } });
  const guestRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_GUEST' } });
  const editorRole = await prisma.role.findUnique({ where: { key: 'PROJECT_EDITOR' } });

  assert.ok(memberRole);
  assert.ok(guestRole);
  assert.ok(editorRole);

  // 1. Assign testUser as WORKSPACE_MEMBER
  const workspaceMember = await prisma.workspaceMember.create({
    data: {
      userId: testUser.id,
      workspaceId: workspace.id,
      roleId: memberRole.id,
    }
  });

  // 2. Create a project
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      slug: `test-project-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: inviter.id,
      resourceId: `proj_${Date.now()}`
    }
  });

  // 3. Create an invitation to the project (as a Guest at the workspace level, Editor at project level)
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: workspace.id,
      inviterId: inviter.id,
      inviteeEmail: testUser.email,
      inviteeId: testUser.id,
      workspaceRoleId: guestRole.id,
      status: 'PENDING',
      token: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 86400000),
      projectAssignments: {
        create: [
          {
            projectId: project.id,
            roleId: editorRole.id,
          }
        ]
      }
    }
  });

  // 4. Accept the invitation
  await UserInviteService.respondToInvite(testUser.id, testUser.email, invitation.id, 'ACCEPT');

  // 5. Verify the workspace role was NOT overwritten to GUEST
  const updatedWorkspaceMember = await prisma.workspaceMember.findUnique({
    where: { id: workspaceMember.id }
  });

  assert.strictEqual(updatedWorkspaceMember?.roleId, memberRole.id, 'Workspace role should remain WORKSPACE_MEMBER, not overwritten to GUEST');

  // 6. Verify ProjectMember was created
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_workspaceMemberId: {
        projectId: project.id,
        workspaceMemberId: workspaceMember.id,
      }
    }
  });

  assert.ok(projectMember, 'Project member should be created');
  assert.strictEqual(projectMember.roleId, editorRole.id, 'Project role should be PROJECT_EDITOR');

  // Clean up
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.user.delete({ where: { id: inviter.id } });
});
