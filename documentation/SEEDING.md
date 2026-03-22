# Database Seeding Guide

This guide explains how to seed the EasyStack Backend database with test data, including plans, permissions, fake users, and their default workspaces.

## Available Seed Scripts

The project provides individual seed scripts for different aspects:

| Script | Command | Purpose |
|--------|---------|---------|
| Plans | `npm run seed:plans` | Seeds billing plans (Free, Pro, Enterprise) |
| Authorization | `npm run seed:authorization` | Seeds workspace role permissions |
| Permissions | `npm run seed:permissions` | Seeds role-permission mappings |
| Users | `npm run seed:users` | Seeds 10 fake test users with default workspaces |
| Core Seeds | `npm run seed:core` | Seeds plans, authorization, and permissions (used in `npm run dev`) |
| All Seeds | `npm run seed:all` | Runs core seeds + user seeds in sequence |

## Quick Start

### Option 1: Development Mode (Auto-Seed Core Data)

```bash
npm run dev
```

This will:
1. Seed core data (plans, authorization, permissions) - **no users**
2. Start Express server with hot reload
3. Start worker process with hot reload

**Use this for daily development** - you get infrastructure seeded but can test user creation flows.

### Option 2: Full Seeding (Core + Fake Users)

```bash
npm run seed:all
```

This will execute all seed scripts in order:
1. Plans
2. Authorization (role permissions)
3. Permissions (role-permission mappings)
4. Users with default workspaces

Then start your dev server separately:
```bash
npm run dev
```

### Option 3: Run Individual Seeds

```bash
npm run seed:plans
npm run seed:authorization
npm run seed:permissions
npm run seed:users
```

## Fake Test Users

10 fake users with default workspaces are created when you run `npm run seed:users` or `npm run seed:all`:

| Email | Name | Status | Verified | Password | Workspace |
|-------|------|--------|----------|----------|-----------|
| alice@example.com | Alice Johnson | ACTIVE | ✅ | Test@12345678 | Alice's Workspace |
| bob@example.com | Bob Smith | ACTIVE | ✅ | Test@98765432 | Bob's Workspace |
| charlie@example.com | Charlie Brown | ACTIVE | ✅ | Test@11223344 | Charlie's Workspace |
| diana@example.com | Diana Prince | ACTIVE | ✅ | Test@55667788 | Diana's Workspace |
| evan@example.com | Evan Davis | ACTIVE | ✅ | Test@99887766 | Evan's Workspace |
| fiona@example.com | Fiona Wilson | PENDING_VERIFICATION | ❌ | Test@44332211 | Fiona's Workspace |
| george@example.com | George Miller | ACTIVE | ✅ | Test@77554433 | George's Workspace |
| helen@example.com | Helen Taylor | ACTIVE | ✅ | Test@88664422 | Helen's Workspace |
| ian@example.com | Ian Anderson | INACTIVE | ✅ | Test@22334455 | Ian's Workspace |
| julia@example.com | Julia Thomas | ACTIVE | ✅ | Test@66778899 | Julia's Workspace |

### Using Test Users for Authentication

All test users can be used to log in via the authentication endpoints using their email and password.

Example login request:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Test@12345678"
  }'
```

Each user automatically has:
- ✅ A default workspace (OWNER role)
- ✅ Workspace member record with OWNER role
- ✅ Billing plan assigned (FREE by default)
- ✅ Proper user status and email verification state

## Seeding Data Details

### Plans (3 Total)
- **Free**: 3 projects, 1 environment, 1 user, 500MB storage
- **Pro**: 20 projects, 5 environments, 10 users, 50GB storage
- **Enterprise**: Unlimited (configured via custom override)

### Permissions (28 Total)
Role-based permissions seeded for:

**OWNER** (implicit full access)
- workspace.update.name, workspace.update.logo, workspace.delete
- workspace.members.add/remove/assign_role
- project.create, project.update.name, project.delete
- project.members.add/remove

**ADMIN**
- workspace.read, workspace.update.name, workspace.update.logo
- workspace.members.add/remove
- workspace.permissions.grant/revoke
- project.read, project.update.name, project.update.description
- project.delete, project.members.add/remove

**USER**
- workspace.read
- project.read
- project.update.name (limited)

## Workflow for Testing

### Scenario 1: Test User Registration
```bash
# Start dev (seeds core infrastructure, no users)
npm run dev

# Test registration endpoint without fake users interfering
# Users created via registration will automatically get a workspace
```

### Scenario 2: Test Authorization with Fake Users
```bash
# Full seed (core + fake users with workspaces)
npm run seed:all

# Start dev
npm run dev

# Test auth flows, workspace access, permissions
```

### Scenario 3: Test from Scratch
```bash
# Reset database to clean state
npm run prisma:reset

# Full seed
npm run seed:all

# Start dev
npm run dev
```

## Resetting the Database

To reset the database to a clean state (removes all data and reruns migrations):

```bash
npm run prisma:reset
```

After reset, seed as needed:
```bash
npm run seed:all      # Full seed
# OR
npm run dev           # Dev mode (core seeds only)
```

## Troubleshooting

### Users/Workspaces Not Creating
```bash
npm run prisma:reset
npm run seed:all
```

### Seeds fail with database connection error
Verify MySQL and Redis are running:
```bash
# Check MySQL
docker ps | grep mysql

# Check Redis
redis-cli ping  # should return PONG
```

### User already exists but need to reseed
The seed scripts use `upsert` operations (create or update), so running them again is safe.

## Environment Variables

Required:
- `DATABASE_URL`: MySQL connection string

Optional:
- `BCRYPT_ROUNDS`: Number of bcrypt rounds for password hashing (default: 12)

Example:
```bash
BCRYPT_ROUNDS=10 npm run seed:users
```

## Development Workflow Recommendation

**For Daily Development:**
```bash
npm run dev
```

This starts with core infrastructure (plans, permissions) but no fake users. Perfect for:
- Testing user registration flows
- Testing signup journeys
- Creating real test data as needed

**When Testing Authorization:**
```bash
npm run seed:all
npm run dev
```

This gives you immediate access to 10 test accounts with full workspace setup.

**When Debugging Database Issues:**
```bash
npm run prisma:reset
npm run seed:all
npm run dev
```

This ensures a completely fresh start.

