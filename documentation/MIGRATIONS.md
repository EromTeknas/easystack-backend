# Database Migrations

Version-controlled database schema management. Migrations track and execute database changes consistently across all environments.

---

## Why Migrations?

✅ **Version Control**: Database schema changes tracked in git  
✅ **Reproducibility**: New developers can setup database in one command  
✅ **Consistency**: Same schema across local, dev, prod  
✅ **Reversibility**: Rollback changes if needed  
✅ **Safety**: Track what changed and when  

---

## Quick Start

### First Time Setup (Local)

```bash
# 1. Ensure MySQL is running and .env is configured
npm install

# 2. Run all pending migrations
npm run migrate:up

# 3. Check status
npm run migrate:status
```

That's it! Your database is now set up with all tables.

---

## Commands

### Run Pending Migrations
```bash
npm run migrate:up
```
Executes all migrations that haven't been run yet.

**Output:**
```
▶️  Running migration: 001-auth-schema
✅ Completed: 001-auth-schema
✅ All migrations completed successfully
```

### Check Migration Status
```bash
npm run migrate:status
```
Shows which migrations have been executed and which are pending.

**Output:**
```
📋 Migration Status

Executed:
  ✅ 001-auth-schema

Pending:
  (none - database is up to date)
```

### Rollback Last Migration
```bash
npm run migrate:down
```
Rolls back the most recently executed migration.

**Use case**: Undo changes during development or emergency rollback.


### Rollback All Migrations
```bash
npm run migrate:down:all
```
Rolls back all migrations and drops all tables. Use with caution!

### Fresh Database
```bash
npm run migrate:fresh
```
Rolls back all migrations (drops all tables), then runs them again. Useful for resetting to a clean state.

⚠️ **Warning**: Deletes all data. Use only in development!

### Fresh Database (Preserve Data)
```bash
npm run migrate:fresh:preserve
```
Removes migration records but keeps all tables/data. Use if you want to re-run migrations without losing data.

### Rollback All Migrations (Preserve Data)
```bash
npm run migrate:down:all -- --preserve-data
```
Removes migration records but does not drop tables/data.

---

## How It Works

### Migration Tracking

Migrations are tracked in the `_migrations` table:

```sql
CREATE TABLE _migrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

When you run `npm run migrate:up`:
1. Connects to database
2. Creates `_migrations` table if not exists
3. Checks which migrations have been executed
4. Runs all pending migrations in order
5. Records each migration in the table

---

## Creating New Migrations

### Step 1: Create Migration File

Create file: `src/migrations/002-add-email-verification.ts`

```typescript
import { db } from '../db';
import { Migration } from './types';

export const emailVerificationMigration: Migration = {
  name: '002-add-email-verification',

  async up() {
    // Changes to apply
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN email_verification_token VARCHAR(255),
      ADD COLUMN email_verification_token_expires_at TIMESTAMP NULL;
    `);
  },

  async down() {
    // Rollback changes
    await db.query(`
      ALTER TABLE users 
      DROP COLUMN email_verification_token,
      DROP COLUMN email_verification_token_expires_at;
    `);
  }
};
```

**Rules:**
- Name must be unique and sequential: `001-`, `002-`, `003-`, etc.
- Must implement both `up()` and `down()` methods
- Use descriptive names
- Keep migrations focused (one feature/change per migration)

### Step 2: Register Migration

Edit: `src/migrations/index.ts`

```typescript
import migrator from './migrator';
import { authSchemaMigration } from './001-auth-schema';
import { emailVerificationMigration } from './002-add-email-verification';

// Register all migrations
migrator.register(authSchemaMigration);
migrator.register(emailVerificationMigration);  // Add here

export default migrator;
```

### Step 3: Run It

```bash
npm run migrate:up
```

The new migration will be executed automatically.

---

## Migration Examples

### Add Column
```typescript
async up() {
  await db.query(`
    ALTER TABLE users 
    ADD COLUMN phone_number VARCHAR(20);
  `);
}

async down() {
  await db.query(`
    ALTER TABLE users 
    DROP COLUMN phone_number;
  `);
}
```

### Create Index
```typescript
async up() {
  await db.query(`
    ALTER TABLE users 
    ADD INDEX idx_email_status (email, status);
  `);
}

async down() {
  await db.query(`
    ALTER TABLE users 
    DROP INDEX idx_email_status;
  `);
}
```

### Add Table
```typescript
async up() {
  await db.query(`
    CREATE TABLE user_sessions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      token VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

async down() {
  await db.query('DROP TABLE IF EXISTS user_sessions');
}
```

### Modify Data
```typescript
async up() {
  // Set default role for existing users
  await db.query(`
    UPDATE users 
    SET role = 'USER' 
    WHERE role IS NULL;
  `);
}

async down() {
  // No rollback needed for data updates, but you could:
  await db.query('UPDATE users SET role = NULL WHERE role = "USER"');
}
```

---

## Best Practices

### ✅ Do

```typescript
// ✅ Descriptive migration names
002-add-user-preferences

// ✅ One logical change per migration
// ✅ Idempotent migrations (can run multiple times safely)
// ✅ Always implement up() and down()
// ✅ Test migrations locally first
// ✅ Keep migrations simple
// ✅ Document complex migrations with comments
// ✅ Use IF NOT EXISTS / IF EXISTS for safety
```

### ❌ Don't

```typescript
// ❌ Vague names
002-updates

// ❌ Multiple unrelated changes in one migration
// CREATE TABLE foo; ALTER TABLE bar; UPDATE baz;

// ❌ Skip rollback (down) method
// ❌ Make breaking changes without planning
// ❌ Run migrations in random order
// ❌ Edit completed migrations (create new ones instead)
// ❌ Delete old migration files
```

---

## Deployment Workflow

### Development
```bash
# Local setup
npm install
npm run migrate:up  # Done!
```

### Staging/Production
```bash
# 1. Deploy new code
git pull origin main

# 2. Run migrations
npm run migrate:up

# 3. Start application
npm run build
npm start
```

**With Docker:**
```dockerfile
FROM node:24

WORKDIR /app
COPY . .

RUN npm install

# Run migrations before starting app
RUN npm run migrate:up

CMD ["npm", "start"]
```

---

## Troubleshooting

### "Migration failed: 001-auth-schema"

Check MySQL connection:
```bash
# Verify .env has correct credentials
cat .env | grep MYSQL_

# Test connection
mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_PASSWORD -e "SELECT 1"
```

### "Migration already executed"

If you see this and want to re-run:
```bash
# Check what's in the table
mysql -u root easystack -e "SELECT * FROM _migrations"

# Manually remove if needed (careful!)
# DELETE FROM _migrations WHERE name = '001-auth-schema';

# Or rollback properly
npm run migrate:down
npm run migrate:up
```

### "Can't find migration X"

Make sure migration is:
1. Created in `src/migrations/`
2. Exported in `src/migrations/index.ts`
3. Has `name` property that matches filename

---

## Current Migrations

### 001-create-users ✅
**Status**: Created on `npm run migrate:up`

**Creates**: `users` table for user authentication and profiles

**Fields**:
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
first_name      VARCHAR(100)
last_name       VARCHAR(100)
role            ENUM('USER', 'ADMIN', 'MODERATOR') DEFAULT 'USER'
status          ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
email_verified  BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

### 002-create-refresh-tokens ✅
**Status**: Created on `npm run migrate:up`

**Creates**: `refresh_tokens` table for JWT refresh token management

**Fields**:
```sql
id                    BIGINT PRIMARY KEY AUTO_INCREMENT
user_id               BIGINT NOT NULL (FK -> users.id)
token_hash            VARCHAR(255) UNIQUE NOT NULL
expires_at            TIMESTAMP NOT NULL
revoked_at            TIMESTAMP NULL
ip_address            VARCHAR(45)
user_agent            TEXT
device_name           VARCHAR(255)
created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Purpose**: Stores hashed refresh tokens for token rotation and revocation management.

---

### 002-create-workspaces ✅
**Status**: Created on `npm run migrate:up`

**Creates**: `workspaces` table for multi-workspace support

**Fields**:
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
name            VARCHAR(255) NOT NULL
slug            VARCHAR(255) UNIQUE NOT NULL
owner_id        BIGINT NOT NULL (FK -> users.id)
status          ENUM('active', 'inactive') DEFAULT 'active'
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**Purpose**: Enables users to create and manage multiple workspaces.

---

### 003-create-audit-logs ✅
**Status**: Created on `npm run migrate:up`

**Creates**: `audit_logs` table for tracking user actions

**Fields**:
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
user_id         BIGINT (FK -> users.id, ON DELETE SET NULL)
action          VARCHAR(50)
resource        VARCHAR(100)
ip_address      VARCHAR(45)
user_agent      TEXT
status          ENUM('success', 'failure')
error_message   TEXT
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Purpose**: Maintains an audit trail of important user actions for security and compliance.

---

### 003-create-workspace-members ✅
**Status**: Created on `npm run migrate:up`

**Creates**: `workspace_members` table for workspace access control

**Fields**:
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
workspace_id    BIGINT NOT NULL (FK -> workspaces.id)
user_id         BIGINT NOT NULL (FK -> users.id)
role            ENUM('OWNER', 'ADMIN', 'MEMBER') DEFAULT 'MEMBER'
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
UNIQUE KEY      (workspace_id, user_id)
```

**Purpose**: Manages user roles and permissions within each workspace.

---

### 004-create-email-otps ✅
**Status**: Created on `npm run migrate:up`

**Creates**: `email_otps` table for email verification via OTP

**Fields**:
```sql
id              BIGINT PRIMARY KEY AUTO_INCREMENT
user_id         BIGINT NOT NULL (FK -> users.id)
otp_code_hash   VARCHAR(255) NOT NULL
expires_at      TIMESTAMP NOT NULL
attempts        INT DEFAULT 0
max_attempts    INT DEFAULT 5
verified_at     TIMESTAMP NULL
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Purpose**: Stores OTP codes for email verification during registration and password reset.

---

## Migration File Structure

```
src/migrations/
├── index.ts              # Migration registry
├── migrator.ts           # Migration runner/tracker
├── types.ts              # TypeScript interfaces
└── 001-auth-schema.ts    # Individual migration
└── 002-*.ts              # (future migrations)

src/cli/
└── migrate.ts            # CLI entry point
```

---

## FAQ

**Q: Can I edit a completed migration?**  
A: No. Create a new migration instead.

**Q: What if a migration fails halfway?**  
A: The transaction rolls back. Fix the issue and run again.

**Q: Can I skip a migration?**  
A: Migrations must run in order. This ensures consistency.

**Q: How do I share database schema with the team?**  
A: Migrations are in git. Everyone runs `npm run migrate:up`.

**Q: What about production data?**  
A: Migrations should not delete data. Use `ALTER TABLE` not `DROP TABLE`.

---

## Links

- [Authentication Documentation](../AUTHENTICATION.md) - Authentication system design and email verification flow
- [Setup Guide](../SETUP_GUIDE.md) - Initial project setup
- [Files Reference](../FILES_REFERENCE.md) - Project file structure
