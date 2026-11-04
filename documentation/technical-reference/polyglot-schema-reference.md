# Polyglot Schema Reference

This document provides a technical dictionary of all data models across **MySQL (Prisma ORM)**, **MongoDB (Mongoose)**, and **Redis**.

---

## 1. MySQL Relational Schema (Prisma)

Source file: [`prisma/schema.prisma`](file:///home/eteknas/Projects/easystack-backend/prisma/schema.prisma)

### A. Identity & Authentication Models
- **`User`**:
  - `id: Int` (PK autoincrement)
  - `name: String`, `email: String` (unique)
  - `emailVerified: Boolean` (default: false)
  - `defaultWorkspaceId: Int?`
  - `removedAt: DateTime?` (Soft delete)
  - Relations: `authAccounts`, `sessions`, `workspaceMembers`, `projectMembers`
- **`AuthAccount`**:
  - `id: Int`, `userId: Int`
  - `provider: AuthProvider` (`LOCAL`, `GOOGLE`)
  - `providerAccountId: String?`
  - `passwordHash: String?` (bcrypt)
- **`Session`**:
  - `id: Int`, `userId: Int`
  - `refreshToken: String` (unique hash)
  - `expiresAt: DateTime`, `revokedAt: DateTime?`
  - `userAgent: String?`, `ipAddress: String?`

### B. Tenancy & Organization Models
- **`Workspace`**:
  - `id: Int` (PK)
  - `name: String`, `logoAssetId: String?`, `createdBy: Int`
  - `removedAt: DateTime?`
  - Relations: `members`, `projects`, `subscription`, `invitations`
- **`WorkspaceMember`**:
  - `id: Int`, `workspaceId: Int`, `userId: Int`, `roleId: Int`
  - `removedAt: DateTime?`
- **`WorkspaceInvitation`**:
  - `id: Int`, `workspaceId: Int`, `email: String`, `token: String` (unique)
  - `roleId: Int`, `status: InvitationStatus` (`PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`)
  - `expiresAt: DateTime`
- **`Project`**:
  - `id: Int`, `workspaceId: Int`, `name: String`
  - `subdomain: String` (unique)
  - `resourceId: String` (unique)
  - `removedAt: DateTime?`
  - Relations: `members`, `environments`, `languages`
- **`Environment`**:
  - `id: Int`, `projectId: Int`, `name: String` (e.g. `development`, `staging`, `production`)
  - `isEditable: Boolean` (default: false; true only for development)
- **`EnvironmentState`**:
  - `environmentId: Int`, `feedId: Int`
  - `activeVersionId: String` (MongoDB `FeedVersion._id` pointer)
- **`ProjectLanguage`**:
  - `id: Int`, `projectId: Int`, `code: String` (e.g. `es-ES`), `name: String`, `isBase: Boolean`

### C. RBAC Models
- **`Role`**:
  - `id: Int`, `key: String` (unique, e.g. `WORKSPACE_ADMIN`, `PROJECT_EDITOR`), `scope: RoleScope` (`WORKSPACE`, `PROJECT`)
- **`Permission`**:
  - `id: Int`, `key: String` (unique, e.g. `feed:update`, `project:read`)
- **`RolePermission`**:
  - `roleId: Int`, `permissionId: Int`

### D. Billing Models
- **`Subscription`**:
  - `id: Int`, `workspaceId: Int` (unique), `planVersionId: Int`
  - `status: SubscriptionStatus` (`TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED`)
  - `gateway: PaymentGateway?` (`STRIPE`)
  - `gatewayCustomerId: String?`, `gatewaySubscriptionId: String?`
- **`Plan`** & **`PlanVersion`**:
  - Plan versioning keeping past subscriptions pinned to their original agreement.
  - Relations: `pricing`, `features`, `quotas`
- **`PlanQuota`**:
  - `planVersionId: Int`, `key: String` (e.g. `projects`, `members`), `limit: Int`, `resetPolicy: QuotaResetPolicy`

### E. Storage Models
- **`UploadIntent`**:
  - `id: String` (UUID PK), `targetKey: String`, `slot: String`
  - `fileClass: String`, `mimeType: String`, `expectedSize: Int`, `s3Key: String`
  - `status: UploadIntentStatus` (`PENDING`, `COMPLETED`, `CLEANED`)
  - `expiresAt: DateTime`
- **`StorageAsset`**:
  - `id: String`, `targetKey: String`, `slot: String`, `s3Key: String`
  - `fileSize: Int`, `mimeType: String`, `visibility: StorageVisibility` (`PUBLIC`, `PRIVATE`)
  - `removedAt: DateTime?`

---

## 2. MongoDB Document Models (Mongoose)

### A. `FeedVersion` ([`src/models/feed-version.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/feed-version.model.ts))
```typescript
{
  _id: ObjectId,
  feedId: Number,              // References MySQL Feed/Project ID
  projectId: Number,
  baseLanguage: String,        // e.g. "en-US"
  baseContent: Object,         // Arbitrary JSON payload
  selectedKeys: [String],      // Wildcard translation paths (e.g. ["items.*.title"])
  schemaDefinition: Object,    // Optional blueprint constraints
  createdBy: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### B. `FeedLocalization` ([`src/models/feed-localization.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/feed-localization.model.ts))
```typescript
{
  _id: ObjectId,
  feedVersionId: ObjectId,     // Ref to FeedVersion
  languageCode: String,        // e.g. "es-ES"
  localizedContent: Object,    // Translated JSON structure
  status: String,              // "UNTRANSLATED" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "STALE"
  lastTranslatedAt: Date,
  errorDetails: Object
}
```

### C. `FeedComment` ([`src/models/feed-comment.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/feed-comment.model.ts))
```typescript
{
  _id: ObjectId,
  feedId: Number,
  languageCode: String,
  parentId: ObjectId,          // null for root comments / review threads
  authorId: Number,            // -1 indicates system message
  isSystem: Boolean,           // true for system timeline events
  type: String,                // "COMMENT" | "REVIEW_REQUEST"
  status: String,              // "ACTIVE" | "COMPLETED" | "OUTDATED" | "DELETED"
  reviewers: [{
    userId: Number,
    status: String,            // "PENDING" | "APPROVED" | "REJECTED"
    respondedAt: Date
  }],
  content: String              // Markdown content (scrubbed to null on deletion)
}
```

### D. `SchemaBlueprint` & `ContentEntry`
- **`SchemaBlueprint`**: Stores content model definitions, field identifiers, and types (`text`, `number`, `image`, `relation`).
- **`ContentEntry`**: Stores authored instances of blueprints with `draft` and `published` revisions.

---

## 3. Redis Key Index

| Key Pattern | Data Structure | TTL | Purpose |
|---|---|---|---|
| `authorization:v1:<userId>` | String (JSON) | Configured TTL (Evicted on mutation) | Flattened user permissions node across all scopes |
| `email_otp:<userId>` | String (Hash) | 15 minutes | Hashed OTP code and attempt counter |
| `email_verification:<token>` | Hash | 15 minutes | Maps verification token to user metadata |
| `password_reset:<token>` | Hash | 1 hour | Maps reset token to user ID and expiry |
| `billing:context:<workspaceId>` | String (JSON) | 5 minutes | Cached subscription status, version, and quota balances |
| `billing:lock:<workspaceId>` | String (Mutex) | 10 seconds | Distributed lock protecting concurrent quota increments |
| `bull:<queueName>:*` | Sets / Hashes | Managed by BullMQ | Queue state, delayed jobs, and repeatable schedules |
