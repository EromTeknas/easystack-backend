import { test, describe } from 'node:test';
import assert from 'node:assert';
import { WorkspaceRoles } from '../../src/services/authorization/configs/workspace-roles.config';
import { ProjectRoles } from '../../src/services/authorization/configs/project-roles.config';

function hasPermission(rolePermissions: string[], permission: string): boolean {
  return rolePermissions.includes(permission);
}

describe('RBAC Permission Matrix', () => {
  describe('Workspace Roles', () => {
    const owner = WorkspaceRoles.WORKSPACE_OWNER;
    const admin = WorkspaceRoles.WORKSPACE_ADMIN;
    const member = WorkspaceRoles.WORKSPACE_MEMBER;
    const viewer = WorkspaceRoles.WORKSPACE_VIEWER;
    const guest = WorkspaceRoles.WORKSPACE_GUEST;

    test('WORKSPACE_OWNER has all workspace and project permissions', () => {
      assert.ok(hasPermission(owner.permissions, 'workspace:read'));
      assert.ok(hasPermission(owner.permissions, 'workspace:update'));
      assert.ok(hasPermission(owner.permissions, 'workspace:delete'));
      assert.ok(hasPermission(owner.permissions, 'workspace:invite'));
      assert.ok(hasPermission(owner.permissions, 'workspace:manage_members'));
      assert.ok(hasPermission(owner.permissions, 'project:delete')); // Implicit project access
    });

    test('WORKSPACE_ADMIN has manage capabilities but not delete', () => {
      assert.ok(hasPermission(admin.permissions, 'workspace:read'));
      assert.ok(hasPermission(admin.permissions, 'workspace:update'));
      assert.ok(hasPermission(admin.permissions, 'workspace:invite'));
      assert.ok(hasPermission(admin.permissions, 'workspace:manage_members'));
      assert.strictEqual(hasPermission(admin.permissions, 'workspace:delete'), false);
    });

    test('WORKSPACE_MEMBER has basic read and project creation', () => {
      assert.ok(hasPermission(member.permissions, 'workspace:read'));
      assert.ok(hasPermission(member.permissions, 'project:create'));
      assert.strictEqual(hasPermission(member.permissions, 'workspace:update'), false);
    });

    test('WORKSPACE_VIEWER & GUEST have minimal read only', () => {
      assert.ok(hasPermission(viewer.permissions, 'workspace:read'));
      assert.strictEqual(hasPermission(viewer.permissions, 'project:create'), false);
      assert.ok(hasPermission(guest.permissions, 'workspace:read'));
      assert.strictEqual(hasPermission(guest.permissions, 'project:create'), false);
    });
  });

  describe('Project Roles', () => {
    const owner = ProjectRoles.PROJECT_OWNER;
    const admin = ProjectRoles.PROJECT_ADMIN;
    const editor = ProjectRoles.PROJECT_EDITOR;
    const contributor = ProjectRoles.PROJECT_CONTRIBUTOR;
    const viewer = ProjectRoles.PROJECT_VIEWER;

    test('PROJECT_OWNER has all permissions including deletion', () => {
      assert.ok(hasPermission(owner.permissions, 'project:read'));
      assert.ok(hasPermission(owner.permissions, 'project:update'));
      assert.ok(hasPermission(owner.permissions, 'project:delete'));
      assert.ok(hasPermission(owner.permissions, 'feed:delete'));
    });

    test('PROJECT_ADMIN has all manage capabilities but not project deletion', () => {
      assert.ok(hasPermission(admin.permissions, 'project:read'));
      assert.ok(hasPermission(admin.permissions, 'project:update'));
      assert.ok(hasPermission(admin.permissions, 'feed:delete'));
      assert.ok(hasPermission(admin.permissions, 'project_member:invite'));
      assert.strictEqual(hasPermission(admin.permissions, 'project:delete'), false);
    });

    test('PROJECT_EDITOR can manage content but not members', () => {
      assert.ok(hasPermission(editor.permissions, 'project:read'));
      assert.ok(hasPermission(editor.permissions, 'feed:create'));
      assert.ok(hasPermission(editor.permissions, 'feed:update'));
      assert.strictEqual(hasPermission(editor.permissions, 'feed:delete'), false);
      assert.strictEqual(hasPermission(editor.permissions, 'project_member:invite'), false);
    });

    test('PROJECT_CONTRIBUTOR can update content but not create feeds', () => {
      assert.ok(hasPermission(contributor.permissions, 'project:read'));
      assert.ok(hasPermission(contributor.permissions, 'localization:update'));
      assert.strictEqual(hasPermission(contributor.permissions, 'feed:create'), false);
      assert.strictEqual(hasPermission(contributor.permissions, 'feed:update'), false);
    });

    test('PROJECT_VIEWER is read-only', () => {
      assert.ok(hasPermission(viewer.permissions, 'project:read'));
      assert.ok(hasPermission(viewer.permissions, 'feed:read'));
      assert.strictEqual(hasPermission(viewer.permissions, 'localization:update'), false);
    });
  });
});
