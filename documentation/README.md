# EasyStack Backend — AI Knowledge Base & Master Index

> **Primary AI Entry Point**: This document is the central architectural index for Antigravity, Google Gemini, and autonomous AI coding agents. Read this file first before inspecting raw source code.

---

## 1. What EasyStack Backend Does

**EasyStack** is an enterprise multi-tenant headless CMS, structured JSON feed localization platform, and environment release orchestration backend.

### Key Capabilities
1. **Multi-Tenant Scoping**: Users own or join **Workspaces** (root billing boundary), which contain multiple **Projects** (isolated application resources) partitioned into multi-tier **Environments** (`development`, `staging`, `production`).
2. **Dynamic JSON Feeds & Schema Blueprints**: Authors define arbitrary JSON feeds or strict schema blueprints validated for structural depth, homogeneity, and wildcard targeting (`selectedKeys`).
3. **Automated & Human-in-the-Loop Localization**: Translates JSON feeds across dozens of languages via LLM providers (Gemini) with PR-style review threads, reviewer voting, and automatic approval resets upon content edits.
4. **Environment Release Pipeline**: Freezes immutable feed snapshots, computes semantic environment diffs, recommends SemVer version increments, and executes atomic or scheduled environment deployments.
5. **Intent-Based Object Storage**: Issues presigned S3 POST policies for direct browser-to-S3 uploads, resolves public CDN or signed private URLs, and cleans orphaned uploads with background workers.
6. **Hierarchical RBAC**: Two-tiered authorization (Workspace & Project scopes) backed by a compiled Redis cache (`authorization:v1:<userId>`) with implicit administrative inheritance.
7. **SaaS Quota Metering**: Express middleware gating operations against plan limits (projects, members, API calls, storage bytes, AI tokens) with Stripe webhook synchronization.

---

## 2. Technology Stack & Storage Roles

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         Express 5.2 (TypeScript)                         │
│   authenticate ──> authorize (Redis) ──> billingMiddleware (MySQL/Redis) │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┬─────────────────────┐
       ▼                      ▼                      ▼                     ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐      ┌──────────────┐
│ MySQL/Prisma │       │ MongoDB      │       │ Redis        │      │ AWS S3/MinIO │
│ Relational   │       │ Document     │       │ In-Memory    │      │ Object Blobs │
│ Workspaces,  │       │ Feeds,       │       │ Auth Cache,  │      │ Direct       │
│ Projects,    │       │ Content,     │       │ Ephemeral    │      │ Uploads,     │
│ RBAC,        │       │ Comments,    │       │ OTPs,        │      │ CDN delivery │
│ Billing,     │       │ Versions,    │       │ BullMQ       │      │              │
│ Users        │       │ Audit Logs   │       │ Queues       │      │              │
└──────────────┘       └──────────────┘       └──────────────┘      └──────────────┘
```

---

## 3. Decision-Oriented Navigation ("Where Do I Look?")

Use this lookup matrix to jump directly to the documentation, controllers, and services needed for common development and debugging tasks:

| Question / Task | What to Read | Implementation Source Files |
|---|---|---|
| **Modify Authentication or Tokens?** | [`modules/authentication.md`](modules/authentication.md)<br>[`workflows/auth-and-onboarding.md`](workflows/auth-and-onboarding.md) | `src/services/authentication/`<br>`src/routes/auth/` |
| **Add or Modify a Route?** | [`development/architectural-patterns.md`](development/architectural-patterns.md)<br>[`technical-reference/api-directory.md`](technical-reference/api-directory.md) | `src/routes/`<br>`src/routes/index.ts` |
| **Change Roles or Permissions?** | [`modules/authorization.md`](modules/authorization.md)<br>[`architecture/rbac-and-security.md`](architecture/rbac-and-security.md) | `src/services/authorization/configs/`<br>`src/services/authorization/repositories/` |
| **Debug Authorization Denials (403)?** | [`workflows/authorization-cache-lifecycle.md`](workflows/authorization-cache-lifecycle.md) | `src/services/authorization/middlewares/authorize.middleware.ts`<br>`src/services/authorization/services/buid-cache.service.ts` |
| **Modify Feeds or JSON Validation?** | [`modules/feeds-and-localization.md`](modules/feeds-and-localization.md)<br>[`workflows/feed-localization-pipeline.md`](workflows/feed-localization-pipeline.md) | `src/services/feed.service.ts`<br>`src/services/json-validation.service.ts` |
| **Modify AI Auto-Translation?** | [`modules/feeds-and-localization.md`](modules/feeds-and-localization.md)<br>[`modules/workers-and-queues.md`](modules/workers-and-queues.md) | `src/services/llm.service.ts`<br>`src/services/feed/infrastructure/queue/` |
| **Modify Translation Review / PRs?** | [`modules/collaboration.md`](modules/collaboration.md)<br>[`workflows/translation-review-lifecycle.md`](workflows/translation-review-lifecycle.md) | `src/services/collaboration.service.ts`<br>`src/models/feed-comment.model.ts` |
| **Add or Modify Content Schemas?** | [`modules/content-and-schemas.md`](modules/content-and-schemas.md) | `src/services/content-entry.service.ts`<br>`src/services/schema-blueprint.service.ts` |
| **Modify Releases & Deployments?** | [`modules/releases.md`](modules/releases.md)<br>[`workflows/release-deployment-pipeline.md`](workflows/release-deployment-pipeline.md) | `src/services/release.service.ts`<br>`src/services/releases/infrastructure/queue/` |
| **Add or Modify File Uploads?** | [`modules/storage.md`](modules/storage.md)<br>[`workflows/storage-upload-lifecycle.md`](workflows/storage-upload-lifecycle.md) | `src/services/storage/`<br>`src/routes/storage/` |
| **Add Quotas or Modify Billing?** | [`modules/billing.md`](modules/billing.md)<br>[`workflows/billing-quota-enforcement.md`](workflows/billing-quota-enforcement.md) | `src/services/billing/config/quotas.config.ts`<br>`src/services/billing/middleware/express/billing.middleware.ts` |
| **Add Background Jobs or Workers?** | [`modules/workers-and-queues.md`](modules/workers-and-queues.md) | `src/workers/registry.ts`<br>`src/infrastructure/queue/` |
| **Add Environment Variables?** | [`technical-reference/configuration.md`](technical-reference/configuration.md) | `src/config/env.ts`<br>`src/config/` |
| **Create a Database Migration?** | [`development/database-migrations.md`](development/database-migrations.md) | `prisma/schema.prisma`<br>`prisma/migrations/` |
| **Handle Errors or Custom Statuses?** | [`technical-reference/error-handling.md`](technical-reference/error-handling.md) | `src/errors/AppError.ts`<br>`src/constants/errorCodes.ts` |

---

## 4. Documentation Knowledge Base Structure

```text
documentation/
├── README.md                                  # [Layer A] Master Index & AI Entry Point
├── INDEX.md                                   # Pointer / Forwarding reference
├── MAINTENANCE.md                             # AI Agent documentation maintenance rules
│
├── architecture/                              # [Layer B] System Architecture
│   ├── system-overview.md                    # Core architecture, tech stack, 4-layer enforcement
│   ├── polyglot-persistence.md               # Storage roles: MySQL, MongoDB, Redis, S3/MinIO
│   ├── rbac-and-security.md                  # RBAC engine, Redis cache, implicit inheritance
│   └── diagrams.md                           # Master Mermaid diagrams (topology, ERD, flows)
│
├── modules/                                   # [Layer C] Module Implementation Reference
│   ├── authentication.md                     # Local auth, Google OAuth, tokens, sessions, OTP
│   ├── authorization.md                      # Roles, permissions, cache builder, authorize guard
│   ├── tenancy.md                            # Workspaces, Projects, Environments, Invitations
│   ├── feeds-and-localization.md             # Feeds, JSON validation, wildcarding, AI translation
│   ├── content-and-schemas.md                # Schema blueprints, versions, content entries
│   ├── releases.md                           # Environment diffs, approvals, scheduled deploys
│   ├── collaboration.md                      # PR-style translation reviews, comments, approval reset
│   ├── billing.md                            # Workspace plans, quotas, usage tracking, Stripe
│   ├── storage.md                            # Intent-based uploads, presigned POST, CDN, cleanup
│   └── workers-and-queues.md                 # 5 BullMQ worker groups, schedules, Bull-board
│
├── workflows/                                 # [Layer D] End-to-End Execution Traces
│   ├── auth-and-onboarding.md                # Registration -> OTP -> Provisioning -> Sessions
│   ├── project-and-invitations.md            # Project creation -> Workspace/Project invite lifecycle
│   ├── feed-localization-pipeline.md         # JSON edit -> Validation -> Translation queue -> Worker
│   ├── translation-review-lifecycle.md       # PR review thread -> Voting -> Edit reset -> System msg
│   ├── release-deployment-pipeline.md        # Environment snapshot -> Approval -> Worker execution
│   ├── storage-upload-lifecycle.md           # Upload intent -> Presigned POST -> S3 -> Complete -> GC
│   ├── billing-quota-enforcement.md          # Middleware check -> Quota consumption -> Stripe webhook
│   └── authorization-cache-lifecycle.md      # Request -> Redis check -> Cache build -> Mutation evict
│
├── technical-reference/                       # [Layer E] Technical Reference
│   ├── api-directory.md                      # Complete catalog of all API routes, methods & guards
│   ├── polyglot-schema-reference.md          # Prisma models, Mongo schemas, Redis key index
│   ├── error-handling.md                     # AppError hierarchy, status codes, standard response
│   ├── configuration.md                      # Centralized config in src/config/, env vars, Zod
│   ├── database-transactions.md              # Prisma interactive transactions, ACID rules
│   └── testing-guide.md                      # Native test runner, RBAC test suite, mocks
│
├── development/                               # [Layer F] Development Reference
│   ├── local-setup.md                        # Prerequisites, local databases, MinIO, bootstrap
│   ├── development-workflow.md               # npm run dev, running workers, Bull-board, debugging
│   ├── database-migrations.md                # Prisma migration workflows, commands, seeders
│   └── architectural-patterns.md             # 4-layer pattern (Route->Controller->Service->Repo)
│
└── reference/
    ├── planned-features.md                   # Pending features (In-app notifications, customer portal)
    └── demo/
        └── storage-demo.html                 # Storage upload testing demo asset
```

---

## 5. Reading Guide for Specific Tasks

- **Before implementing a new feature**: Read [`development/architectural-patterns.md`](development/architectural-patterns.md) and the relevant module in `modules/`.
- **Before fixing a bug**: Read [`technical-reference/error-handling.md`](technical-reference/error-handling.md) and the end-to-end trace in `workflows/`.
- **Before writing database queries**: Read [`architecture/polyglot-persistence.md`](architecture/polyglot-persistence.md) and [`technical-reference/database-transactions.md`](technical-reference/database-transactions.md).
- **Before modifying permissions**: Read [`architecture/rbac-and-security.md`](architecture/rbac-and-security.md) and [`modules/authorization.md`](modules/authorization.md).
