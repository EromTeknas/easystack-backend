# Billing & Quota Enforcement Module

## 1. Purpose & Responsibilities

The **Billing & Quota Enforcement Module** manages SaaS subscription tiers, plan versions, feature gates, usage metering, and payment gateway synchronizations (Stripe). Subscriptions in EasyStack are tied strictly to **Workspaces** (tenants), not individual users.

### Core Responsibilities
- Maintain plan catalog and immutable plan version histories in MySQL via Prisma (`Plan`, `PlanVersion`).
- Enforce feature flags and quota consumption via the Express `billingMiddleware`.
- Track real-time quota usage across key metrics (`projects`, `members`, `environments`, `storage_mb`, `api_requests`, `ai_tokens`).
- Manage recurring quota resets via scheduled jobs ([`src/services/billing/jobs/quota-reset.job.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/billing/jobs/quota-reset.job.ts)).
- Synchronize customer subscriptions and invoices via payment gateway webhooks (Stripe).
- Cache billing context in Redis (`billing:context:<workspaceId>`) to prevent database overhead on metered API calls.

---

## 2. File Responsibility Map

```text
src/
├── routes/
│   ├── billing/
│   │   ├── billing.routes.ts           # Mounted at /api/billing
│   │   ├── billing.controller.ts      # Workspace plan & subscription endpoints
│   │   └── webhook.route.ts            # Stripe webhook handler: POST /api/billing/webhook/:gateway
│   └── public/billing/
│       ├── billing.routes.ts           # Public route: GET /api/public/billing/plans
│       └── billing.controller.ts      # Public plan catalog listing
│
├── services/billing/
│   ├── index.ts                        # Module entrypoint exporting services and middleware
│   ├── services/
│   │   ├── billing.service.ts          # High-level facade for workspace billing context
│   │   ├── subscription.service.ts     # Workspace plan assignment, trials, cancellations
│   │   ├── quota.service.ts            # Quota allocation, balance check, consumption
│   │   ├── usage.service.ts            # Usage counter increments and ledger tracking
│   │   ├── plan.service.ts             # Plan definitions and version resolution
│   │   ├── feature.service.ts          # Feature flag verification
│   │   └── reset.service.ts            # Quota reset engine for billing cycles
│   ├── middleware/express/
│   │   └── billing.middleware.ts       # billingMiddleware(workspaceIdFn, options) guard
│   ├── config/
│   │   ├── quotas.config.ts            # Quotas dictionary (key, type, resetPolicy, defaultLimit)
│   │   ├── plans.config.ts             # Default plan definitions (Free, Pro, Enterprise)
│   │   └── features.config.ts          # Feature keys
│   ├── cache/
│   │   ├── billing.context.service.ts  # Redis cache for workspace billing state
│   │   └── billing.lock.service.ts     # Distributed locks preventing race conditions in usage
│   ├── payment/
│   │   ├── payment.service.ts          # Checkout sessions, customer portal links
│   │   └── stripe.adapter.ts           # Stripe SDK wrapper & webhook signature validation
│   └── repositories/
│       ├── plan.repository.ts          # Prisma Plan & PlanVersion queries
│       ├── subscription.repository.ts  # Prisma Subscription queries
│       ├── quota.repository.ts         # Prisma PlanQuota queries
│       └── usage.repository.ts         # Usage record persistence
```

---

## 3. Subscription Data Models (Prisma)

Subscriptions are attached to Workspaces via a strict 1-to-1 relation:

```mermaid
erDiagram
    WORKSPACE ||--|| SUBSCRIPTION : billed_under
    PLAN ||--o{ PLAN_VERSION : versions
    PLAN_VERSION ||--o{ PLAN_QUOTA : limits
    PLAN_VERSION ||--o{ PLAN_FEATURE : enables
    PLAN_VERSION ||--o{ SUBSCRIPTION : assigns
    SUBSCRIPTION ||--o{ PAYMENT : records
    SUBSCRIPTION ||--o{ INVOICE : receives
```

- **`Subscription`**: Holds `workspaceId` (unique), `planVersionId`, `status` (`TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED`), `gatewayCustomerId`, and `gatewaySubscriptionId`.
- **`PlanVersion`**: Immutable snapshot of plan pricing, features, and quotas. Existing tenant subscriptions remain pinned to their version even if a plan's prices change.

---

## 4. `billingMiddleware` Enforcement

The `billingMiddleware` ([`src/services/billing/middleware/express/billing.middleware.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/billing/middleware/express/billing.middleware.ts)) gates endpoints based on plan limits.

### Usage in Routes
```typescript
router.post(
  '/',
  authenticate,
  authorize({ scope: 'workspace', permission: PERMISSIONS.PROJECT.CREATE, scopeId: req => req.body.workspaceId }),
  billingMiddleware(
    req => Number(req.body.workspaceId),
    {
      subscription: true, // Requires ACTIVE or TRIAL subscription
      quotas: [
        {
          key: Quotas.PROJECTS.key,
          amount: 1,
          consume: true, // Atomically increments usage if request succeeds
        }
      ]
    }
  ),
  createProject
);
```

### Quota Metrics
- `projects`: Total active projects in workspace (`scope: 'WORKSPACE'`).
- `members`: Total team members in workspace (`scope: 'WORKSPACE'`).
- `asset_storage_mb`: Media assets storage per project (`scope: 'PROJECT'`). Free: 50 MB, Pro: 2048 MB.
- `environments_per_project`: Environments permitted per project (`scope: 'PROJECT'`). Free: 2, Pro: 5. Default projects initialize with 2 environments (`development` rank 10, `live` rank 50).
- `blueprints_per_project`: Total content blueprints permitted per project (`scope: 'PROJECT'`). Free: 5, Pro: 30.
- `data_entries_per_project`: Total content entries across blueprints permitted per project (`scope: 'PROJECT'`). Free: 100, Pro: 5000.
- `storage.gb`: Total workspace storage across S3 (`scope: 'WORKSPACE'`).
- `api.requests.daily`: Metered API calls per day (`scope: 'WORKSPACE'`).

---

## 5. Dynamic Quota Discovery & Scoped Usage

To ensure that any new plan field across any scope (`WORKSPACE` or `PROJECT`) automatically reflects across both billing settings and project usage screens:

1. **Source of Truth Code Seeding (`BillingBuilder.build`)**:
   - `BillingBuilder` pre-populates baseline plan quotas from `PlanRegistry` (`FreePlan`, `ProPlan`, `EnterprisePlan`) before applying database custom overrides.
   - Any new quota added to plan definitions in code immediately reflects in the Redis billing cache (`cache.quotas`) without requiring manual database migration or re-seeding.

2. **Rich Quota Details API (`BillingService.getQuotaDetails`)**:
   - Endpoints returning billing details (`GET /api/workspace/:workspaceId/billing`) provide a dynamic `quotaDetails` array including `key`, `displayName`, `description`, `unit`, `scope` (`WORKSPACE` | `PROJECT`), `limit`, and `used`.
   - For `WORKSPACE`-scoped quotas (`projects`, `members`, `storage.gb`), `BillingBuilder` computes live, ground-truth metrics directly from active database records (`removedAt: null`).
   - For `PROJECT`-scoped quotas (`environments_per_project`, `blueprints_per_project`, `data_entries_per_project`, `asset_storage_mb`), `BillingService.getQuotaDetails` aggregates total usage across all projects in the workspace while providing the per-project limit.
   - The frontend consumes `quotaDetails` directly, rendering human-friendly labels (e.g. "Asset Storage" instead of unformatted keys), displaying workspace usage progress bars, and showing per-project limits along with workspace totals.

3. **Dynamic Project Usage Engine (`ProjectService.getProjectUsage`)**:
   - `getProjectUsage` dynamically iterates over all quotas configured on the workspace plan where `scope === 'PROJECT'`.
   - Each project quota is resolved via metric resolvers (e.g., `environments_per_project`, `blueprints_per_project`, `data_entries_per_project`, `asset_storage_mb`) or scoped usage ledgers (`scopedUsage`).
   - Returns a dynamic `resources` array consumed by the frontend Project Usage page, ensuring any future project-scoped quota automatically renders.


