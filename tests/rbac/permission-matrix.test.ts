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
      assert.ok(hasPermission(owner.permissions, 'schema:delete'));
      assert.ok(hasPermission(owner.permissions, 'content:delete'));
    });

    test('PROJECT_ADMIN has all manage capabilities but not project deletion', () => {
      assert.ok(hasPermission(admin.permissions, 'project:read'));
      assert.ok(hasPermission(admin.permissions, 'project:update'));
      assert.ok(hasPermission(admin.permissions, 'schema:delete'));
      assert.ok(hasPermission(admin.permissions, 'content:delete'));
      assert.ok(hasPermission(admin.permissions, 'project_member:invite'));
      assert.strictEqual(hasPermission(admin.permissions, 'project:delete'), false);
    });

    test('PROJECT_EDITOR can manage content and schemas but not members', () => {
      assert.ok(hasPermission(editor.permissions, 'project:read'));
      assert.ok(hasPermission(editor.permissions, 'schema:create'));
      assert.ok(hasPermission(editor.permissions, 'schema:update'));
      assert.ok(hasPermission(editor.permissions, 'content:create'));
      assert.ok(hasPermission(editor.permissions, 'content:update'));
      assert.ok(hasPermission(editor.permissions, 'content:delete'));
      assert.strictEqual(hasPermission(editor.permissions, 'schema:delete'), false);
      assert.strictEqual(hasPermission(editor.permissions, 'project_member:invite'), false);
    });

    test('PROJECT_CONTRIBUTOR can contribute content but not create schemas', () => {
      assert.ok(hasPermission(contributor.permissions, 'project:read'));
      assert.ok(hasPermission(contributor.permissions, 'content:read'));
      assert.ok(hasPermission(contributor.permissions, 'content:create'));
      assert.ok(hasPermission(contributor.permissions, 'content:update'));
      assert.strictEqual(hasPermission(contributor.permissions, 'schema:create'), false);
      assert.strictEqual(hasPermission(contributor.permissions, 'schema:update'), false);
    });

    test('PROJECT_VIEWER is read-only', () => {
      assert.ok(hasPermission(viewer.permissions, 'project:read'));
      assert.ok(hasPermission(viewer.permissions, 'schema:read'));
      assert.ok(hasPermission(viewer.permissions, 'content:read'));
      assert.strictEqual(hasPermission(viewer.permissions, 'content:update'), false);
    });

    test('PROJECT_CLIENT_EDITOR has content CRUD and localization but no developer permissions', () => {
      const clientEditor = ProjectRoles.PROJECT_CLIENT_EDITOR;
      assert.ok(hasPermission(clientEditor.permissions, 'project:read'));
      assert.ok(hasPermission(clientEditor.permissions, 'content:read'));
      assert.ok(hasPermission(clientEditor.permissions, 'content:create'));
      assert.ok(hasPermission(clientEditor.permissions, 'content:update'));
      assert.ok(hasPermission(clientEditor.permissions, 'content:delete'));
      assert.ok(hasPermission(clientEditor.permissions, 'localization:read'));
      assert.ok(hasPermission(clientEditor.permissions, 'localization:create'));
      assert.ok(hasPermission(clientEditor.permissions, 'asset:create'));

      // Technical concepts must be strictly forbidden
      assert.strictEqual(hasPermission(clientEditor.permissions, 'schema:create'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'schema:update'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'schema:delete'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'release:create'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'release:execute'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'api_key:read'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'api_key:create'), false);
      assert.strictEqual(hasPermission(clientEditor.permissions, 'environment:update'), false);
    });

    test('PROJECT_CLIENT_AUTHOR has draft editing but cannot delete or manage technical concepts', () => {
      const clientAuthor = ProjectRoles.PROJECT_CLIENT_AUTHOR;
      assert.ok(hasPermission(clientAuthor.permissions, 'content:read'));
      assert.ok(hasPermission(clientAuthor.permissions, 'content:create'));
      assert.ok(hasPermission(clientAuthor.permissions, 'content:update'));
      assert.strictEqual(hasPermission(clientAuthor.permissions, 'content:delete'), false);
      assert.strictEqual(hasPermission(clientAuthor.permissions, 'schema:create'), false);
      assert.strictEqual(hasPermission(clientAuthor.permissions, 'release:create'), false);
    });

    test('PROJECT_CLIENT_VIEWER is strictly read-only for content and media', () => {
      const clientViewer = ProjectRoles.PROJECT_CLIENT_VIEWER;
      assert.ok(hasPermission(clientViewer.permissions, 'content:read'));
      assert.strictEqual(hasPermission(clientViewer.permissions, 'content:create'), false);
      assert.strictEqual(hasPermission(clientViewer.permissions, 'content:update'), false);
      assert.strictEqual(hasPermission(clientViewer.permissions, 'schema:create'), false);
    });
  });
});

