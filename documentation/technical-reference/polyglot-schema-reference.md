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
  - `id: Int`, `projectId: Int`, `name: String`, `displayName: String?`, `rank: Int`
  - `isEditable: Boolean` (true for authoring environments)
  - `requiresApproval: Boolean`
- **`ProjectLanguage`**:
  - `id: Int`, `projectId: Int`, `code: String` (e.g. `es-ES`), `name: String`, `isBase: Boolean`

### C. RBAC Models
- **`Role`**:
  - `id: Int`, `key: String` (unique, e.g. `WORKSPACE_ADMIN`, `PROJECT_EDITOR`), `scope: RoleScope` (`WORKSPACE`, `PROJECT`)
- **`Permission`**:
  - `id: Int`, `key: String` (unique, e.g. `schema:update`, `content:read`)
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

### A. `SchemaBlueprint` ([`src/models/schema-blueprint.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/schema-blueprint.model.ts))
```typescript
{
  _id: ObjectId,
  projectId: Number,
  name: String,
  slug: String,
  description: String,
  type: "collection" | "single",
  icon: String,
  schemaDefinition: {
    version: Number,
    fields: SchemaFieldDefinition[]
  },
  environmentVersions: Record<string, number>,
  activeVersionNumber: Number,
  createdBy: Number,
  removedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

### B. `SchemaBlueprintVersion` ([`src/models/schema-blueprint-version.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/schema-blueprint-version.model.ts))
```typescript
{
  _id: ObjectId,
  blueprintId: ObjectId,
  projectId: Number,
  versionNumber: Number,
  schemaDefinition: {
    version: Number,
    fields: SchemaFieldDefinition[]
  },
  changelog: String,
  createdBy: Number,
  createdAt: Date
}
```

### C. `ContentEntry` ([`src/models/content-entry.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/content-entry.model.ts))
```typescript
{
  _id: ObjectId,
  projectId: Number,
  schemaBlueprintId: ObjectId,
  schemaSlug: String,
  environmentId: Number,
  environment: String,
  slug: String,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED",
  content: Record<string, any>,           // Current draft working copy
  publishedContent: Record<string, any>,  // Canonical published version
  translations: Record<string, {
    status: "UNTRANSLATED" | "PENDING" | "TRANSLATED" | "FAILED" | "READY",
    content: Record<string, any>,
    publishedContent: Record<string, any>,
    lastTranslatedAt?: Date,
    outdatedFields?: string[]
  }>,
  version: Number,
  publishedVersion: Number,
  publishedAt?: Date,
  scheduledPublishAt?: Date,
  createdBy: Number,
  updatedBy: Number,
  removedAt?: Date
}
```

### D. `ContentAuditLog` ([`src/models/content-audit-log.model.ts`](file:///home/eteknas/Projects/easystack-backend/src/models/content-audit-log.model.ts))
```typescript
{
  _id: ObjectId,
  entryId: ObjectId,
  projectId: Number,
  action: "CREATED" | "UPDATED" | "PUBLISHED" | "DISCARDED" | "SCHEDULED" | "TRANSLATED" | "DELETED",
  userId: Number,
  changes?: Record<string, any>,
  createdAt: Date
}
```

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
