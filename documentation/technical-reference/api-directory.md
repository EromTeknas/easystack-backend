# Master API Directory

This document provides a comprehensive catalog of all API routes, HTTP methods, access controllers, security guards, and billing middlewares across the application.

Base Path: `/api`

---

## 1. Authentication Endpoints (`/api/auth`)

Mounted in [`src/routes/auth/auth.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/auth/auth.routes.ts).

| Method | Endpoint | Guards | Controller | Purpose |
|---|---|---|---|---|
| `POST` | `/register` | `authRateLimiter` | `registerController` | Create unverified user account, send 6-digit OTP |
| `POST` | `/verify-email` | `authRateLimiter` | `verifyEmailController` | Verify OTP, provision default workspace, issue JWT |
| `POST` | `/resend-otp` | `authRateLimiter` | `resendOtpController` | Generate and resend fresh OTP email |
| `POST` | `/login` | `authRateLimiter` | `loginController` | Password login, issue access & refresh cookies |
| `POST` | `/providers/google` | `authRateLimiter` | `googleLoginController` | Verify Google ID token, sign in or register |
| `POST` | `/providers/google/link` | `authenticate` | `linkGoogleController` | Link Google identity to authenticated user |
| `GET` | `/providers` | `authenticate` | `getAuthProvidersController` | List linked authentication providers |
| `DELETE` | `/providers/:provider` | `authenticate` | `unlinkProviderController` | Unlink auth provider (requires password set) |
| `POST` | `/link/password` | `authenticate` | `addPasswordController` | Add password to OAuth-only account |
| `POST` | `/forgot-password` | `authRateLimiter` | `forgotPasswordController` | Send password reset link to email |
| `POST` | `/reset-password` | `authRateLimiter` | `resetPasswordController` | Reset password using valid reset token |
| `GET` | `/sessions` | `authenticate` | `listSessionsController` | List user's active device sessions |
| `DELETE` | `/sessions/:sessionId` | `authenticate` | `revokeSessionController` | Revoke a specific device session |
| `POST` | `/sessions/revoke-others` | `authenticate` | `revokeOtherSessionsController`| Revoke all sessions except the current one |
| `POST` | `/refresh` | None (reads cookie) | `refreshController` | Rotate refresh token and issue new access token |
| `POST` | `/logout` | None (reads cookie) | `logoutController` | Revoke session and clear auth cookies |
| `GET` | `/me` | `authenticate` | `getMeController` | Get current user profile and accessible workspaces |

---

## 2. Workspace Endpoints (`/api/workspace`)

Mounted in [`src/routes/workspace/workspace.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/workspace/workspace.routes.ts).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `POST` | `/` | `authenticate` | Create a new workspace (creator becomes `WORKSPACE_OWNER`) |
| `GET` | `/` | `authenticate` | List all workspaces accessible by the authenticated user |
| `GET` | `/roles` | `authenticate` | List all system workspace roles |
| `GET` | `/project-roles` | `authenticate` | List all system project roles |
| `GET` | `/:workspaceId` | `authenticate` | Fetch workspace metadata |
| `PATCH` | `/:workspaceId` | `authenticate`, `authorize(WORKSPACE.UPDATE)` | Update workspace settings/name |
| `DELETE` | `/:workspaceId` | `authenticate`, `authorize(WORKSPACE.DELETE)` | Soft-delete workspace and trigger background cascade |
| `GET` | `/:workspaceId/billing` | `authenticate`, `authorize(WORKSPACE.READ)` | Get workspace subscription and billing status |
| `GET` | `/:workspaceId/members` | `authenticate`, `authorize(WORKSPACE.READ)` | List all active members in workspace |
| `GET` | `/:workspaceId/members/:userId` | `authenticate`, `authorize(WORKSPACE.MANAGE_MEMBERS)`| Get detailed member profile |
| `POST` | `/:workspaceId/invites` | `authenticate`, `authorize(WORKSPACE.INVITE)`, `billingMiddleware(members)` | Dispatch email invitation with roles |
| `GET` | `/:workspaceId/invites` | `authenticate`, `authorize(WORKSPACE.READ)` | List pending invitations |
| `DELETE` | `/:workspaceId/invites/:invitationId`| `authenticate`, `authorize(WORKSPACE.INVITE)` | Revoke pending invitation |
| `GET` | `/:workspaceId/invitation-context` | `authenticate`, `authorize(WORKSPACE.INVITE)` | Get invitation context |

---

## 3. Project Endpoints (`/api/projects`)

Mounted in [`src/routes/projects/projects.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/projects/projects.routes.ts).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/subdomain-available/:subdomain` | Public | Check if project subdomain is available |
| `GET` | `/subdomain/:subdomain` | Public | Look up project metadata by subdomain |
| `GET` | `/languages/supported` | Public | Get list of all supported ISO language codes |
| `POST` | `/` | `authenticate`, `authorize(PROJECT.CREATE)`, `billingMiddleware(projects)` | Create project with default environments & languages |
| `GET` | `/workspaces/:workspaceId` | `authenticate`, `authorize(WORKSPACE.READ)` | List projects in workspace |
| `GET` | `/:projectId` | `authenticate`, `authorize(PROJECT.READ)` | Get project by ID |
| `PUT` | `/:projectId` | `authenticate`, `authorize(PROJECT.UPDATE)`, `billingMiddleware` | Full project update |
| `PATCH` | `/:projectId` | `authenticate`, `authorize(PROJECT.UPDATE)`, `billingMiddleware` | Partial project update |
| `DELETE` | `/:projectId` | `authenticate`, `authorize(PROJECT.DELETE)`, `billingMiddleware` | Soft-delete project |
| `GET` | `/:projectId/languages` | `authenticate`, `authorize(PROJECT.READ)` | List project supported languages |
| `PUT` | `/:projectId/languages` | `authenticate`, `authorize(PROJECT.UPDATE)` | Update project supported languages |
| `GET` | `/:projectId/languages/history` | `authenticate`, `authorize(PROJECT.READ)` | Get language change history |
| `GET` | `/:projectId/members` | `authenticate`, `authorize(PROJECT_MEMBER.READ)` | List project members |
| `GET` | `/:projectId/members/search` | `authenticate`, `authorize(PROJECT_MEMBER.READ)` | Search project members |
| `POST` | `/:projectId/invitations` | `authenticate`, `authorize(PROJECT_MEMBER.INVITE)` | Invite user to project |
| `GET` | `/:projectId/invitable-users` | `authenticate`, `authorize(PROJECT.READ)` | Search workspace members not yet in project |
| `PATCH` | `/:projectId/members/:userId` | `authenticate`, `authorize(PROJECT_MEMBER.UPDATE)` | Update member's project role |
| `DELETE` | `/:projectId/members/:userId` | `authenticate`, `authorize(PROJECT_MEMBER.REMOVE)` | Remove member from project |
| `GET` | `/:projectId/roles` | `authenticate`, `authorize(PROJECT_MEMBER.READ)` | List available project roles |
| `GET` | `/:projectId/invitations` | `authenticate`, `authorize(PROJECT_MEMBER.READ)` | List pending project invitations |
| `DELETE` | `/:projectId/invitations/:invitationId`| `authenticate`, `authorize(PROJECT_MEMBER.INVITE)` | Revoke project invitation |
| `GET` | `/:projectId/environments` | `authenticate`, `authorize(ENVIRONMENT.READ)` | List project environments |
| `PATCH` | `/:projectId/environments/:environmentId`| `authenticate`, `authorize(ENVIRONMENT.UPDATE)` | Update environment settings |
| `GET` | `/:projectId/api-keys` | `authenticate`, `authorize(API_KEY.READ)` | List all API keys for project |
| `POST` | `/:projectId/api-keys` | `authenticate`, `authorize(API_KEY.CREATE)` | Generate new API key (returns raw key once) |
| `DELETE` | `/:projectId/api-keys/:apiKeyId` | `authenticate`, `authorize(API_KEY.REVOKE)` | Revoke API key and invalidate Redis cache |

---

## 4. Releases Endpoints (`/api/projects/:projectId/releases`)

Mounted in [`src/routes/releases/release.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/releases/release.routes.ts).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/diff` | `authenticate`, `authorize(RELEASE.READ)` | Diff source vs target environment schema blueprints |
| `GET` | `/suggest-version` | `authenticate`, `authorize(RELEASE.READ)` | Suggest SemVer bump (PATCH, MINOR, MAJOR) |
| `POST` | `/` | `authenticate`, `authorize(RELEASE.CREATE)` | Create release with frozen snapshots |
| `GET` | `/` | `authenticate`, `authorize(RELEASE.READ)` | List project releases |
| `GET` | `/:releaseId` | `authenticate`, `authorize(RELEASE.READ)` | Get release details and snapshots |
| `POST` | `/:releaseId/request-approval` | `authenticate`, `authorize(RELEASE.CREATE)` | Request administrative approval |
| `POST` | `/:releaseId/approve` | `authenticate`, `authorize(RELEASE.APPROVE)` | Approve release for deployment |
| `POST` | `/:releaseId/execute` | `authenticate`, `authorize(RELEASE.EXECUTE)` | Deploy release to target environment immediately |
| `POST` | `/:releaseId/schedule` | `authenticate`, `authorize(RELEASE.EXECUTE)` | Queue release for scheduled future deployment |
| `POST` | `/:releaseId/cancel-schedule`| `authenticate`, `authorize(RELEASE.EXECUTE)` | Cancel scheduled deployment |
| `POST` | `/:releaseId/rollback` | `authenticate`, `authorize(RELEASE.ROLLBACK)` | Revert environment to preceding release |
| `DELETE` | `/:releaseId` | `authenticate`, `authorize(RELEASE.DELETE)` | Delete release record |

---

## 5. Schemas & Content Endpoints

Mounted in [`src/routes/schemas/schema-blueprint.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/schemas/schema-blueprint.routes.ts) and [`src/routes/content/content-entry.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/content/content-entry.routes.ts).

### Schemas (`/api/projects/:projectId/schemas`)
- `GET /`: List schema blueprints
- `GET /staged-deletions`: List blueprints staged for deletion
- `GET /check-slug`: Verify schema slug availability
- `GET /:schemaId`: Get blueprint details
- `POST /`: Create schema blueprint
- `PUT /:schemaId`: Update blueprint fields and validation
- `DELETE /:schemaId`: Delete blueprint (stages if deployed to higher envs, or soft-deletes)
- `POST /:schemaId/restore`: Restore staged blueprint back to Development
- `POST /:schemaId/deploy`: Deploy blueprint version to environment

### Content (`/api/projects/:projectId/content`)
- `POST /sync-environments`: Sync content across environments
- `GET /:schemaSlug`: List content entries under schema
- `GET /:schemaSlug/check-slug`: Check entry slug availability
- `GET /:schemaSlug/:entryId`: Get content entry
- `POST /:schemaSlug`: Create content entry draft
- `PUT /:schemaSlug/:entryId`: Update content entry draft
- `DELETE /:schemaSlug/:entryId`: Delete content entry
- `POST /:schemaSlug/:entryId/publish`: Publish content entry (supports syncToEnvIds)
- `POST /:schemaSlug/:entryId/sync`: Sync individual entry across environments
- `GET /:schemaSlug/:entryId/audit-logs`: Get content entry audit logs

### Projects (`/api/projects`)
- `GET /:projectId/summary`: Get aggregated project home overview, metrics, and editorial shortcuts
- `GET /:projectId/usage`: Get project plan usage and resource limits

### Media Assets (`/api/projects/:projectId/assets`)

Mounted in [`src/routes/assets/assets.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/assets/assets.routes.ts).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/` | `authenticate`, `authorize(asset:read)` | Paginated project media assets with search & type filter |
| `POST` | `/upload-intent` | `authenticate`, `authorize(asset:create)` | Initiate presigned S3 POST upload with quota validation |
| `POST` | `/complete` | `authenticate`, `authorize(asset:create)` | Complete upload, verify S3 object, persist `ProjectAsset` |
| `GET` | `/usage` | `authenticate`, `authorize(asset:read)` | Query storage usage (bytes used, quota limit, percentage) |
| `GET` | `/:assetId` | `authenticate`, `authorize(asset:read)` | Get media asset details by ID |
| `PATCH` | `/:assetId` | `authenticate`, `authorize(asset:update)` | Update media metadata (alt text, caption) |
| `DELETE` | `/:assetId` | `authenticate`, `authorize(asset:delete)` | Soft-delete asset (`removedAt`) & schedule S3 cleanup |

---

## 6. Storage Endpoints (`/api/storage`)

Mounted in [`src/routes/storage/storage.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/storage/storage.routes.ts).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/s3` | Public | S3 connectivity check |
| `POST` | `/upload-intents` | `authenticate` | Create upload intent and generate presigned POST policy |
| `POST` | `/upload-intents/:uploadId/complete`| `authenticate` | Complete upload and verify file in S3 |
| `GET` | `/demo/presets` | `authenticate` | List storage preset configurations |
| `POST` | `/demo/upload-intents` | `authenticate` | Create demo upload intent |
| `POST` | `/demo/upload-intents/:uploadId/complete`| `authenticate` | Complete demo upload |
| `GET` | `/demo/assets` | `authenticate` | Resolve demo asset URLs |
| `DELETE` | `/demo/assets/:assetId` | `authenticate` | Delete demo asset |

---

## 7. Billing Endpoints (`/api/billing` & `/api/public/billing`)

- `GET /api/public/billing/plans`: Public available subscription plan catalog.
- `GET /api/billing/workspaces/:workspaceId/my-plan`: Get workspace subscription, version, and quota usage.
- `POST /api/billing/webhook/:gateway`: Payment gateway webhook receiver (Stripe).

---

## 8. Public Invitations & User Endpoints

- `GET /api/public/invitations/:token`: Public invitation lookup (unauthenticated).
- `GET /api/user/profile`: Get current authenticated user profile including avatarUrl (`authenticate`).
- `PATCH /api/user/profile`: Update user profile details (firstName, lastName, avatarUrl) (`authenticate`).
- `GET /api/user/search`: Exact-match email user lookup (`authenticate`).
- `GET /api/user/invites`: List user invites (`authenticate`).
- `POST /api/user/invites/accept-by-token`: Accept invite via token (`authenticate`).
- `POST /api/user/invites/:invitationId/respond`: Accept or reject invite (`authenticate`).

---

## 9. Operational & Queue Endpoints

- `GET /api/health`: Health status.
- `GET /api/hello`: Simple ping.
- `GET /admin/queues`: Bull-board web UI for monitoring background queues.

---

## 11. Content Delivery Endpoints (`Delivery API - Port 3005`)

Mounted in [`src/delivery/routes/index.ts`](file:///home/eteknas/Projects/easystack-backend/src/delivery/routes/index.ts).
Runs as an independent server process (`src/delivery.server.ts`). Requires header-only API key authentication (`x-api-key` or `Authorization: Bearer <key>`).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Unauthenticated health probe for load balancers |
| `GET` | `/v1/test` | `apiKeyAuthMiddleware` | Validate API key connection and verify project/environment binding |
| `GET` | `/v1/content/:blueprintSlug` | `apiKeyAuthMiddleware` | Fetch singleton content or paginated collection list (supports `?page=`, `?limit=`, `?locale=`, `?search=`, `?sort=`) |
| `GET` | `/v1/content/:blueprintSlug/:entrySlug` | `apiKeyAuthMiddleware` | Fetch single entry from collection with optional locale fallback (`?locale=`) |
