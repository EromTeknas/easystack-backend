# Object Storage Module

## 1. Purpose & Responsibilities

The **Object Storage Module** provides a secure, intent-based file upload and media resolution service. Files are uploaded **directly from the client browser to object storage** (AWS S3 or MinIO) using presigned POST policies, ensuring the API server never buffers binary file payloads in memory.

### Core Responsibilities
- Validate file constraints (allowed MIME types, maximum size, aspect ratios) before issuing upload permissions.
- Issue short-lived, presigned S3 POST policies constrained by exact key, bucket, and size limits.
- Verify uploaded file integrity upon upload completion via S3 `HEAD Object` checks.
- Map binary assets to domain entities using structured **Targets** and **Slots**.
- Enforce slot cardinality: `SINGLE` (safely replacing and deleting old objects) versus `MULTIPLE`.
- Resolve asset URLs: Public assets via high-speed CDN, Private assets via short-lived signed URLs.
- Reconcile orphaned uploads and garbage-collect uncompleted files via BullMQ background workers.

---

## 2. File Responsibility Map

```text
src/
├── routes/storage/
│   ├── storage.routes.ts               # Mounted at /api/storage
│   ├── storage.controller.ts          # Upload intent creation, completion, presigning
│   └── storage-demo.controller.ts     # User-isolated demo endpoints for testing uploads
├── routes/assets/
│   ├── assets.routes.ts               # Mounted at /api/projects/:projectId/assets
│   └── assets.controller.ts           # Media asset upload intents, completion, search, CRUD
│
├── repositories/
│   └── project-asset.repository.ts    # Prisma repository for ProjectAsset with soft deletion
│
├── services/assets/
│   └── project-asset.service.ts       # Orchestrates storage service, quota validation, asset lifecycle
│
├── services/storage/
│   ├── index.ts                        # Module export facade & public types
│   ├── storage.instance.ts             # Instantiated singleton of StorageService
│   ├── public/
│   │   ├── StorageService.ts           # Public interface definition
│   │   └── storage.contracts.ts        # Public types (CreateUploadIntentInput, UploadIntentResult, etc.)
│   ├── application/
│   │   ├── DefaultStorageService.ts    # Core application service implementing StorageService operations
│   │   ├── StoragePolicyResolver.ts    # Resolves upload policies by file class
│   │   └── StorageReconciliationService.ts # Reconciles expired intents and orphaned assets
│   ├── domain/
│   │   ├── ObjectKeyBuilder.ts         # Generates deterministic S3 keys from target and slot
│   │   ├── StorageError.ts             # Domain storage errors
│   │   └── storage.records.ts          # Storage upload intent and asset record types
│   ├── ports/
│   │   ├── ObjectStorageProvider.ts    # Port for S3/MinIO operations
│   │   ├── StoragePersistence.ts       # Port for relational persistence (Prisma)
│   │   └── StorageCleanupScheduler.ts  # Port for background scheduling (BullMQ)
│   └── infrastructure/
│       ├── createStorageModule.ts      # Composition factory wiring ports and adapters
│       ├── prisma/
│       │   └── PrismaStoragePersistence.ts # Implements StoragePersistence via Prisma
│       ├── s3/
│       │   └── S3ObjectStorageProvider.ts  # Implements ObjectStorageProvider via AWS SDK v3
│       └── queue/
│           ├── storage.jobs.ts             # BullMQ job descriptors: reconcile, retention
│           ├── storage.producer.ts         # Schedulers: hourly reconciliation, daily retention
│           ├── storage.processor.ts        # Worker processor deleting orphaned S3 objects
│           ├── createStorageWorkers.ts     # BullMQ worker pool factory
│           └── BullMqStorageCleanupScheduler.ts # Implements StorageCleanupScheduler via BullMQ
```

---

## 3. The Target & Slot Model

Files belong to domain resources using a structured hierarchical target:

```typescript
const target = {
  nodes: [
    { collection: 'workspaces', id: '12' },
    { collection: 'projects', id: '45' }
  ],
  slot: 'cover_image' // logical slot identifier
};
```

### Cardinality & Replacement
- **`SINGLE` Slot**: Only one asset can occupy the slot (e.g., workspace logo or user avatar). When a new upload completes, the previous asset is marked removed and its S3 object is scheduled for deletion.
- **`MULTIPLE` Slot**: Multiple assets coexist under the slot (e.g., project gallery attachments).

---

## 4. Visibility & URL Resolution

- **`PUBLIC` Visibility**: Assets are publicly readable. Resolved URLs point directly to the configured CDN edge:
  `${STORAGE_CDN_BASE_URL}/${s3Key}`
- **`PRIVATE` Visibility**: Assets require authentication. Resolved URLs are signed S3 GET URLs that expire after 300 seconds (`STORAGE_PRIVATE_URL_EXPIRY_SECONDS`).

---

## 5. Background Cleanup & Lifecycle

Uploaded files transition through a controlled state machine:

```mermaid
stateDiagram-v2
    [*] --> PENDING : createUploadIntent()
    PENDING --> COMPLETED : completeUpload() (Client succeeded)
    
    PENDING --> CLEANED : Hourly Worker (Expired after 1h without completion)
    COMPLETED --> MARKED_FOR_DELETION : deleteAsset() OR Single Slot Replacement
    MARKED_FOR_DELETION --> CLEANED : Storage Worker (Deletes object from S3)
    CLEANED --> [*] : Daily Worker (Purges DB intent record after 30 days)
```

---

## 6. Project Assets Management Subsystem

The **Project Asset Management** subsystem provides a dedicated media library for projects, allowing users to upload, browse, and organize images and videos directly within their CMS.

### Environment Agnosticism
Media assets are attached at the project level (`projects:${projectId}#assets`). Because media represents assets that must be consistently accessible across all promotion stages, assets are shared across all environments (Development, Staging, Production). This prevents broken image and video URLs when content entries are published or promoted.

### Plan Storage Quotas
Asset storage is strictly governed by workspace billing plans via the `ASSET_STORAGE_MB` quota in `src/services/billing/config/`:
- **Free Plan**: 50 MB
- **Pro Plan**: 2,048 MB (2 GB)
- **Enterprise Plan**: 20,480 MB (20 GB)

Before any upload intent is generated, `project-asset.service.ts` calculates current active usage (`SUM(sizeBytes)` where `removedAt: null`) and ensures `currentBytes + newFileBytes <= quotaBytes`. If exceeded, a `400 Bad Request` is thrown with exact usage details.

### Preset & MIME Support
The `"project-asset"` preset (`src/config/storage.presets.ts`) accepts:
- **Images**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`, `image/avif`, `image/bmp`, `image/x-icon`
- **Videos**: `video/mp4`, `video/webm`, `video/quicktime`, `video/ogg`, `video/x-msvideo`, `video/mpeg`
- **Max File Size**: 100 MB per file (or up to plan quota limit)
- **Cache-Control**: `public, max-age=31536000, immutable` for high-performance CDN edge delivery.
