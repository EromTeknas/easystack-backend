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

---

## 4. Feeds & Collaboration Endpoints (Decommissioned)

> [!NOTE]
> The legacy `/api/projects/:projectId/feeds` router has been unmounted from [`src/routes/projects/projects.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/projects/projects.routes.ts) in favor of the flexible Schema Blueprints (`/api/projects/:projectId/schemas`) and Content Engine (`/api/projects/:projectId/content`).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/` | `authenticate`, `authorize(FEED.READ)` | List feeds in project |
| `POST` | `/` | `authenticate`, `authorize(FEED.CREATE)` | Create new feed |
| `GET` | `/:feedId` | `authenticate`, `authorize(FEED.READ)` | Get feed details |
| `GET` | `/:feedId/draft` | `authenticate`, `authorize(FEED.READ)` | Get active draft content for feed |
| `PUT` | `/:feedId/draft` | `authenticate`, `authorize(FEED.UPDATE)` | Update base content in draft environment |
| `POST` | `/:feedId/publish` | `authenticate`, `authorize(FEED.PUBLISH)` | Promote draft to published in environment |
| `POST` | `/:feedId/auto-translate` | `authenticate`, `authorize(FEED.UPDATE)` | Enqueue AI translation batch job |
| `GET` | `/:feedId/translations` | `authenticate`, `authorize(FEED.READ)` | List all language translations for feed |
| `GET` | `/:feedId/translations/:lang` | `authenticate`, `authorize(FEED.READ)` | Get localized JSON for specific language |
| `PUT` | `/:feedId/translations/:lang` | `authenticate`, `authorize(FEED.UPDATE)` | Save manual translation (triggers approval reset) |
| `POST` | `/:feedId/translations/:lang/mark-correct` | `authenticate`, `authorize(FEED.UPDATE)` | Mark STALE translation COMPLETED without changes |
| `GET` | `/:feedId/audit-logs` | `authenticate`, `authorize(FEED.READ)` | Paginated feed change history |
| `POST` | `/:feedId/translations/:lang/review-request` | `authenticate`, `authorize(FEED.UPDATE)` | Request PR-style review |
| `POST` | `/:feedId/translations/:lang/reviews/:reviewId/approve` | `authenticate`, `authorize(FEED.UPDATE)` | Approve active review |
| `POST` | `/:feedId/translations/:lang/reviews/:reviewId/close` | `authenticate`, `authorize(FEED.UPDATE)` | Close active review thread |
| `POST` | `/:feedId/translations/:lang/comments` | `authenticate`, `authorize(FEED.READ)` | Post comment or reply in review thread |
| `GET` | `/:feedId/translations/:lang/comments` | `authenticate`, `authorize(FEED.READ)` | Get comment thread messages |

---

## 5. Releases Endpoints (`/api/projects/:projectId/releases`)

Mounted in [`src/routes/releases/release.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/releases/release.routes.ts).

| Method | Endpoint | Guards | Purpose |
|---|---|---|---|
| `GET` | `/diff` | `authenticate`, `authorize(RELEASE.READ)` | Diff source vs target environment feeds |
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

## 6. Schemas & Content Endpoints

Mounted in [`src/routes/schemas/schema-blueprint.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/schemas/schema-blueprint.routes.ts) and [`src/routes/content/content-entry.routes.ts`](file:///home/eteknas/Projects/easystack-backend/src/routes/content/content-entry.routes.ts).

### Schemas (`/api/projects/:projectId/schemas`)
- `GET /`: List schema blueprints
- `GET /check-slug`: Verify schema slug availability
- `GET /:schemaId`: Get blueprint details
- `POST /`: Create schema blueprint
- `PUT /:schemaId`: Update blueprint fields and validation
- `DELETE /:schemaId`: Delete schema blueprint
- `POST /:schemaId/deploy`: Deploy blueprint version to environment

### Content (`/api/projects/:projectId/content`)
- `POST /sync-environments`: Sync content across environments
- `GET /:schemaSlug`: List content entries under schema
- `GET /:schemaSlug/check-slug`: Check entry slug availability
- `GET /:schemaSlug/:entryId`: Get content entry
- `POST /:schemaSlug`: Create content entry draft
- `PUT /:schemaSlug/:entryId`: Update content entry draft
- `DELETE /:schemaSlug/:entryId`: Delete content entry
- `POST /:schemaSlug/:entryId/publish`: Publish content entry
- `GET /:schemaSlug/:entryId/audit-logs`: Get content entry audit logs

---

## 7. Storage Endpoints (`/api/storage`)

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

## 8. Billing Endpoints (`/api/billing` & `/api/public/billing`)

- `GET /api/public/billing/plans`: Public available subscription plan catalog.
- `GET /api/billing/workspaces/:workspaceId/my-plan`: Get workspace subscription, version, and quota usage.
- `POST /api/billing/webhook/:gateway`: Payment gateway webhook receiver (Stripe).

---

## 9. Public Invitations & User Endpoints

- `GET /api/public/invitations/:token`: Public invitation lookup (unauthenticated).
- `GET /api/user/search`: Exact-match email user lookup (`authenticate`).
- `GET /api/user/invites`: List user invites (`authenticate`).
- `POST /api/user/invites/accept-by-token`: Accept invite via token (`authenticate`).
- `POST /api/user/invites/:invitationId/respond`: Accept or reject invite (`authenticate`).

---

## 10. Operational & Queue Endpoints

- `GET /api/health`: Health status.
- `GET /api/hello`: Simple ping.
- `GET /admin/queues`: Bull-board web UI for monitoring background queues.
