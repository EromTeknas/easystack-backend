import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';
import { ProjectService } from '../../src/services/project.service';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('Project Listing Effective Access', async (t) => {
  const admin = await prisma.user.create({
    data: {
      email: `admin-${Date.now()}@example.com`,
      firstName: 'Admin',
      lastName: 'User',
      resourceId: `usr_adm_${Date.now()}`
    }
  });

  const guest = await prisma.user.create({
    data: {
      email: `guest-${Date.now()}@example.com`,
      firstName: 'Guest',
      lastName: 'User',
      resourceId: `usr_gst_${Date.now()}`
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Workspace Effective`,
      slug: `ws-eff-${Date.now()}`,
      createdById: admin.id,
      resourceId: `ws_eff_${Date.now()}`
    }
  });

  // Project 1
  const project1 = await prisma.project.create({
    data: {
      name: 'Project 1',
      slug: `proj-1-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: admin.id,
      resourceId: `proj_1_${Date.now()}`
    }
  });

  // Project 2
  const project2 = await prisma.project.create({
    data: {
      name: 'Project 2',
      slug: `proj-2-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: admin.id,
      resourceId: `proj_2_${Date.now()}`
    }
  });

  const adminRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_ADMIN' } });
  const guestRole = await prisma.role.findUnique({ where: { key: 'WORKSPACE_GUEST' } });
  const viewerRole = await prisma.role.findUnique({ where: { key: 'PROJECT_VIEWER' } });

  assert.ok(adminRole && guestRole && viewerRole);

  // Assign Admin as WORKSPACE_ADMIN
  await prisma.workspaceMember.create({
    data: {
      userId: admin.id,
      workspaceId: workspace.id,
      roleId: adminRole.id,
    }
  });

  // Assign Guest as WORKSPACE_GUEST + PROJECT_VIEWER on Project 2 ONLY
  await prisma.workspaceMember.create({
    data: {
      userId: guest.id,
      workspaceId: workspace.id,
      roleId: guestRole.id,
      projectMemberships: {
        create: {
          projectId: project2.id,
          roleId: viewerRole.id,
        }
      }
    }
  });

  // Test 1: Admin should see BOTH projects (due to implicit WORKSPACE_ADMIN -> PROJECT.READ)
  const adminProjects = await ProjectService.listProjectsByWorkspace(workspace.id, admin.id);
  assert.equal(adminProjects.length, 2, 'Admin should see all 2 projects');
  const adminProjectIds = adminProjects.map(p => p.id);
  assert.ok(adminProjectIds.includes(project1.id));
  assert.ok(adminProjectIds.includes(project2.id));

  // Test 2: Guest should ONLY see Project 2 (explicitly assigned)
  const guestProjects = await ProjectService.listProjectsByWorkspace(workspace.id, guest.id);
  assert.equal(guestProjects.length, 1, 'Guest should only see 1 project');
  assert.equal(guestProjects[0].id, project2.id, 'Guest should only see Project 2');

  // Clean up
  await prisma.projectMember.deleteMany({ where: { workspaceMember: { workspaceId: workspace.id } } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.project.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: admin.id } });
  await prisma.user.delete({ where: { id: guest.id } });
});
