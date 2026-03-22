# Database Migrations

Version-controlled database schema management using Prisma. Migrations track and execute database changes consistently across all environments.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Common Operations](#common-operations)
3. [How Migrations Work](#how-migrations-work)
4. [Creating New Migrations](#creating-new-migrations)
5. [Development Workflow](#development-workflow)
6. [Deployment Workflow](#deployment-workflow)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### First Time Setup (Local, MySQL)

```bash
# 1. Install dependencies
npm install

# 2. Ensure .env has DATABASE_URL and SHADOW_DATABASE_URL set
#    DATABASE_URL=mysql://migration_user:password@localhost:3306/easystack
#    SHADOW_DATABASE_URL=mysql://migration_user:password@localhost:3306/easystack_shadow

# 3. Apply all pending migrations
npm run prisma:migrate
```

This applies all Prisma migrations in `prisma/migrations/` to your local database.

---

## Common Operations

### Check Current Migration Status

```bash
# See which migrations have been applied
npx prisma migrate status

# Output shows:
# Following migration have not yet been applied:
#   20260222131709_update_users_and_workspaces
#   20260314084011_add_projects
# Otherwise shows all migrations applied
```

### Apply All Pending Migrations (Development)

```bash
# Run all pending migrations interactively
npm run prisma:migrate

# When prompted, name the changes (optional in dev)
# Example: "add_projects_table"
```

### Apply All Pending Migrations (CI/Staging/Production)

```bash
# Deploy only already-generated migrations
# Does NOT create new migrations
npx prisma migrate deploy
```

### Create a New Migration

```bash
# 1. Edit prisma/schema.prisma with your schema changes

# 2. Create and apply migration in one command
npm run prisma:migrate

# 3. When prompted, name your migration (use descriptive names)
# Example: "add_billing_features"
# Prisma creates folder: prisma/migrations/20260320123456_add_billing_features/

# 4. Review the generated SQL file
cat prisma/migrations/20260320123456_add_billing_features/migration.sql

# 5. Commit both schema and migration folder
git add prisma/schema.prisma prisma/migrations/20260320123456_add_billing_features/
git commit -m "feat: add billing features"
```

### Regenerate Prisma Client

```bash
# Run after schema changes to regenerate Prisma client types
npm run prisma:generate

# This creates/updates node_modules/.prisma/client/
# Required for TypeScript type checking to work
```

### View Migration History

```bash
# See all applied migrations with timestamps
npx prisma migrate history

# Output shows:
# Migration applied at
# 20260216153235_v0                      2026-02-16 15:32:35.000 UTC
# 20260220175849_update_users            2026-02-20 17:58:49.000 UTC
# 20260222131709_update_users_and_workspaces 2026-02-22 13:17:09.000 UTC
# 20260314084011_add_projects            2026-03-14 08:40:11.000 UTC
```

### Inspect a Migration

```bash
# View the SQL for a specific migration
cat prisma/migrations/20260314084011_add_projects/migration.sql

# View what the migration changed
npx prisma migrate diff --from-schema-datamodel --to-schema-datamodel

# Preview what would happen with next migration
npx prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script
```

---

## Database Operations

### Reset Database (Development Only)

⚠️ **WARNING**: This deletes ALL data. Use in development only.

```bash
# Complete database reset - removes all data and re-runs all migrations
npm run prisma:reset

# Alternative manual approach:
# 1. Drop the database
mysql -u migration_user -p -e "DROP DATABASE easystack;"

# 2. Create fresh database
mysql -u migration_user -p -e "CREATE DATABASE easystack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Apply all migrations
npm run prisma:migrate
```

### Seed Database (After Reset)

```bash
# Seeds default data (permissions, plans, etc.)
npm run prisma:seed

# Or if seed script doesn't have npm run command:
npx ts-node --project tsconfig.json prisma/seed.ts
```

### Soft Reset (Keep Schema, Re-seed)

```bash
# 1. Truncate all tables (keep schema)
npm run db:truncate  # If available in package.json

# 2. Seed default data
npm run prisma:seed

# Manual approach:
# mysql -u app_user -p easystack < /path/to/truncate_script.sql
# npm run prisma:seed
```

### Backup Database

```bash
# Export current database to file
mysqldump -u app_user -p easystack > backups/easystack_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
mysql -u app_user -p easystack < backups/easystack_20260315_143022.sql
```

### Check Database Size

```bash
# View size of database
mysql -u app_user -p easystack -e "SELECT 
  table_schema,
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
GROUP BY table_schema;"
```

---

## Schema Operations

### View Current Schema

```bash
# Generate and view current schema as SQL
npx prisma db push --skip-generate --dry-run

# Or view Prisma schema in human-readable format
cat prisma/schema.prisma | less
```

### Validate Schema

```bash
# Check if schema is valid and migrations are consistent
npx prisma validate

# If errors, view detailed diagnostics
npx prisma validate --verbose
```

### Generate Prisma Documentation

```bash
# Create HTML documentation of schema
npx prisma generate
```

### Check Database Connection

```bash
# Test connection to database
npx prisma db execute --stdin << EOF
SELECT 1 as connection_test;
EOF

# Expected output: "connection_test: 1"
```

### Introspect Database (Reverse Engineering)

```bash
# Generate Prisma schema from existing database (careful - overwrites schema.prisma!)
# Only use if database is source of truth
npx prisma db pull

# Review changes before committing
git diff prisma/schema.prisma
```

---

## How Migrations Work

### Database Setup

The datasource in `prisma/schema.prisma` is configured as:

```prisma
datasource db {
  provider          = "mysql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

**USER ROLES:**
- **Migration User**: Has DDL (ALTER TABLE, CREATE INDEX) permissions. Used ONLY for migrations.
- **App User**: Has DML (SELECT, INSERT, UPDATE, DELETE) permissions. Used by running application.

**DATABASE CONNECTIONS:**
- `DATABASE_URL`: Connection string for migration user (for `npm run prisma:migrate`)
- `SHADOW_DATABASE_URL`: Shadow database for planning migrations safely

### Migration Process

1. **Schema Comparison**: Prisma compares `prisma/schema.prisma` with database state
2. **SQL Generation**: Prisma generates SQL migration file
3. **Shadow Database**: Runs migration on shadow database first (safe test)
4. **Atomic Application**: If shadow succeeds, runs on production database
5. **Folder Creation**: Creates `prisma/migrations/{timestamp}_{name}/` with SQL and metadata
6. **Tracking**: Records migration in `_prisma_migrations` table

### Migration Files

Each migration creates a folder:

```
prisma/migrations/20260314084011_add_projects/
├── migration.sql          # SQL commands
└── migration_lock.toml    # Lock file (git-ignored, local only)
```

The SQL file is version-controlled and replayed in other environments.

---

## Creating New Migrations

### Step 1: Modify Schema

Edit `prisma/schema.prisma` to add/modify models/fields:

```prisma
model Project {
  id          Int       @id @default(autoincrement())
  workspaceId Int       @map("workspace_id")
  name        String
  createdAt   DateTime  @default(now()) @map("created_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
}
```

### Step 2: Generate Migration

```bash
# Interactive migration creation (with naming)
npm run prisma:migrate

# You'll see:
# Environment variables loaded from .env
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": MySQL database "easystack" at "localhost:3306"
# 
# ? Enter a name for this migration › add_projects
# 
# Generating migration...
# Created migration file prisma/migrations/20260314084011_add_projects/
# Applied the migration in 1234ms
```

### Step 3: Review Generated SQL

```bash
# Always review what Prisma generated
cat prisma/migrations/20260314084011_add_projects/migration.sql

# Example output:
# -- CreateTable "Project"
# CREATE TABLE `Project` (
#   `id` INT NOT NULL AUTO_INCREMENT,
#   `workspace_id` INT NOT NULL,
#   `name` VARCHAR(191) NOT NULL,
#   `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
#   PRIMARY KEY (`id`),
#   INDEX `Project_workspace_id_idx`(`workspace_id`),
#   FOREIGN KEY (`workspace_id`) REFERENCES `Workspace`(`id`)
# ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 4: Regenerate Prisma Client

```bash
npm run prisma:generate

# This updates TypeScript types based on new schema
```

### Step 5: Commit

```bash
git add prisma/schema.prisma prisma/migrations/20260314084011_add_projects/
git commit -m "feat: add projects table"
git push origin feature/projects
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/easystack-backend.git
cd easystack-backend

# 2. Install dependencies
npm install

# 3. Create .env from template
cp .env.example .env

# 4. Configure database URLs in .env
# DATABASE_URL=mysql://migration_user:password@localhost:3306/easystack
# SHADOW_DATABASE_URL=mysql://migration_user:password@localhost:3306/easystack_shadow

# 5. Run all migrations
npm run prisma:migrate

# 6. Seed database
npm run prisma:seed

# 7. Start development server
npm run dev
```

### Daily Development

```bash
# Pull latest changes
git pull origin main

# Check if new migrations exist
npx prisma migrate status

# Apply any new migrations
npm run prisma:migrate

# Start dev server
npm run dev
```

### Making Schema Changes

```bash
# 1. Edit prisma/schema.prisma
vim prisma/schema.prisma

# 2. Create and apply migration
npm run prisma:migrate
# When prompted: "Update users table"

# 3. Verify Prisma types updated
npm run prisma:generate

# 4. Test changes locally
npm run dev

# 5. Commit schema + migration
git add prisma/schema.prisma prisma/migrations/*/
git commit -m "feat: add user preferences"
```

### Reset Local Database (Start Fresh)

```bash
# ⚠️ Deletes ALL local data

# 1. Drop and recreate database
mysql -u migration_user -p << EOF
DROP DATABASE easystack;
CREATE DATABASE easystack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

# 2. Re-run all migrations
npm run prisma:migrate

# 3. Seed with defaults
npm run prisma:seed

# 4. Verify it worked
npx prisma studio  # Opens visual database browser
```

---

## Deployment Workflow

### Staging Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies (if package.json changed)
npm ci  # Use ci for reproducible installs

# 3. Check pending migrations
npx prisma migrate status

# 4. Build TypeScript
npm run build

# 5. Apply migrations (no new ones generated)
npx prisma migrate deploy

# 6. Start application
npm start
```

### Production Deployment

```bash
# 1. Create backup BEFORE applying migrations
mysqldump -u backup_user -p easystack > backups/easystack_pre_deployment_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull latest code on production server
git pull origin main

# 3. Install dependencies
npm ci

# 4. Check what migrations will be applied
npx prisma migrate status

# 5. Build application
npm run build

# 6. Apply migrations with safety checks
# Use deployment tool or:
npx prisma migrate deploy --skip-generate

# 7. Verify migration succeeded
npx prisma migrate status  # Should show "database in sync"

# 8. Restart application
systemctl restart easystack-backend

# 9. Verify application is running
curl http://localhost:3000/api/health

# 10. Monitor logs for errors
tail -f /var/log/easystack-backend.log
```

### Rollback After Failed Migration

```bash
# ⚠️ Only if migration failed and app won't start

# 1. Restore from backup
mysql -u backup_user -p easystack < backups/easystack_pre_deployment_20260315_143022.sql

# 2. Check migration status
npx prisma migrate status

# 3. Investigate failed migration
cat prisma/migrations/20260315_failed_migration/migration.sql

# 4. Fix schema or re-run migration
npm run prisma:migrate

# 5. Restart application
systemctl restart easystack-backend
```

---

## Troubleshooting

### Migration Status Shows "Drift"

```bash
# Database state doesn't match schema - migrations exist but not applied

# 1. Check what's missing
npx prisma migrate status

# 2. Apply migrations
npm run prisma:migrate  # Dev
# or
npx prisma migrate deploy  # Staging/Prod

# 3. Verify sync
npx prisma migrate status  # Should show "database in sync"
```

### "Shadow Database Creation Failed"

```bash
# Prisma couldn't create shadow database for migration planning

# 1. Verify shadow database credentials in .env
cat .env | grep SHADOW_DATABASE_URL

# 2. Test connection manually
mysql -u migration_user -p -h localhost -e "SELECT 1;"

# 3. Ensure migration user has CREATE DATABASE permission
mysql -u root -p << EOF
GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON easystack_shadow.* TO 'migration_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# 4. Retry migration
npm run prisma:migrate
```

### "Foreign Key Constraint Failed"

```bash
# Migration failed because of foreign key issues

# Check what migration is causing it
npx prisma migrate status

# View the problematic SQL
cat prisma/migrations/[migration_name]/migration.sql

# Common fix: Cascade deletes
# In schema.prisma:
@relation(fields: [workspaceId], references: [id], onDelete: Cascade)

# Then retry
npm run prisma:migrate
```

### "Table Already Exists"

```bash
# Someone manually created a table, now migration fails

# 1. Check _prisma_migrations table
mysql -u app_user -p easystack -e "SELECT * FROM _prisma_migrations;"

# 2. Manual repair: Mark migration as applied
mysql -u app_user -p easystack << EOF
INSERT INTO _prisma_migrations 
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES 
  ('abc123', 'checksum', NOW(), '20260314084011_add_projects', '', NULL, NOW(), 1);
EOF

# 3. Retry migrations
npx prisma migrate status
```

### Prisma Client Out of Sync

```bash
# TypeScript errors about schema fields not existing

# 1. Regenerate Prisma client
npm run prisma:generate

# 2. If still failing, fully rebuild
rm -rf node_modules/.prisma/
npm run prisma:generate

# 3. Rebuild TypeScript
npm run build
```

### Database Locked (Migration Won't Apply)

```bash
# Another process is holding a lock on database

# 1. Check for running processes
ps aux | grep mysql

# 2. Kill long-running query (if safe)
mysql -u root -p easystack -e "SHOW PROCESSLIST;" 
mysql -u root -p easystack -e "KILL [PROCESS_ID];"

# 3. Retry migration
npm run prisma:migrate
```

### View Migration SQL Without Applying

```bash
# Preview what will happen before applying

# 1. Generate migration (it applies to shadow DB first)
npm run prisma:migrate

# 2. View the SQL that was generated
cat prisma/migrations/[migration_name]/migration.sql

# 3. On production, see what would be applied
npx prisma migrate diff --from-schema-datamodel --to-schema-datamodel --script

# 4. If migration was wrong, undo locally
npx prisma migrate resolve --rolled-back [migration_name]
```

---

## Environment Variables

### .env Configuration

```bash
# Migration credentials (has DDL permissions)
DATABASE_URL="mysql://migration_user:migration_password@localhost:3306/easystack"
SHADOW_DATABASE_URL="mysql://migration_user:migration_password@localhost:3306/easystack_shadow"

# App credentials (has DML permissions only) - used by running app
APP_DATABASE_URL="mysql://app_user:app_password@localhost:3306/easystack"
```

### Validating Configuration

```bash
# Test migration user connection
mysql -u migration_user -p -h localhost -e "SELECT 1;" <<< "password"

# Test app user connection  
mysql -u app_user -p -h localhost -e "SELECT 1;" <<< "password"

# Check permissions
mysql -u root -p << EOF
SELECT User, Host, Grant_priv, Create_priv, Alter_priv, Drop_priv FROM mysql.user;
EOF
```

---

## Related Documentation

- [Database Setup Guide](./SETUP_GUIDE.md)
- [Local Development](./LOCAL_DEVELOPMENT.md)
- [Schema Reference](./FILES_REFERENCE.md)

---

## Best Practices

- Keep migrations small and focused on one logical change.
- Always review generated SQL in `prisma/migrations/**/migration.sql`.
- Commit migrations to git so all environments apply the same schema.
- Use the migration user for Prisma CLI; use the app user for the running API.

---

## Troubleshooting

- Check that `DATABASE_URL` and `SHADOW_DATABASE_URL` are set and valid.
- Ensure the migration user has privileges on both main and shadow databases.
- Inspect the failing migration SQL in `prisma/migrations/**/migration.sql`.

---

## Related Docs

- [Authentication Documentation](../AUTHENTICATION.md)
- [Setup Guide](../SETUP_GUIDE.md)
- [Files Reference](../FILES_REFERENCE.md)

