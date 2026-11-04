# Testing & Quality Assurance Reference

## 1. Test Architecture & Runner

EasyStack utilizes the native Node.js test runner (`node:test`) paired with `ts-node/register` for direct TypeScript test execution.

### Running Tests
Defined in [`package.json`](file:///home/eteknas/Projects/easystack-backend/package.json):

```bash
# Run all test suites
npm run test:billing

# Run a specific test suite
node -r ts-node/register --test tests/rbac/permission-matrix.test.ts

# Run tests with regex name filtering
node -r ts-node/register --test tests/rbac/*.test.ts --test-name-pattern="implicit"
```

---

## 2. Test Suite Directory

The test directory ([`tests/`](file:///home/eteknas/Projects/easystack-backend/tests)) covers security, RBAC invariants, billing validation, and content modeling:

```text
tests/
├── rbac/                               # RBAC & Security Test Suite
│   ├── permission-matrix.test.ts       # Validates that roles have all required permission grants
│   ├── project-access.test.ts          # Checks direct vs implicit project access
│   ├── project-authorization.test.ts   # Tests can() checks across project scopes
│   ├── project-listing.test.ts         # Tests getScopeIdsWithPermission() query filters
│   ├── role-assignment.test.ts         # Tests role update mutation and cache eviction
│   ├── storage-authorization.test.ts   # Tests storage upload and delete permission guards
│   ├── workspace-access.test.ts        # Tests workspace-level role permissions
│   └── nested-resource-idor.test.ts    # Tests cross-tenant IDOR attack vectors
│
├── billing.payment.test.ts             # Stripe webhook payload and signature parsing
├── billing.validators.test.ts          # Plan limits, quota checks, and usage decrement tests
├── feed-schema-validation.test.ts      # Strict JSON structural, depth, and homogeneity tests
├── schema-blueprint.test.ts            # Blueprint field definition tests
└── content-entry.test.ts               # Content entry drafting, publishing, and revision tests
```

---

## 3. RBAC Test Conventions

When testing permissions, verify both positive and negative authorization cases:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizationService } from '../../src/services/authorization/services/authorization.service';
import { PERMISSIONS } from '../../src/services/authorization/constants/permission.constants';

describe('Project Access Invariants', () => {
  test('WORKSPACE_ADMIN implicitly inherits PROJECT_ADMIN permissions', async () => {
    const adminUserId = '10';
    const projectId = '101';

    const canRead = await AuthorizationService.can(
      adminUserId,
      PERMISSIONS.PROJECT.READ,
      'project',
      projectId
    );

    assert.equal(canRead, true);
  });

  test('Regular MEMBER cannot access projects without explicit assignment', async () => {
    const regularUserId = '20';
    const unassignedProjectId = '999';

    const canRead = await AuthorizationService.can(
      regularUserId,
      PERMISSIONS.PROJECT.READ,
      'project',
      unassignedProjectId
    );

    assert.equal(canRead, false);
  });
});
```

---

## 4. Key Invariants to Test on New Features

Whenever modifying or adding routes:
1. **Unauthenticated Access**: Verify route returns `401 Unauthorized` when no token or cookie is supplied.
2. **Unauthorized Scope**: Verify route returns `403 Forbidden` when user belongs to workspace but lacks required permission.
3. **Cross-Tenant Isolation (IDOR)**: Verify that user in Workspace A cannot access resources in Workspace B even with a valid ID.
4. **Soft-Delete Filtering**: Verify that querying removed entities returns `404 Not Found`.
