# Billing & Pricing System

## Overview

EasyStack uses a flexible, JSON-based billing system that allows for:
- Dynamic plan configuration without schema migrations
- Per-user custom overrides for enterprise/special cases
- Real-time usage tracking
- Feature flags and quota enforcement
- Plan versioning for pricing history

---

## Architecture

### 1. MySQL: Plans & Subscriptions (Source of Truth)

#### Plans Table
Stores plan definitions with JSON configuration:

```sql
CREATE TABLE plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) UNIQUE,
  display_name VARCHAR(100),
  config JSON NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Example Plan Config (JSON):**
```json
{
  "limits": {
    "projects": 3,
    "environments": 1,
    "users": 1,
    "api_requests_per_minute": 60,
    "storage_mb": 500,
    "ai_tokens_monthly": 100000
  },
  "features": {
    "custom_domain": false,
    "team_collaboration": false,
    "audit_logs": false
  },
  "pricing": {
    "monthly": 0,
    "yearly": 0,
    "currency": "USD"
  }
}
```

**Benefits of JSON Config:**
- ✅ Add new features without migrations
- ✅ Admin UI can edit dynamically
- ✅ Custom enterprise plans easy
- ✅ Versionable
- ✅ Feature flags built-in

#### Subscriptions Table
Maps users to plans with optional custom overrides:

```sql
CREATE TABLE subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT UNIQUE,
  plan_id VARCHAR(36),
  status ENUM('ACTIVE','TRIAL','EXPIRED','CANCELED'),
  custom_override JSON NULL,
  expires_at TIMESTAMP
);
```

**Custom Override Example:**
```json
{
  "limits": {
    "projects": 1000,
    "ai_tokens_monthly": 9999999
  }
}
```
This overrides base plan values for special cases.

### 2. MongoDB: Usage Tracking

Stores real-time usage counters per user per month:

```javascript
{
  "_id": "userId",
  "month": "2026-02",
  "usage": {
    "projects": 5,
    "environments": 2,
    "users": 3,
    "api_requests": 12340,
    "ai_tokens": 500000,
    "storage_mb": 1200
  }
}
```

### 3. Redis: Performance Caching

- Plans cached for 5 minutes
- Usage cached for 1 minute
- Cache keys: `billing:plan:{userId}`, `billing:usage:{userId}:{month}`

---

## Core Services

### BillingService

Located in `src/services/billing.service.ts`

**Key Methods:**

```typescript
// Get user's effective plan (with overrides applied)
BillingService.getEffectivePlan(userId: number): Promise<EffectivePlan>

// Get current usage
BillingService.getUserUsage(userId: number): Promise<UsageData>

// Check if user can perform action
BillingService.canPerformAction(userId: number, featureKey: string)

// Check if user has feature enabled
BillingService.hasFeature(userId: number, featureKey: string): Promise<boolean>

// Increment usage counter
BillingService.incrementUsage(userId: number, featureKey: string, amount: number)

// Create free subscription for new user
BillingService.createFreeSubscription(userId: number)
```

---

## Middleware & Guards

### 1. Billing Guard (Quota Check)

Checks if user has enough quota before allowing action:

```typescript
import { billingGuard } from '../middlewares/billing.middleware';

// Protect route with quota check
app.post('/projects', billingGuard('projects'), createProject);
app.post('/environments', billingGuard('environments'), createEnv);
```

**Response on quota exceeded:**
```json
{
  "success": false,
  "error": {
    "message": "Quota exceeded for projects. Limit: 3, Used: 3",
    "code": "QUOTA_EXCEEDED",
    "statusCode": 403,
    "details": {
      "feature": "projects",
      "limit": 3,
      "used": 3,
      "remaining": 0
    }
  }
}
```

### 2. Feature Guard

Checks if user has a specific feature enabled:

```typescript
import { featureGuard } from '../middlewares/billing.middleware';

app.post('/custom-domain', featureGuard('custom_domain'), setCustomDomain);
```

### 3. Usage Tracking

Automatically increments usage after successful requests:

```typescript
import { trackUsage } from '../middlewares/billing.middleware';

// Track static amount
app.post('/projects', 
  billingGuard('projects'),
  trackUsage('projects', 1),
  createProject
);

// Track dynamic amount based on request
app.post('/ai/generate',
  billingGuard('ai_tokens'),
  trackUsage('ai_tokens', (req) => req.body.estimatedTokens),
  aiHandler
);
```

---

## API Endpoints

### User-Facing Billing Routes

**Base:** `/api/billing`

```http
GET /api/billing/plans
# Get all available plans (public)

GET /api/billing/my-plan
# Get current user's plan and usage (requires auth)
```

### Admin Billing Routes

**Base:** `/api/admin/billing`
**Auth:** Internal EasyStack admin dashboard auth (placeholder; logic to be added)

#### Plans Management

```http
GET /api/admin/billing/plans
# Get all plans

GET /api/admin/billing/plans/:id
# Get specific plan

POST /api/admin/billing/plans
# Create new plan
Body: { name, displayName, config }

PUT /api/admin/billing/plans/:id
# Update plan (creates version history)
Body: { config }
```

#### Subscriptions Management

```http
GET /api/admin/billing/subscriptions/:userId
# Get user's subscription and effective plan

PATCH /api/admin/billing/subscriptions/:userId
# Update user's subscription
Body: { planId?, status?, expiresAt? }

PATCH /api/admin/billing/subscriptions/:userId/override
# Set custom override for user
Body: { override: { limits: {...}, features: {...} } }
```

---

## Usage Examples

### Protecting a Route with Billing

```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/authentication.middleware';
import { billingGuard, trackUsage } from '../middlewares/billing.middleware';

const router = Router();

router.post('/projects',
  authenticate,
  billingGuard('projects'),
  trackUsage('projects', 1),
  async (req, res) => {
    // Create project logic
    // Usage is automatically tracked on success
  }
);

export default router;
```

### Checking Features in Controller

```typescript
import { BillingService } from '../services/billing.service';

export const enableCustomDomain = async (req: Request, res: Response) => {
  const hasFeature = await BillingService.hasFeature(req.user.id, 'custom_domain');
  
  if (!hasFeature) {
    throw new AppError('Custom domain not available in your plan', 403);
  }
  
  // Enable custom domain logic
};
```

### Admin: Setting Custom Override

```typescript
// Give user unlimited projects
PATCH /api/admin/billing/subscriptions/123/override
{
  "override": {
    "limits": {
      "projects": null,  // null = unlimited
      "ai_tokens_monthly": 10000000
    }
  }
}
```

---

## Default Plans

Run the seed script to create default plans:

```bash
npx ts-node prisma/seed-plans.ts
```

**Plans:**
- **Free**: 3 projects, 1 env, basic features
- **Pro**: 20 projects, 5 envs, custom domain
- **Team**: 100 projects, 20 envs, team collaboration, audit logs
- **Enterprise**: Unlimited everything, all features

---

## Database Setup

### 1. Run Migration

```bash
npm run prisma:migrate dev
```

### 2. Seed Plans

```bash
npx ts-node prisma/seed-plans.ts
```

### 3. Assign Free Plan to Existing Users

You can modify the registration flow to auto-assign free plan:

```typescript
// In register.controller.ts
import { BillingService } from '../../services/billing.service';

// After creating user
await BillingService.createFreeSubscription(newUser.id);
```

---

## Performance Considerations

1. **Redis Caching**: Plans and usage are cached to reduce database load
2. **Async Usage Tracking**: Usage increment is fire-and-forget (non-blocking)
3. **MongoDB for Usage**: Counters scale better in MongoDB than MySQL
4. **Indexed Queries**: Compound indexes on userId + month for fast lookups

---

## Future Enhancements

1. **Stripe Integration**: Webhook handlers in `/admin/billing/webhooks`
2. **Usage Alerts**: Notify users at 80% quota
3. **Plan Upgrade Flow**: Self-service plan changes
4. **Invoice Generation**: PDF invoices for paid plans
5. **Usage Analytics**: Dashboard for admins to view system-wide usage

---

## Best Practices

### ✅ DO:
- Use `billingGuard` for countable resources (projects, API calls)
- Use `featureGuard` for boolean features (custom domain, team collaboration)
- Track usage immediately after successful operations
- Use `null` in limits for unlimited
- Cache plans in Redis
- Version plan changes

### ❌ DON'T:
- Put pricing logic in frontend
- Hardcode limits in code
- Add DB columns for every new feature
- Skip custom override support
- Forget to invalidate cache after plan updates

---

## Error Codes

| Code | Description |
|------|-------------|
| `QUOTA_EXCEEDED` | User has reached their plan limit |
| `FEATURE_NOT_AVAILABLE` | Feature not enabled in user's plan |
| `SUBSCRIPTION_NOT_FOUND` | User has no active subscription |
| `PLAN_NOT_FOUND` | Requested plan does not exist |
| `ADMIN_REQUIRED` | Admin access required for operation |

---

## Support

For questions or issues:
1. Check this documentation
2. Review code in `src/services/billing.service.ts`
3. Check middleware in `src/middlewares/billing.middleware.ts`
