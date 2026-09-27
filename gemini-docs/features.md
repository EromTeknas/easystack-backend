# Backend Features

## 1. Authentication & Users
- JWT-based authentication.
- User profile management.

## 2. Workspaces & Projects (Multi-tenancy)
- Users can create and manage Workspaces.
- Workspaces contain multiple Projects.
- Projects contain Feeds and Localizations.

## 3. Advanced RBAC Engine
- Hierarchical Roles: \`WORKSPACE_OWNER\`, \`WORKSPACE_ADMIN\`, \`WORKSPACE_MEMBER\`, \`WORKSPACE_GUEST\`.
- Project Scoped Roles: \`PROJECT_OWNER\`, \`PROJECT_ADMIN\`, \`PROJECT_EDITOR\`, \`PROJECT_CONTRIBUTOR\`, \`PROJECT_VIEWER\`.
- Redis-based Authorization Caching (\`authorization:v1:userId\`).
- Implicit Inheritance: Workspace Admins implicitly inherit \`PROJECT_ADMIN\` for all projects within their workspace during cache generation.

## 4. Invitation System
- Email-based invitations via exact-match searching to protect privacy.
- Token-based acceptance flows for both Workspace and explicit Project-level role assignments simultaneously.

## 5. Billing & Quotas
- Subscription-based gating using Stripe (Future Scope).
- Config-driven quota limitations (e.g., max projects, max members).
