# Database Migrations & Seeding Reference

## 1. Overview

EasyStack uses **Prisma ORM** for version-controlled, reproducible MySQL schema migrations. All relational tables, indexes, constraints, and enums are defined in [`prisma/schema.prisma`](file:///home/eteknas/Projects/easystack-backend/prisma/schema.prisma) and versioned under [`prisma/migrations/`](file:///home/eteknas/Projects/easystack-backend/prisma/migrations).

MongoDB document models (Mongoose) are schema-less at the database engine level and do not use SQL migrations; document validation is enforced at application runtime.

---

## 2. Migration Commands

| Command | Script in `package.json` | Purpose | Environment |
|---|---|---|---|
| `npm run prisma:migrate` | `prisma migrate dev` | Applies pending migrations or creates a new one interactively | Local / Dev |
| `npm run prisma:generate` | `prisma generate` | Regenerates `@prisma/client` TypeScript types | All |
| `npm run prisma:deploy` | `prisma migrate deploy` | Applies pending migrations non-interactively without prompting | CI / Staging / Prod |
| `npm run prisma:status` | `prisma migrate status` | Checks pending migration diffs between code and database | All |
| `npm run prisma:reset` | `prisma migrate reset --force` | Drops database, recreates schema, and runs seeders | Local / Dev ONLY |

---

## 3. Creating a New Migration

Follow these steps whenever modifying relational models:

### Step 1: Edit the Prisma Schema
Modify [`prisma/schema.prisma`](file:///home/eteknas/Projects/easystack-backend/prisma/schema.prisma):
```prisma
model Workspace {
  id          Int       @id @default(autoincrement())
  name        String
  newSetting  Boolean   @default(false) // Added field
  ...
}
```

### Step 2: Create and Apply Migration
```bash
npm run prisma:migrate
```
Prisma will compare `schema.prisma` against your database, generate the SQL migration file in `prisma/migrations/<timestamp>_<name>/migration.sql`, and apply it locally.

### Step 3: Regenerate Prisma Client
```bash
npm run prisma:generate
```
This updates `@prisma/client` types under `node_modules/.prisma/client/` to ensure TypeScript compilation succeeds.

### Step 4: Commit Migration Files
Always commit both `prisma/schema.prisma` and the newly generated migration folder:
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add newSetting to Workspace"
```

---

## 4. Database Seeding

The seed runner is located at [`prisma/seed.ts`](file:///home/eteknas/Projects/easystack-backend/prisma/seed.ts) and orchestrated through dedicated seed modules under [`prisma/seeders/`](file:///home/eteknas/Projects/easystack-backend/prisma/seeders):

| Seeder File | Responsibility |
|---|---|
| `authorization.seeder.ts` | Populates `Role`, `Permission`, and `RolePermission` entries |
| `billing-features.seeder.ts` | Populates SaaS plan feature flags |
| `billing-quotas.seeder.ts` | Populates SaaS plan quota definitions |
| `billing-plans.seeder.ts` | Populates `Plan` and `PlanVersion` entries (Free, Pro, Enterprise) |
| `users.seeder.ts` | Populates 10 fake test users, passwords, and their default workspaces |

### Seeding Commands
```bash
# Seed Core Infrastructure Only (Roles, Permissions, Billing Plans & Quotas)
npm run db:seed

# Seed Core Infrastructure + 10 Test Users (Used by npm run dev)
npm run db:seed:users
```

---

## 5. Invariants & Rules

1. **Never Edit Already-Applied Migrations**: Once a migration SQL file is committed and pushed, it is immutable. To make changes, edit `prisma/schema.prisma` and generate a new migration.
2. **Never Hardcode SaaS Limits in Migrations**: Never use manual SQL migrations to adjust plan quotas. Update the source of truth in [`src/services/billing/config/`](file:///home/eteknas/Projects/easystack-backend/src/services/billing/config) and run the seeders.
3. **Always Include Soft-Delete Indexes**: If creating a new multi-tenant relational table, include `removedAt DateTime?` and add an index `@@index([removedAt])` or composite index `@@index([workspaceId, removedAt])`.
