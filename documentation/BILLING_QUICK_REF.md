# Billing System - Quick Reference

## 🚀 Quick Start

```bash
# 1. Run migration
npm run prisma:migrate dev

# 2. Seed default plans
npm run billing:seed

# 3. Assign free plan to existing users
npm run billing:assign-free
```

---

## 📦 Import Statements

```typescript
// Middleware
import { billingGuard, featureGuard, trackUsage } from '../middlewares/billing.middleware';

// Service
import { BillingService } from '../services/billing.service';

// Types
import type { EffectivePlan, UsageData, PlanConfig } from '../types/billing';

// Constants
import { FEATURE_KEYS, PLAN_NAMES } from '../constants/billing';
```

---

## 🛡️ Middleware Usage

### Quota Check (billingGuard)
```typescript
// Protects routes based on plan limits
router.post('/projects', 
  authenticate,
  billingGuard('projects'),
  createProject
);
```

### Feature Check (featureGuard)
```typescript
// Requires specific feature in plan
router.post('/custom-domain',
  authenticate,
  featureGuard('custom_domain'),
  setCustomDomain
);
```

### Usage Tracking (trackUsage)
```typescript
// Static amount
trackUsage('projects', 1)

// Dynamic amount
trackUsage('ai_tokens', (req) => req.body.estimatedTokens)
```

### Combined Example
```typescript
router.post('/ai/generate',
  authenticate,
  billingGuard('ai_tokens_monthly'),
  trackUsage('ai_tokens_monthly', (req) => req.body.tokens),
  generateAI
);
```

---

## 🔧 Service Methods

### Get User's Plan
```typescript
const plan = await BillingService.getEffectivePlan(userId);
// Returns: { id, name, displayName, config }
```

### Get User's Usage
```typescript
const usage = await BillingService.getUserUsage(userId);
// Returns: { projects: 5, ai_tokens: 10000, ... }
```

### Check if Action Allowed
```typescript
const check = await BillingService.canPerformAction(userId, 'projects');
// Returns: { allowed: true, limit: 3, used: 2, remaining: 1 }
```

### Check Feature
```typescript
const hasFeature = await BillingService.hasFeature(userId, 'custom_domain');
// Returns: boolean
```

### Track Usage Manually
```typescript
await BillingService.incrementUsage(userId, 'projects', 1);
```

### Create Free Subscription
```typescript
await BillingService.createFreeSubscription(userId);
```

---

## 📋 Feature Keys

```typescript
FEATURE_KEYS = {
  PROJECTS: 'projects',
  ENVIRONMENTS: 'environments',
  USERS: 'users',
  API_REQUESTS_PER_MINUTE: 'api_requests_per_minute',
  STORAGE_MB: 'storage_mb',
  AI_TOKENS_MONTHLY: 'ai_tokens_monthly',
  CUSTOM_DOMAIN: 'custom_domain',
  TEAM_COLLABORATION: 'team_collaboration',
  AUDIT_LOGS: 'audit_logs',
}
```

---

## 🌐 API Endpoints

### User Endpoints
```
GET  /api/billing/plans        - All available plans (public)
GET  /api/billing/my-plan      - Current user's plan + usage (auth)
```

### Admin Endpoints
Internal EasyStack admin dashboard (auth placeholder)
```
GET    /api/admin/billing/plans
POST   /api/admin/billing/plans
PUT    /api/admin/billing/plans/:id
GET    /api/admin/billing/subscriptions/:userId
PATCH  /api/admin/billing/subscriptions/:userId
PATCH  /api/admin/billing/subscriptions/:userId/override
```

---

## 💾 Plan Config Structure

```json
{
  "limits": {
    "projects": 3,              // number or null (unlimited)
    "environments": 1,
    "users": 1,
    "api_requests_per_minute": 60,
    "storage_mb": 500,
    "ai_tokens_monthly": 100000
  },
  "features": {
    "custom_domain": false,     // boolean
    "team_collaboration": false,
    "audit_logs": false
  },
  "pricing": {
    "monthly": 0,               // USD
    "yearly": 0,
    "currency": "USD"
  }
}
```

---

## 🎯 Common Patterns

### Pattern 1: Create Resource
```typescript
router.post('/',
  authenticate,
  billingGuard('projects'),
  trackUsage('projects', 1),
  createResource
);
```

### Pattern 2: Feature-Gated Action
```typescript
router.post('/premium-action',
  authenticate,
  featureGuard('premium_feature'),
  doAction
);
```

### Pattern 3: Batch Operations
```typescript
const check = await BillingService.canPerformAction(userId, 'projects');
if (check.remaining < items.length) {
  throw new AppError('Quota exceeded');
}
await BillingService.incrementUsage(userId, 'projects', items.length);
```

### Pattern 4: Conditional Features
```typescript
const hasPremium = await BillingService.hasFeature(userId, 'premium');
if (hasPremium) {
  // Premium logic
} else {
  // Free tier logic
}
```

---

## 🔍 Error Responses

### Quota Exceeded
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

### Feature Not Available
```json
{
  "success": false,
  "error": {
    "message": "Feature 'custom_domain' is not available in your plan",
    "code": "FEATURE_NOT_AVAILABLE",
    "statusCode": 403,
    "details": {
      "feature": "custom_domain"
    }
  }
}
```

---

## 🔧 Admin Operations

### Create Custom Plan
```bash
POST /api/admin/billing/plans
{
  "name": "startup",
  "displayName": "Startup",
  "config": { ... }
}
```

### Give User Unlimited
```bash
PATCH /api/admin/billing/subscriptions/123/override
{
  "override": {
    "limits": {
      "projects": null
    }
  }
}
```

### Change User's Plan
```bash
PATCH /api/admin/billing/subscriptions/123
{
  "planId": "pro-plan-uuid",
  "status": "ACTIVE"
}
```

---

## 📊 Default Plans

| Plan | Projects | Envs | Users | AI Tokens/mo | Price/mo |
|------|----------|------|-------|--------------|----------|
| Free | 3 | 1 | 1 | 100K | $0 |
| Pro | 20 | 5 | 3 | 1M | $29 |
| Team | 100 | 20 | 10 | 5M | $99 |
| Enterprise | ∞ | ∞ | ∞ | ∞ | $499 |

---

## ⚡ Performance Tips

1. **Plans are cached**: 5 minutes in Redis
2. **Usage is cached**: 1 minute in Redis
3. **Tracking is async**: Doesn't block responses
4. **MongoDB for counters**: Better than MySQL for frequent updates

---

## 🐛 Troubleshooting

```bash
# Check if plans exist
curl http://localhost:4000/api/billing/plans

# Check if user has subscription
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:4000/api/billing/my-plan

# Reseed plans
npm run billing:seed

# Assign free plans to users
npm run billing:assign-free
```

---

## 📚 Full Documentation

See [BILLING.md](BILLING.md) for complete documentation.
