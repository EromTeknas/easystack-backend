# 💳 Billing System - EasyStack Backend

> Complete plans, pricing, and usage tracking system

## 🎯 Quick Start (5 minutes)

```bash
# 1. Run database migration
npm run prisma:migrate dev

# 2. Regenerate Prisma client
npm run prisma:generate

# 3. Seed default plans (Free, Pro, Team, Enterprise)
npm run billing:seed

# 4. Assign free plan to existing users
npm run billing:assign-free

# 5. Start server
npm run dev
```

**✅ Done!** Billing system is now active.

---

## 🚀 Using in Your Code

### Protect a Route with Quota

```typescript
import { billingGuard, trackUsage } from '../middlewares/billing.middleware';

router.post('/projects',
  authenticate,
  billingGuard('projects'),           // ← Check quota
  trackUsage('projects', 1),          // ← Track usage
  createProject
);
```

### Require a Feature

```typescript
import { featureGuard } from '../middlewares/billing.middleware';

router.post('/custom-domain',
  authenticate,
  featureGuard('custom_domain'),      // ← Check feature
  setCustomDomain
);
```

### Check in Controller

```typescript
import { BillingService } from '../services/billing.service';

const check = await BillingService.canPerformAction(userId, 'projects');
if (!check.allowed) {
  throw new AppError('Quota exceeded', 403);
}
```

---

## 📊 Default Plans

| Plan | Projects | AI Tokens/mo | Price/mo |
|------|----------|--------------|----------|
| **Free** | 3 | 100K | $0 |
| **Pro** | 20 | 1M | $29 |
| **Team** | 100 | 5M | $99 |
| **Enterprise** | ∞ | ∞ | $499 |

---

## 🌐 API Endpoints

### User
```
GET  /api/billing/plans        Get all plans (public)
GET  /api/billing/my-plan      Get my plan + usage (auth)
```

### Admin
```
GET    /api/admin/billing/plans                      List plans
POST   /api/admin/billing/plans                      Create plan
PUT    /api/admin/billing/plans/:id                  Update plan
PATCH  /api/admin/billing/subscriptions/:userId      Update subscription
PATCH  /api/admin/billing/subscriptions/:userId/override  Custom override
```

---

## 🔧 Admin Operations

### Give User Unlimited Projects

```bash
PATCH /api/admin/billing/subscriptions/123/override
{
  "override": {
    "limits": {
      "projects": null  // null = unlimited
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

## 🎓 Feature Keys

```typescript
'projects'                    // Number of projects
'environments'                // Number of environments
'users'                       // Team size
'api_requests_per_minute'     // API rate limit
'storage_mb'                  // Storage quota
'ai_tokens_monthly'           // AI usage
'custom_domain'               // Boolean feature
'team_collaboration'          // Boolean feature
'audit_logs'                  // Boolean feature
```

---

## 📚 Full Documentation

- **[BILLING.md](documentation/BILLING.md)** - Complete guide
- **[BILLING_MIGRATION.md](documentation/BILLING_MIGRATION.md)** - Setup guide
- **[BILLING_QUICK_REF.md](documentation/BILLING_QUICK_REF.md)** - Quick reference
- **[BILLING_IMPLEMENTATION.md](BILLING_IMPLEMENTATION.md)** - What was built

---

## 🏗️ Architecture

```
┌─────────────────┐
│   MySQL/Prisma  │  Plans (JSON config)
│                 │  Subscriptions (user → plan)
│                 │  Plan Versions (history)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BillingService │  Plan resolver
│                 │  Usage tracking
│                 │  Quota checking
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Middleware    │  billingGuard()
│                 │  featureGuard()
│                 │  trackUsage()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Your Routes   │  Protected endpoints
└─────────────────┘

Cache Layer: Redis (5min plans, 1min usage)
Usage Storage: MongoDB (monthly counters)
```

---

## ⚡ Performance

- ✅ **Plans cached** in Redis (5 minutes)
- ✅ **Usage cached** in Redis (1 minute)
- ✅ **Async tracking** (non-blocking)
- ✅ **MongoDB counters** (better than MySQL)

---

## 🐛 Troubleshooting

### "No active subscription found"
```bash
# Assign free plan to user
npm run billing:assign-free
```

### "Free plan not found"
```bash
# Seed default plans
npm run billing:seed
```

### Check if everything works
```bash
# Get plans (should return 4 plans)
curl http://localhost:4000/api/billing/plans

# Get user's plan (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:4000/api/billing/my-plan
```

---

## 🎯 Key Benefits

### 1. **No Schema Hell**
Add features without database migrations - everything is JSON.

### 2. **Enterprise Ready**
Per-user custom overrides for special deals.

### 3. **Plan Versioning**
Track pricing changes over time.

### 4. **High Performance**
Redis caching + MongoDB counters = fast.

### 5. **Developer Friendly**
Simple middleware API, clear errors, full TypeScript support.

---

## 📦 What Was Created

- ✅ 3 database tables (plans, subscriptions, plan_versions)
- ✅ 1 MongoDB collection (usage tracking)
- ✅ 8 API endpoints (2 user, 6 admin)
- ✅ 4 middleware functions
- ✅ 1 service with 13 methods
- ✅ 4 default plans
- ✅ 2 CLI tools
- ✅ 4 documentation files
- ✅ Complete TypeScript types

---

## 💡 Examples

See [src/routes/projects/projects.routes.example.ts](src/routes/projects/projects.routes.example.ts) for:
- Simple quota checks
- Feature-based access
- Dynamic usage tracking
- Manual billing checks
- Batch operations

---

## 🚦 Next Steps

1. ✅ Add billing guards to your routes
2. ✅ Test quota enforcement
3. ✅ Build admin UI
4. ✅ Integrate Stripe for payments
5. ✅ Add usage alerts

---

## 📞 Support

- **Setup issues?** → [BILLING_MIGRATION.md](documentation/BILLING_MIGRATION.md)
- **How to use?** → [BILLING_QUICK_REF.md](documentation/BILLING_QUICK_REF.md)
- **Full details?** → [BILLING.md](documentation/BILLING.md)
- **What was built?** → [BILLING_IMPLEMENTATION.md](BILLING_IMPLEMENTATION.md)

---

**Built with ❤️ for EasyStack Backend**

[← Back to Main README](README.md)
