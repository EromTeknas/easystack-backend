# Backend Provisions & Utilities

## 1. Authorization Middleware
\`authorize({ scope: 'project', permission: 'project:read', scopeId: req => req.params.projectId })\`
Validates against the Redis Auth Cache on every request.

## 2. Authorization Cache Builder
\`src/services/authorization/services/buid-cache.service.ts\`
Dynamically collapses explicit database assignments and implicit inheritance rules into a flat permissions object.

## 3. Billing Middleware
\`billingMiddleware(workspaceIdFn, { subscription: true, quotas: [...] })\`
Automatically halts requests if a tenant exceeds their SaaS limits.

## 4. Global Error Handling
\`asyncHandler\` wrapper ensures all unhandled promise rejections are passed to the global error middleware, preventing Node.js process crashes.

## 5. Caching
Redis is heavily utilized. Always use \`AuthorizationCacheService.evict(userId)\` whenever mutating a user's role or access.
