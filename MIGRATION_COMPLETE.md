# Migration & Setup Summary

Successfully created and applied authorization schema refinements. This document provides quick reference for common database operations and explains what was changed.

---

## What Was Changed

The migration `20260316142205_refine_authorization_schema` added:

### New Tables
- **WorkspaceMemberPermission** - Per-member permission overrides (allow/deny specific actions)
- **RolePermission** - Default permissions for roles (OWNER, ADMIN, MEMBER, etc.)
- **ProjectMember** - Project membership tracking with assignment history

### New Fields in WorkspaceMember
- `role_changed_at` - When the member's role was last changed
- `role_changed_by_user_id` - Who changed the member's role
- `removed_at` - When the member was removed from workspace
- `removed_by_user_id` - Who removed the member

### New Indexes for Performance
- `idx_workspace_role` on (workspace_id, role)
- `idx_workspace_user` on (workspace_id, user_id)
- Action indexes on WorkspaceMemberPermission and RolePermission tables

### Relationships
- WorkspaceMember now tracks role changes and removals with full audit trail
- ProjectMember tracks project assignments and removals
- Composite foreign key on ProjectMember references WorkspaceMember for consistency

---

## New npm Scripts

Four new scripts were added to `package.json` for database operations:

```bash
# Reset database to clean state (⚠️ DEVELOPMENT ONLY - deletes all data)
npm run prisma:reset

# Apply pending migrations (for CI/CD deployment)
npm run prisma:deploy

# Check current migration status
npm run prisma:status

# Run migrations interactively (development)
npm run prisma:migrate
```

---

## Step-by-Step Commands for Common Tasks

### Initial Setup (First Time)

```bash
# 1. Install dependencies
npm install

# 2. Configure .env with database URLs
#    DATABASE_URL=mysql://migration_user:password@localhost:3306/easystack
#    SHADOW_DATABASE_URL=mysql://migration_user:password@localhost:3306/easystack_shadow

# 3. Apply all migrations
npm run prisma:migrate

# 4. Generate Prisma client types
npm run prisma:generate

# 5. Start development server
npm run dev
```

### Apply Latest Changes (After Git Pull)

```bash
# 1. Check migration status
npm run prisma:status

# 2. Install any new dependencies
npm install

# 3. Apply pending migrations
npm run prisma:migrate

# 4. Start development server
npm run dev
```

### Reset Development Database

```bash
# ⚠️ WARNING: This deletes ALL data in the database

# Full reset with fresh migrations
npm run prisma:reset

# Seed with default data
npm run prisma:seed

# Verify schema is correct
npm run prisma:status
```

### Check Database Status

```bash
# See which migrations have been applied
npm run prisma:status

# Output will show:
# "Database schema is up to date!" OR
# "Following migrations have not yet been applied: ..."
```

### Create New Migration

```bash
# 1. Edit prisma/schema.prisma with your changes

# 2. Create and apply migration
npm run prisma:migrate

# 3. When prompted, enter migration name
# Example: "add_billing_features"

# 4. Review generated SQL
cat prisma/migrations/20260316XXXXXX_add_billing_features/migration.sql

# 5. Commit to git
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add billing features"
```

### Deploy to Staging/Production

```bash
# 1. Create backup before applying migrations
mysqldump -u backup_user -p easystack > backups/pre_deployment_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
npm ci

# 4. Check pending migrations
npm run prisma:status

# 5. Build application
npm run build

# 6. Apply migrations (no new ones created)
npm run prisma:deploy

# 7. Restart application
systemctl restart easystack-backend

# 8. Verify
curl http://localhost:3000/api/health
```

---

## Verification Checklist

After applying the migration, verify everything works:

```bash
# ✅ Check migration status
npm run prisma:status

# ✅ Generate fresh Prisma client
npm run prisma:generate

# ✅ Build TypeScript
npm run build

# ✅ Start development server
npm run dev

# ✅ Test authorization endpoints
# See documentation/AUTHORIZATION.md for API examples
```

---

## Database Tables Created

### WorkspaceMemberPermission
Stores custom permission overrides per member.

Fields:
- `id` - Primary key
- `workspace_member_id` - FK to WorkspaceMember
- `action` - Permission action (e.g., "workspace.delete")
- `is_allowed` - true = grant, false = deny
- `granted_at` - Timestamp when granted
- `granted_by_user_id` - FK to User (who granted)
- `reason` - Optional reason for override (e.g., "temporary for migration")

### RolePermission
Stores default permissions for each role.

Fields:
- `id` - Primary key
- `role` - OWNER, ADMIN, MEMBER, DEVELOPER, or PUBLISHER
- `action` - Permission action (e.g., "workspace.update.name")

### ProjectMember
Stores project membership assignments.

Fields:
- `id` - Primary key
- `project_id` - FK to Project
- `workspace_id` - FK to Workspace (for consistency check)
- `user_id` - FK to User
- `is_active` - Whether member is currently assigned
- `assigned_at` - When assigned
- `assigned_by_user_id` - FK to User (who assigned)
- `removed_at` - When removed
- `removed_by_user_id` - FK to User (who removed)

---

## Key Changes to WorkspaceMember

### Audit Metadata Added
- `role_changed_at` - When role last changed
- `role_changed_by_user_id` - Who made the change
- `removed_at` - When member was removed
- `removed_by_user_id` - Who removed them

### New Indexes for Performance
- Composite index on (workspace_id, role) for fast role-based queries
- Composite index on (workspace_id, user_id) for fast membership checks

### Dual Unique Constraints
- `uk_workspace_user_default` - Old constraint preserved for backwards compatibility
- `uk_workspace_user` - New constraint for membership checking

---

## Environment Variables Required

```bash
# Migration user (DDL permissions only)
DATABASE_URL="mysql://migration_user:password@localhost:3306/easystack"
SHADOW_DATABASE_URL="mysql://migration_user:password@localhost:3306/easystack_shadow"

# App user (DML permissions only - used at runtime)
APP_DATABASE_URL="mysql://app_user:password@localhost:3306/easystack"
```

---

## Next Steps

1. **Review authorization schema** - See [documentation/AUTHORIZATION.md](documentation/AUTHORIZATION.md)
2. **Seed permissions** - Run `npm run prisma:seed` to populate default permissions
3. **Implement AuthorizationService** - See [src/services/authorization.service.ts](src/services/authorization.service.ts)
4. **Test endpoints** - Use new permission-based access control

---

## Troubleshooting

### "Database in sync" but migrations pending
```bash
# Refresh Prisma state
npm run prisma:generate
npm run prisma:status
```

### Foreign key constraint errors
```bash
# Database has old constraints, force reset
npm run prisma:reset
npm run prisma:seed
```

### Prisma client out of date
```bash
# Regenerate all types
rm -rf node_modules/.prisma/
npm run prisma:generate
```

### Migration fails with "drift detected"
```bash
# Database schema doesn't match migrations
# Reset in development:
npm run prisma:reset

# In production: restore from backup and contact DevOps
```

---

## Related Documentation

- [AUTHORIZATION.md](documentation/AUTHORIZATION.md) - Complete authorization guide
- [MIGRATIONS.md](documentation/MIGRATIONS.md) - Detailed migration operations
- [LOCAL_DEVELOPMENT.md](documentation/LOCAL_DEVELOPMENT.md) - Development setup
