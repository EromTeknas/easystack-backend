import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizationBuilder } from '../../src/services/authorization/services/buid-cache.service';
import { AuthorizationRepository } from '../../src/services/authorization/repositories/authorization.repository';
import { AuthorizationAssignment } from '../../src/services/authorization/repositories/authorization.repository';
import { after } from 'node:test';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

// Mock Repository
class MockAuthorizationRepository extends AuthorizationRepository {
  public assignments: AuthorizationAssignment[] = [];
  
  async getAssignments(userId: number): Promise<AuthorizationAssignment[]> {
    return this.assignments;
  }
}

test('AuthorizationBuilder calculates and merges effective permissions correctly', async () => {
  const repo = new MockAuthorizationRepository();
  const builder = new AuthorizationBuilder(repo);

  // Scenario 1: User has explicit VIEWER, but gets implicit ADMIN via workspace inheritance
  repo.assignments = [
    {
      scope: 'workspace',
      scopeId: 'workspace-1',
      roles: ['WORKSPACE_ADMIN'],
      permissions: ['workspace:read', 'workspace:update'],
      customPermissions: [],
      deniedPermissions: [],
    },
    {
      scope: 'project',
      scopeId: 'project-1',
      roles: ['PROJECT_VIEWER'], // Explicit assignment
      permissions: ['project:read'],
      customPermissions: [],
      deniedPermissions: [],
    },
    {
      scope: 'project',
      scopeId: 'project-1',
      roles: ['PROJECT_ADMIN'], // Implicit inheritance pushes this assignment
      permissions: ['project:read', 'project:update', 'project:delete'],
      customPermissions: [],
      deniedPermissions: [],
    },
    {
      scope: 'project',
      scopeId: 'project-2',
      roles: ['PROJECT_ADMIN'], // Implicit inheritance pushes this assignment
      permissions: ['project:read', 'project:update', 'project:delete'],
      customPermissions: [],
      deniedPermissions: [],
    }
  ];

  const cache = await builder.build('1');

  // Verify Workspace Access
  assert.ok(cache.authorization.workspace['workspace-1']);
  assert.ok(cache.authorization.workspace['workspace-1'].permissions.includes('workspace:update'));

  // Verify Project 1 Access (Merged Viewer and Admin)
  const proj1 = cache.authorization.project['project-1'];
  assert.ok(proj1);
  assert.ok(proj1.roles.includes('PROJECT_VIEWER'));
  assert.ok(proj1.roles.includes('PROJECT_ADMIN'));
  assert.ok(proj1.permissions.includes('project:read'));
  assert.ok(proj1.permissions.includes('project:update'));
  assert.ok(proj1.permissions.includes('project:delete'));

  // Verify Project 2 Access (Implicit Admin only)
  const proj2 = cache.authorization.project['project-2'];
  assert.ok(proj2);
  assert.ok(proj2.roles.includes('PROJECT_ADMIN'));
  assert.ok(!proj2.roles.includes('PROJECT_VIEWER'));
  assert.ok(proj2.permissions.includes('project:delete'));
});
