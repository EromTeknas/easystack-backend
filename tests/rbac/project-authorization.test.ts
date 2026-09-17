import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';
import { authorize } from '../../src/services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../src/services/authorization/constants/permission.constants';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('Project Route Authorization Middleware', async (t) => {
  const inviter = await prisma.user.create({
    data: {
      email: `inviter-${Date.now()}@example.com`,
      firstName: 'Inviter',
      lastName: 'User',
      resourceId: `usr1_${Date.now()}`
    }
  });

  const guestUser = await prisma.user.create({
    data: {
      email: `guest-${Date.now()}@example.com`,
      firstName: 'Guest',
      lastName: 'User',
      resourceId: `usr2_${Date.now()}`
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Workspace`,
      slug: `ws-${Date.now()}`,
      createdById: inviter.id,
      resourceId: `ws_${Date.now()}`
    }
  });

  const project = await prisma.project.create({
    data: {
      name: 'Project',
      slug: `proj-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: inviter.id,
      resourceId: `proj_${Date.now()}`
    }
  });

  const memberRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_MEMBER' } });
  const guestRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_GUEST' } });
  const adminRole = await prisma.role.findUnique({ where: { key: 'PROJECT_ADMIN' } });
  const viewerRole = await prisma.role.findUnique({ where: { key: 'PROJECT_VIEWER' } });

  assert.ok(memberRole && guestRole && adminRole && viewerRole);

  // 1. Assign Inviter as WORKSPACE_MEMBER + PROJECT_ADMIN
  await prisma.workspaceMember.create({
    data: {
      userId: inviter.id,
      workspaceId: workspace.id,
      roleId: memberRole.id,
      projectMemberships: {
        create: {
          projectId: project.id,
          roleId: adminRole.id,
        }
      }
    }
  });

  // 2. Assign GuestUser as WORKSPACE_GUEST + PROJECT_VIEWER
  await prisma.workspaceMember.create({
    data: {
      userId: guestUser.id,
      workspaceId: workspace.id,
      roleId: guestRole.id,
      projectMemberships: {
        create: {
          projectId: project.id,
          roleId: viewerRole.id,
        }
      }
    }
  });

  // Helper to run middleware
  const runMiddleware = (userId: number, projectId: number, permission: string) => {
    return new Promise((resolve, reject) => {
      const req = {
        user: { id: userId },
        params: { projectId: projectId.toString() }
      } as any;
      const res = {} as any;
      const next = (err?: any) => {
        if (err) reject(err);
        else resolve(true);
      };

      const middleware = authorize({
        scope: 'project',
        permission,
        scopeId: (r) => r.params.projectId as string
      });

      middleware(req, res, next);
    });
  };

  // TEST 1: Inviter (Editor) has PROJECT.UPDATE
  await assert.doesNotReject(
    runMiddleware(inviter.id, project.id, PERMISSIONS.PROJECT.UPDATE),
    'Editor should be allowed to update project'
  );

  // TEST 2: Guest (Viewer) does NOT have PROJECT.UPDATE (must throw 403 ForbiddenError)
  await assert.rejects(
    runMiddleware(guestUser.id, project.id, PERMISSIONS.PROJECT.UPDATE),
    (err: any) => err.name === 'ForbiddenError' && err.message.includes('permission'),
    'Viewer should NOT be allowed to update project'
  );

  // TEST 3: Guest (Viewer) HAS PROJECT.READ
  await assert.doesNotReject(
    runMiddleware(guestUser.id, project.id, PERMISSIONS.PROJECT.READ),
    'Viewer should be allowed to read project'
  );

  // Clean up
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: inviter.id } });
  await prisma.user.delete({ where: { id: guestUser.id } });
});
