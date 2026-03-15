# Database Transactions Guide

This guide explains how to implement ACID-compliant transactions in EasyStack Backend using Prisma.

## Overview

Transactions ensure data consistency by making multiple database operations atomic. If any operation fails, all changes are automatically rolled back to the original state.

## When to Use Transactions

Use transactions when:
- Multiple database operations must succeed together or fail together
- Creating related records that depend on each other (e.g., workspace + member + subscription)
- Updating multiple tables where consistency is critical
- Financial/billing operations
- Any multi-step process where partial completion would leave data in an inconsistent state

## Prisma Transaction Patterns

### Pattern 1: Interactive Transactions (Recommended)

Interactive transactions allow you to execute multiple operations and include conditional logic.

```typescript
async function createWorkspaceWithSetup(
  userId: number,
  workspaceName: string
): Promise<{ workspaceId: number; memberId: number }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          createdBy: userId,
        },
      });

      // Step 2: Add user as owner
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
          isDefault: true,
        },
      });

      // Step 3: Assign free plan
      const freePlan = await tx.plans.findFirst({
        where: { name: 'free' },
      });

      if (freePlan) {
        await tx.subscriptions.create({
          data: {
            userId,
            planId: freePlan.id,
            status: 'ACTIVE',
          },
        });
      }

      return {
        workspaceId: workspace.id,
        memberId: member.id,
      };
    });

    return result;
  } catch (error) {
    logger.error('Transaction failed, all changes rolled back:', error);
    throw error;
  }
}
```

**Key Points:**
- Use `prisma.$transaction(async (tx) => {...})`
- `tx` is the transaction client - use it instead of `prisma`
- All operations inside the callback are atomic
- Return the final result
- If any operation throws, all changes are automatically rolled back

### Pattern 2: Sequential Transactions

For simple cases with no conditional logic, you can pass an array of operations:

```typescript
const [user, workspace, member] = await prisma.$transaction([
  prisma.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE' },
  }),
  prisma.workspace.create({
    data: {
      name: 'My Workspace',
      createdBy: userId,
    },
  }),
  prisma.workspaceMember.create({
    where: { id: memberId },
    data: { role: 'OWNER' },
  }),
]);
```

**Limitations:**
- No conditional logic
- No dependency between operations (queries must not reference previous results)
- Use interactive transactions for complex scenarios

## Common Patterns in EasyStack

### 1. User Onboarding Transaction

```typescript
export async function completeUserOnboarding(
  userId: number,
  workspaceName: string
) {
  return await prisma.$transaction(async (tx) => {
    // Mark user as onboarding complete
    const user = await tx.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });

    // Create default workspace
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        createdBy: userId,
      },
    });

    // Add user as owner
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
        isDefault: true,
      },
    });

    // Assign free plan
    const freePlan = await tx.plans.findFirst({
      where: { name: 'free' },
    });

    if (freePlan) {
      await tx.subscriptions.create({
        data: {
          userId,
          planId: freePlan.id,
          status: 'TRIAL',
        },
      });
    }

    return { userId, workspaceId: workspace.id };
  });
}
```

### 2. Bulk Operations Transaction

```typescript
export async function assignPlansToUsers(userIds: number[], planId: number) {
  return await prisma.$transaction(async (tx) => {
    const results = [];

    for (const userId of userIds) {
      // Check if user already has subscription
      const existingSubscription = await tx.subscriptions.findUnique({
        where: { userId },
      });

      if (!existingSubscription) {
        const subscription = await tx.subscriptions.create({
          data: {
            userId,
            planId,
            status: 'ACTIVE',
          },
        });
        results.push(subscription);
      }
    }

    logger.info(`Plans assigned to ${results.length} users in transaction`);
    return results;
  });
}
```

### 3. Update with Validation Transaction

```typescript
export async function updateProjectWithValidation(
  projectId: number,
  workspaceId: number,
  data: { name?: string; subdomain?: string }
) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Verify project exists and belongs to workspace
    const project = await tx.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.workspaceId !== workspaceId) {
      throw new Error('Project not found or access denied');
    }

    // Step 2: If subdomain is changing, verify it's available
    if (data.subdomain && data.subdomain !== project.subdomain) {
      const existingProject = await tx.project.findUnique({
        where: { subdomain: data.subdomain },
      });

      if (existingProject) {
        throw new Error('Subdomain already taken');
      }
    }

    // Step 3: Update project
    const updated = await tx.project.update({
      where: { id: projectId },
      data,
    });

    logger.info('Project updated with validation in transaction', {
      projectId,
      workspaceId,
    });

    return updated;
  });
}
```

## Error Handling

### Catching Transaction Errors

```typescript
async function operationWithErrorHandling(input: any) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // ... operations
      return result;
    });
    return result;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Transaction failed:', {
        message: error.message,
        code: (error as any).code,
      });

      // Handle specific Prisma errors
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('Record not found');
      }
      if ((error as any).code === 'P2002') {
        throw new BadRequestError('Unique constraint violated');
      }
    }
    throw error; // Re-throw for asyncHandler
  }
}
```

### Transaction Timeout

By default, Prisma transactions timeout after 5 seconds. For longer operations, configure timeout:

```typescript
const result = await prisma.$transaction(
  async (tx) => {
    // ... operations
    return result;
  },
  {
    timeout: 10000, // 10 seconds (milliseconds)
  }
);
```

## Best Practices

### ✅ DO

- **Keep transactions short**: Minimize the duration to reduce lock contention
- **Use transactions for related operations**: Group logically related database changes
- **Place validation before transaction**: Check input validity before entering transaction
- **Log transaction steps**: Log key milestones for debugging
- **Use descriptive error messages**: Include context about which step failed
- **Return meaningful results**: Return the IDs or objects created/modified

### ❌ DON'T

- **Include external API calls**: Don't call external services inside transactions (network delays increase lock time)
- **Use transactions for reads only**: Transactions are for write operations; use queries for reads
- **Nest transactions**: Don't call `$transaction` inside another `$transaction`
- **Long-running operations**: Transaction locks should be held as briefly as possible
- **Catch and ignore errors silently**: Always log or re-throw errors

## Example: Complete User Signup Flow

```typescript
export async function completeUserSignup(
  userId: number,
  userData: {
    firstName: string;
    lastName: string;
    workspaceName: string;
  }
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Update user profile
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          status: 'ACTIVE',
          emailVerified: true,
          onboardingCompleted: true,
        },
      });

      logger.info('User profile updated in transaction', { userId });

      // Step 2: Create default workspace
      const workspace = await tx.workspace.create({
        data: {
          name: userData.workspaceName,
          createdBy: userId,
        },
      });

      logger.info('Workspace created in transaction', {
        workspaceId: workspace.id,
      });

      // Step 3: Add user as workspace owner
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
          isDefault: true,
        },
      });

      logger.info('User added as workspace owner in transaction', {
        workspaceId: workspace.id,
        memberId: member.id,
      });

      // Step 4: Assign free plan
      const freePlan = await tx.plans.findFirst({
        where: { name: 'free' },
      });

      if (!freePlan) {
        throw new Error('Free plan not found');
      }

      const subscription = await tx.subscriptions.create({
        data: {
          userId,
          planId: freePlan.id,
          status: 'ACTIVE',
        },
      });

      logger.info('Free plan assigned in transaction', {
        userId,
        planId: freePlan.id,
      });

      return {
        userId: user.id,
        workspaceId: workspace.id,
        memberId: member.id,
        subscriptionId: subscription.id,
      };
    });

    logger.info('User signup completed successfully', {
      userId,
      workspaceId: result.workspaceId,
    });

    return result;
  } catch (error) {
    logger.error('User signup failed - transaction rolled back:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error; // Let asyncHandler catch it
  }
}
```

## Testing Transactions

### Unit Test Example

```typescript
describe('Transaction Operations', () => {
  it('should rollback all changes if any step fails', async () => {
    // Setup: Ensure free plan exists
    await prisma.plans.create({
      data: {
        name: 'test-free',
        displayName: 'Test Free',
        config: {},
      },
    });

    const userId = 123;

    // Attempt operation that will fail
    await expect(
      completeUserOnboarding(userId, 'Test Workspace')
    ).rejects.toThrow();

    // Verify: No orphaned records created
    const workspace = await prisma.workspace.findFirst({
      where: { createdBy: userId },
    });
    expect(workspace).toBeNull();

    const member = await prisma.workspaceMember.findFirst({
      where: { userId },
    });
    expect(member).toBeNull();
  });

  it('should create all records successfully in transaction', async () => {
    const result = await completeUserOnboarding(456, 'Successful Workspace');

    expect(result.userId).toBe(456);
    expect(result.workspaceId).toBeDefined();
    expect(result.memberId).toBeDefined();

    // Verify all records exist
    const workspace = await prisma.workspace.findUnique({
      where: { id: result.workspaceId },
    });
    expect(workspace).toBeDefined();
  });
});
```

## Performance Considerations

- Transactions acquire database locks: Keep them short
- Rollback is fast but still has overhead: Don't use transactions unnecessarily
- For high-concurrency scenarios, consider connection pooling configuration
- Monitor transaction duration with logs
- Use database monitoring tools to identify slow transactions

## Implementation Status (v1 - Complete)

All critical multi-step operations now use transactional patterns:

### Authentication & Auth Tokens
- ✅ **verify-email.controller.ts**: Atomic verification → workspace creation → refresh token storage
- ✅ **register.controller.ts**: Atomic user creation/update → plan assignment
- ✅ **reset-password.controller.ts**: Atomic password update → revoke all refresh tokens
- ✅ **login.controller.ts**: Atomic refresh token storage → last login update
- ✅ **auth-tokens.service.ts** (rotateRefreshToken): Atomic old token revocation → new token creation

### Workspace Management
- ✅ **workspace.controller.ts** (createWorkspaceController): Uses transactional createWorkspaceWithSetup service
- ✅ **workspace.service.ts** (createWorkspaceWithSetup): Atomic workspace creation → membership → plan assignment

### Project Management
- ✅ **projects.controller.ts**: All CRUD operations already use ProjectService
- ✅ **project.service.ts** (createProjectWithValidation): Atomic validation → creation

### Billing
- ✅ **billing.service.ts** (updatePlan): Atomic version history creation → plan config update

### Non-Transactional Operations (By Design)
- ✅ **onboarding.controller.ts**: Single-operation updates (no transaction benefit)
- ✅ **billing.controller.ts**: Read-only operations
- ✅ **admin/plans.controller.ts**: CRUD operations (no multi-step coordination)

### External I/O Placement
All external side-effects are intentionally placed OUTSIDE transactions to prevent lock contention:
- Email queue jobs (BullMQ)
- Third-party API calls
- Cache invalidations
- Logging (within transaction for audit)

## References

- [Prisma Transactions Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [ACID Properties](https://en.wikipedia.org/wiki/ACID)
- [Database Lock Management](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)
