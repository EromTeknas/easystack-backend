# Billing System Migration Guide

## Quick Setup

Follow these steps to integrate the billing system into your existing EasyStack backend:

### Step 1: Generate Prisma Migration

```bash
# Generate migration from schema changes
npm run prisma:migrate dev --name add_billing_tables

# This creates:
# - plans table
# - subscriptions table  
# - plan_versions table
# - Adds subscription relation to users
```

### Step 2: Generate Prisma Client

```bash
# Regenerate Prisma client with new models
npm run prisma:generate
```

### Step 3: Seed Default Plans

```bash
# Create default plans (Free, Pro, Team, Enterprise)
npx ts-node prisma/seed-plans.ts
```

### Step 4: Assign Free Plan to Existing Users

Create a migration script to assign free plans:

```bash
npx ts-node -e "
import { prisma } from './src/db/prisma';
import { BillingService } from './src/services/billing.service';

async function assignFreePlans() {
  const users = await prisma.user.findMany({
    where: {
      subscription: null
    }
  });

  for (const user of users) {
    await BillingService.createFreeSubscription(user.id);
    console.log(\`✅ Assigned free plan to user: \${user.email}\`);
  }

  console.log(\`✅ Done! Assigned plans to \${users.length} users\`);
}

assignFreePlans().catch(console.error);
"
```

Or create a dedicated script at `src/cli/assign-free-plans.ts`:

```typescript
import { prisma } from '../db/prisma';
import { BillingService } from '../services/billing.service';

async function assignFreePlans() {
  console.log('🔄 Finding users without subscriptions...');
  
  const users = await prisma.user.findMany({
    where: {
      subscription: null,
    },
  });

  console.log(`Found ${users.length} users without subscriptions`);

  for (const user of users) {
    try {
      await BillingService.createFreeSubscription(user.id);
      console.log(`✅ Assigned free plan to: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed for ${user.email}:`, error);
    }
  }

  console.log(`\n✅ Migration complete! Processed ${users.length} users`);
  process.exit(0);
}

assignFreePlans().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

Run it:
```bash
npx ts-node src/cli/assign-free-plans.ts
```

---

## Step 5: Update Registration Flow (Optional)

To automatically assign free plan to new users, update [src/routes/auth/register.controller.ts](../src/routes/auth/register.controller.ts):

```typescript
import { BillingService } from '../../services/billing.service';

// After creating user in database
const newUser = await prisma.user.create({ ... });

// Assign free plan to new user
await BillingService.createFreeSubscription(newUser.id);
```

---

## Step 6: Restart Development Server

```bash
npm run dev
```

---

## Verify Setup

### 1. Check Plans

```bash
curl http://localhost:4000/api/billing/plans
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "free",
      "displayName": "Free",
      "config": { ... }
    },
    ...
  ]
}
```

### 2. Check User Plan (requires auth)

```bash
curl --cookie "accessToken=YOUR_ACCESS_TOKEN" \
     http://localhost:4000/api/billing/my-plan
```

Expected response:
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "...",
      "name": "free",
      "displayName": "Free",
      "config": {
        "limits": { ... },
        "features": { ... },
        "pricing": { ... }
      }
    },
    "usage": {
      "projects": 0,
      "environments": 0,
      ...
    }
  }
}
```

---

## Using Billing in Your Code

### Example 1: Protect Project Creation

```typescript
// src/routes/projects/projects.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import { billingGuard, trackUsage } from '../../middlewares/billing.middleware';
import { createProject } from './projects.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  billingGuard('projects'),
  trackUsage('projects', 1),
  createProject
);

export default router;
```

### Example 2: Feature-Based Access

```typescript
// src/routes/domains/domains.routes.ts
import { featureGuard } from '../../middlewares/billing.middleware';

router.post(
  '/custom-domain',
  authenticate,
  featureGuard('custom_domain'),
  setCustomDomain
);
```

### Example 3: Check in Controller

```typescript
import { BillingService } from '../../services/billing.service';

export const createProject = async (req: Request, res: Response) => {
  const userId = req.user.id;
  
  // Check was already done by billingGuard middleware
  // but you can also check manually:
  const check = await BillingService.canPerformAction(userId, 'projects');
  
  if (!check.allowed) {
    throw new AppError('Project limit reached', 403);
  }
  
  // Create project...
  
  // Usage will be tracked automatically by trackUsage middleware
};
```

---

## Admin Operations

### Create a Custom Plan

```bash
curl -X POST http://localhost:4000/api/admin/billing/plans \
  --cookie "accessToken=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "startup",
    "displayName": "Startup",
    "config": {
      "limits": {
        "projects": 50,
        "environments": 10,
        "users": 5
      },
      "features": {
        "custom_domain": true,
        "team_collaboration": true
      },
      "pricing": {
        "monthly": 49,
        "yearly": 490,
        "currency": "USD"
      }
    }
  }'
```

### Give User Unlimited Projects

```bash
curl -X PATCH http://localhost:4000/api/admin/billing/subscriptions/123/override \
  --cookie "accessToken=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "override": {
      "limits": {
        "projects": null
      }
    }
  }'
```

---

## Troubleshooting

### "No active subscription found"

**Problem:** User doesn't have a subscription.

**Solution:**
```typescript
await BillingService.createFreeSubscription(userId);
```

### "Free plan not found"

**Problem:** Plans weren't seeded.

**Solution:**
```bash
npx ts-node prisma/seed-plans.ts
```

### Redis Connection Error

**Problem:** Redis not running or misconfigured.

**Solution:**
```bash
# Check Redis is running
redis-cli ping
# Should return "PONG"

# Check .env has correct Redis config
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### MongoDB Connection Error

**Problem:** MongoDB not running for usage tracking.

**Solution:**
```bash
# Check MongoDB is running
mongosh

# Check .env has correct MongoDB URL
MONGODB_URI=mongodb://localhost:27017/easystack
```

---

## Next Steps

1. ✅ Test billing guards on existing routes
2. ✅ Add usage tracking to API endpoints
3. ✅ Create admin UI for plan management
4. ✅ Integrate Stripe for payments
5. ✅ Add usage alerts and notifications
6. ✅ Build user-facing plan upgrade flow

See [BILLING.md](BILLING.md) for complete documentation.
