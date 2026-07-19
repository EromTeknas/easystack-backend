# Storage Service

This document covers the intent-based storage module in `src/services/storage`: how to configure it, use it from a domain service, upload from a browser, resolve files, delete assets, and operate its cleanup workers.

> The routes currently implemented in `src/routes/storage` use the older `S3Service`. They are connectivity and direct-presigning routes and are **not** the HTTP API for the intent-based `StorageService` described here. New domain flows should call `StorageService` and expose domain-specific endpoints.

---

## What the Service Provides

The public interface exposes four operations:

```ts
interface StorageService {
  createUploadIntent(
    input: CreateUploadIntentInput,
  ): Promise<UploadIntentResult>;
  completeUpload(input: CompleteUploadInput): Promise<CompletedStorageAsset>;
  resolveTargetUrls(
    input: ResolveTargetUrlsInput,
  ): Promise<ResolvedStorageAsset[]>;
  deleteAsset(input: DeleteStorageAssetInput): Promise<void>;
}
```

Application code imports only the public API:

```ts
import type { StorageService } from "../services/storage";
import {
  StorageCardinality,
  StorageFileClass,
  StoragePrivateAccess,
  StorageVisibility,
} from "../services/storage";
```

S3, Prisma, and BullMQ implementations remain internal to the storage module.

---

## Storage Model

### Target

A target identifies the domain resource and logical slot to which a file belongs:

```ts
const workspaceLogoTarget = {
  nodes: [{ collection: "workspaces", id: String(workspaceId) }],
  slot: "logo",
};
```

Nested resources are supported:

```ts
const projectAttachmentTarget = {
  nodes: [
    { collection: "workspaces", id: String(workspaceId) },
    { collection: "projects", id: String(projectId) },
  ],
  slot: "attachments",
};
```

The service turns this structure into a stable `targetKey`. Callers never supply S3 keys.

Target segments must be non-empty and at most 128 characters. They cannot contain `/` or `\`, and the exact path-traversal segments `.` and `..` are rejected. Generated keys are limited to 512 bytes.

### Visibility

- `PUBLIC`: stored under `public/` and returned through the configured CDN base URL.
- `PRIVATE`: stored under `private/` and returned only as a short-lived presigned URL after the calling domain has authorized access.

### Cardinality

- `SINGLE`: zero or one active asset for a target, such as a workspace logo or user avatar.
- `MULTIPLE`: multiple active assets, such as project attachments.

For `SINGLE`, the database `activeSingletonKey` unique constraint prevents two active files for the same target. Replacing a file marks the old asset `DELETION_PENDING` and queues physical deletion.

### File classes and defaults

| Class      | Allowed MIME types   | Maximum size | Default visibility/cardinality | Upload strategy                |
| ---------- | -------------------- | -----------: | ------------------------------ | ------------------------------ |
| `IMAGE`    | JPEG, PNG, WebP      |         5 MB | Private / Multiple             | Direct to unique final key     |
| `DOCUMENT` | PDF, text, CSV, JSON |        10 MB | Private / Multiple             | Direct to unique final key     |
| `BINARY`   | Octet stream, ZIP    |        20 MB | Private / Multiple             | Quarantine, verify and promote |

Default upload intents expire after 10 minutes. Trusted backend code can override policy fields for a specific domain use case.

---

## Setup

### Environment variables

```env
STORAGE_CDN_BASE_URL=http://localhost:8081
STORAGE_PRIVATE_URL_EXPIRY_SECONDS=300

STORAGE_S3_BUCKET=easystack
STORAGE_S3_REGION=us-east-1
STORAGE_S3_INTERNAL_ENDPOINT=http://localhost:9000
STORAGE_S3_PUBLIC_ENDPOINT=http://localhost:9000
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_ACCESS_KEY_ID=easystack
STORAGE_S3_SECRET_ACCESS_KEY=easystack-secret
```

When the backend runs inside Docker, use `http://minio:9000` for `STORAGE_S3_INTERNAL_ENDPOINT`. The public endpoint must be reachable by the browser, so local browser clients normally use `http://localhost:9000`.

`STORAGE_S3_INTERNAL_ENDPOINT`, `STORAGE_S3_PUBLIC_ENDPOINT`, and static credentials can be omitted on AWS when the default AWS credential chain and standard S3 endpoint are used.

### Database

Apply the storage migration and generate the Prisma client:

```bash
npm run prisma:migrate
npx prisma generate
```

For deployed environments use the repository's deployment migration command instead:

```bash
npm run prisma:deploy
```

### Local MinIO and CDN

Start the local object-storage stack:

```bash
docker compose -f infra/storage/docker-compose.storage.yml up -d
```

This starts:

- MinIO API on `localhost:9000`.
- MinIO console on `localhost:9001`.
- Bucket initialization and browser-upload CORS configuration.
- NGINX public CDN on `localhost:8081`.

Only objects under `public/` are anonymously readable and cached by NGINX. Requests for `private/`, `temporary/`, or any other prefix return `404` through the CDN.

Redis must also be available because deletion and reconciliation use BullMQ.

### Worker

Run the centralized storage worker group in a separate process:

```bash
npm run worker:storage
```

Register the hourly reconciliation schedule once during deployment:

```bash
npm run queues:register-schedules
```

`npm run dev` starts it automatically alongside the API and the separate email worker group. See [WORKERS.md](WORKERS.md) for the centralized queue architecture.

The worker deletes queued objects, marks associated database assets as `DELETED`, and processes scheduled reconciliation jobs. Schedule registration is separate so every storage replica does not register it again. Deletion jobs use exponential backoff, at least five attempts, stable object-based job IDs, and completed/failed retention.

---

## Creating and Injecting the Service

Create one instance during application composition and inject it into domain services:

```ts
import { prisma } from "../db/prisma";
import { createStorageModule } from "../services/storage/infrastructure/createStorageModule";

const storageService = createStorageModule(prisma);

const workspaceService = new WorkspaceService(
  workspaceRepository,
  authorizationService,
  storageService,
);
```

The infrastructure factory is the composition root. Outside composition code, depend on the `StorageService` interface rather than `DefaultStorageService`, S3, Prisma, or queue classes.

---

## Complete Upload Flow

The upload protocol has three stages:

1. The backend authorizes the domain action and creates an upload intent.
2. The browser sends the file directly to object storage using the returned presigned POST.
3. The backend completes the intent, verifies the object, promotes it when quarantine is required, commits the asset record, and returns immediately usable access information.

### Runnable demo APIs

The authenticated demo API is mounted under `/api/storage/demo`. It isolates every target under the authenticated user's ID and uses server-controlled policy presets.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/storage/demo/presets` | List supported demo policies and targets |
| `POST` | `/api/storage/demo/upload-intents` | Create an intent and presigned multipart POST |
| `POST` | `/api/storage/demo/upload-intents/:uploadId/complete` | Verify, promote, and activate the upload |
| `GET` | `/api/storage/demo/assets` | Hydrate public CDN or private presigned inline URLs |
| `DELETE` | `/api/storage/demo/assets/:assetId` | Mark an asset for asynchronous deletion |

The routes use the normal access-token cookie authentication middleware. In the examples below, replace `cookies.txt` with your authenticated cookie jar if using curl.

#### List presets

```bash
curl --cookie cookies.txt \
  http://localhost:3000/api/storage/demo/presets
```

Available presets:

- `public-image-single`
- `private-image-single`
- `private-document-multiple`
- `private-binary-multiple`

#### Create a presigned upload

```bash
curl --cookie cookies.txt \
  --header 'Content-Type: application/json' \
  --data '{
    "preset": "public-image-single",
    "file": {
      "originalName": "demo-logo.png",
      "mimeType": "image/png",
      "sizeBytes": 42871
    }
  }' \
  http://localhost:3000/api/storage/demo/upload-intents
```

The response contains `data.uploadId` and `data.upload`, including the presigned URL and all required form fields.

#### Upload the file

Use the browser `FormData` example below, or submit all returned fields with curl. Field names and values are generated dynamically, so a small script is usually more convenient than manually copying them.

```ts
const intentResponse = await fetch("/api/storage/demo/upload-intents", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    preset: "public-image-single",
    file: {
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    },
  }),
});

const { data } = await intentResponse.json();
const form = new FormData();
for (const [name, value] of Object.entries(data.upload.fields)) {
  form.append(name, String(value));
}
form.append("file", file);

const objectUploadResponse = await fetch(data.upload.url, {
  method: data.upload.method,
  body: form,
});
if (!objectUploadResponse.ok) throw new Error("Object upload failed");

const completionResponse = await fetch(
  `/api/storage/demo/upload-intents/${data.uploadId}/complete`,
  { method: "POST", credentials: "include" },
);
const completion = await completionResponse.json();
console.log(completion.data.asset);
```

The completed asset includes non-persisted access information:

```json
{
  "id": "ast_...",
  "targetKey": "users:1#demo-private-image",
  "visibility": "PRIVATE",
  "mimeType": "image/jpeg",
  "sizeBytes": 4313396,
  "createdAt": "2026-07-19T17:00:00.000Z",
  "access": {
    "url": "http://localhost:9000/easystack/private/...?X-Amz-Signature=...",
    "expiresAt": "2026-07-19T17:05:00.000Z"
  }
}
```

Public completion returns a CDN URL with `expiresAt: null`. Private completion returns a presigned inline URL and expiry. The URL is generated after the asset transaction and is never stored. If private signing temporarily fails, completion still succeeds with `access: null`; the caller can hydrate the target again later.

#### Hydrate URLs

Public-only hydration returns CDN URLs and omits private assets:

```bash
curl --cookie cookies.txt \
  'http://localhost:3000/api/storage/demo/assets?preset=public-image-single'
```

Authorized private hydration returns short-lived presigned inline URLs:

```bash
curl --cookie cookies.txt \
  'http://localhost:3000/api/storage/demo/assets?preset=private-image-single&includePrivate=true&expiresInSeconds=300'
```

The demo route may use `AUTHORIZED_PRIVATE` safely because its target is always derived from the authenticated user's ID. Production domain routes must perform their own resource authorization before requesting private hydration.

#### Replace a singleton

Run create → browser upload → complete twice with `public-image-single` or `private-image-single`. The second asset becomes active and the first is marked `DELETION_PENDING` and asynchronously removed.

#### Create multiple assets

Run the flow multiple times with `private-document-multiple` or `private-binary-multiple`. Hydration returns every active asset for that target.

#### Delete an asset

```bash
curl --request DELETE \
  --cookie cookies.txt \
  --header 'Content-Type: application/json' \
  --data '{"preset":"public-image-single"}' \
  http://localhost:3000/api/storage/demo/assets/ast_REPLACE_ME
```

The response reports `DELETION_PENDING`; the storage worker performs physical deletion.

#### Demo logging

The controller emits structured logs for:

- Authenticated actor and selected server-side preset.
- Target, safe file metadata, and resolved policy.
- Intent ID, upload method, upload host, expiry, and returned form-field names.
- Completion validation/promotion start and resulting asset metadata.
- Hydration mode, count, URL kind, URL host, and asset metadata.
- Deletion request and scheduling result.
- Operation duration and detailed failure name, message, and storage error code.

For security, logs intentionally exclude full presigned URLs, signatures, credentials, and form-field values. The complete URLs and fields are returned only in the authenticated API response.

### 1. Create an upload intent

Example domain method for a public, single workspace logo:

```ts
async function createWorkspaceLogoUpload(
  actorId: string,
  workspaceId: number,
  file: { originalName: string; mimeType: string; sizeBytes: number },
) {
  await authorizationService.requireWorkspacePermission(
    actorId,
    workspaceId,
    "workspace:update",
  );

  return storageService.createUploadIntent({
    actorId,
    target: {
      nodes: [{ collection: "workspaces", id: String(workspaceId) }],
      slot: "logo",
    },
    fileClass: StorageFileClass.IMAGE,
    file,
    policy: {
      visibility: StorageVisibility.PUBLIC,
      cardinality: StorageCardinality.SINGLE,
      maxSizeBytes: 2 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  });
}
```

Policy overrides must be decided by trusted backend code. Never copy visibility, maximum size, allowed MIME types, cardinality, cache control, or expiry directly from an untrusted HTTP request.

The response resembles:

```json
{
  "uploadId": "upl_...",
  "upload": {
    "method": "POST",
    "url": "http://localhost:9000/easystack",
    "fields": {
      "key": "temporary/uploads/...",
      "Content-Type": "image/png"
    },
    "expiresAt": "2026-07-18T12:10:00.000Z"
  }
}
```

### 2. Upload from the browser

The returned upload is a presigned **multipart POST**, not a PUT URL. Include every returned field unchanged, then append the file:

```ts
async function uploadToObjectStorage(
  upload: { url: string; fields: Record<string, string> },
  file: File,
): Promise<void> {
  const body = new FormData();

  for (const [name, value] of Object.entries(upload.fields)) {
    body.append(name, value);
  }

  body.append("file", file);

  const response = await fetch(upload.url, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(`Object upload failed with status ${response.status}`);
  }
}
```

Do not manually set the `Content-Type` request header for the multipart request; the browser supplies the boundary. The form's returned `Content-Type` field is still required and must be preserved.

### 3. Complete the upload

After the browser upload succeeds, call a domain endpoint that invokes:

```ts
const completed = await storageService.completeUpload({
  actorId,
  uploadId,
});
```

Completion verifies:

- The intent exists, belongs to the actor, is not failed, and has not expired.
- The temporary object exists.
- MIME type and size match the policy.
- Upload, asset, and actor metadata match the intent.
- Quarantined files can be promoted, when required, and the database transaction can complete.

Completion is idempotent. Repeating it returns the existing active asset. Concurrent completion does not delete the valid final object created by another request.

Images and documents normally upload directly to their unpredictable, unique final object key. They remain invisible to application reads until completion activates their database asset. Binaries use quarantine by default and are copied to the final key only after verification. Trusted domain policy may override `uploadStrategy` when scanning, moderation, resizing, or transcoding requires quarantine.

---

## Resolving URLs

### Public target

```ts
const assets = await storageService.resolveTargetUrls({
  target: workspaceLogoTarget,
  privateAccess: StoragePrivateAccess.PUBLIC_ONLY,
});
```

Public assets return stable CDN URLs. Private assets are omitted when access is `PUBLIC_ONLY`.

### Authorized private target

Authorize first, then explicitly request private access:

```ts
await authorizationService.requireProjectRead(actorId, projectId);

const assets = await storageService.resolveTargetUrls({
  target: projectAttachmentTarget,
  privateAccess: StoragePrivateAccess.AUTHORIZED_PRIVATE,
  privateUrlExpiresInSeconds: 300,
});
```

Private URLs are presigned with inline content disposition, making them suitable for images and in-browser previews. The storage module does not perform domain authorization; passing `AUTHORIZED_PRIVATE` asserts that the caller already authorized access.

Do not persist presigned URLs. Resolve them when needed because they expire.

---

## Deleting an Asset

Authorize the domain operation, then pass both the asset ID and expected target:

```ts
await authorizationService.requireWorkspacePermission(
  actorId,
  workspaceId,
  "workspace:update",
);

await storageService.deleteAsset({
  actorId,
  assetId,
  target: workspaceLogoTarget,
});
```

Deletion is asynchronous:

1. The database query requires both `assetId` and the expected `targetKey`.
2. The asset becomes `DELETION_PENDING`, is removed from active resolution, and records the deleting actor.
3. BullMQ deletes the object.
4. The worker marks the asset `DELETED` and records `deletedAt`.

The target check limits damage if domain authorization or resource-to-asset mapping contains a bug. Cleanup scheduling is failure-safe; reconciliation re-enqueues assets left in `DELETION_PENDING`.

---

## Lifecycle and Recovery Cases

### Successful upload

- Intent: `CREATED` → `COMPLETED`.
- Asset: created as `ACTIVE`.
- Direct strategy: the uploaded unique final object is activated without an S3 copy.
- Quarantine strategy: the temporary object is promoted and queued for deletion.
- Replaced `SINGLE` asset: `ACTIVE` → `DELETION_PENDING` → `DELETED`.

### Browser never uploads or never completes

- The intent expires.
- Hourly reconciliation changes old `CREATED` intents to `EXPIRED`.
- The strategy-specific upload key is queued for deletion.

### Uploaded object is missing

`completeUpload` throws `UPLOADED_OBJECT_NOT_FOUND` with HTTP 404.

### Object-storage permission, credential, or availability failure

The error is not treated as a missing object. `completeUpload` throws `STORAGE_PROVIDER_ERROR` with HTTP 502.

### Uploaded content violates the intent

MIME type, size, or metadata mismatch produces `UPLOADED_OBJECT_INVALID` with HTTP 422. The object is never promoted to an active asset.

### Persistence fails after object promotion

The final object is queued for rollback deletion, unless another concurrent request already completed the same intent. In that race, the valid asset is returned and only the temporary object is deleted.

### Cleanup queue is temporarily unavailable

A successfully committed upload or deletion request remains successful. Scheduling errors are logged, and hourly reconciliation discovers completed/expired intents and `DELETION_PENDING` assets and schedules cleanup again.

### Worker fails during deletion

BullMQ retries with exponential backoff. S3 deletion is idempotent, and database `markAssetDeleted` is also idempotent.

---

## Error Reference

| Code                           | Typical HTTP status | Meaning                                                     |
| ------------------------------ | ------------------: | ----------------------------------------------------------- |
| `INVALID_TARGET`               |                 400 | Invalid target hierarchy or slot                            |
| `INVALID_FILE`                 |                 400 | Invalid filename, MIME string, size, actor, or policy input |
| `MIME_TYPE_NOT_ALLOWED`        |                 415 | MIME type is outside the resolved policy                    |
| `FILE_TOO_LARGE`               |                 413 | Claimed file size exceeds the maximum                       |
| `MIME_EXTENSION_NOT_SUPPORTED` |                 400 | No safe object extension exists for the MIME type           |
| `UPLOAD_INTENT_NOT_FOUND`      |                 404 | Unknown upload ID                                           |
| `UPLOAD_INTENT_FORBIDDEN`      |                 403 | Intent belongs to another actor                             |
| `UPLOAD_INTENT_EXPIRED`        |                 410 | Intent has expired                                          |
| `UPLOAD_INTENT_FAILED`         |                 409 | Intent was previously marked failed                         |
| `UPLOADED_OBJECT_NOT_FOUND`    |                 404 | Uploaded object does not exist                              |
| `UPLOADED_OBJECT_INVALID`      |                 422 | Uploaded MIME, size, or metadata is invalid                 |
| `ASSET_NOT_FOUND`              |                 404 | Asset ID and expected target did not match an asset         |
| `STORAGE_PROVIDER_ERROR`       |                 502 | Object-storage operation failed                             |
| `STORAGE_PERSISTENCE_ERROR`    |             500/503 | Database operation or retry sequence failed                 |

Handle `StorageError` through the application's standard error middleware. Do not expose the underlying provider or database `cause` to clients.

---

## Security Rules

- Perform domain authorization before every create, resolve-private, or delete operation.
- Derive `actorId` from the authenticated principal, never the request body.
- Build targets from route/domain identifiers after confirming their relationships.
- Keep policy overrides in trusted backend code.
- Never accept an object key from a client.
- Never return or persist temporary object keys.
- Keep `temporary/` and `private/` inaccessible through the public CDN.
- Treat presigned URLs and POST fields as temporary credentials.
- Use `SINGLE` for logical singleton fields to retain database protection.

---

## Production Checklist

- Apply the Prisma migration and generate the client.
- Configure the bucket, region, CDN base URL, and private URL expiry.
- Use IAM roles or narrowly scoped credentials.
- Configure bucket CORS for the actual frontend origins.
- Allow public reads only for `public/*`; keep `private/*` and `temporary/*` private.
- Start at least one `worker:storage` process.
- Run `queues:register-schedules` during deployment.
- Run Redis with persistence and monitoring appropriate to the environment.
- Monitor failed `storage-cleanup` jobs and reconciliation errors.
- Configure CDN caching only for immutable `public/*` objects.
- Add domain-specific HTTP endpoints; do not expose unrestricted generic storage endpoints.
- Test create, browser upload, completion, replacement, private resolution, deletion, expiry, and concurrent completion.

---

## Relevant Files

| Area                      | Location                                                     |
| ------------------------- | ------------------------------------------------------------ |
| Public API                | `src/services/storage/index.ts`                              |
| Contracts                 | `src/services/storage/public/`                               |
| Application logic         | `src/services/storage/application/`                          |
| Prisma persistence        | `src/services/storage/infrastructure/prisma/`                |
| S3 provider               | `src/services/storage/infrastructure/s3/`                    |
| Cleanup queue and workers | `src/services/storage/infrastructure/queue/`                 |
| Composition factory       | `src/services/storage/infrastructure/createStorageModule.ts` |
| Configuration             | `src/config/storage.ts`                                      |
| Prisma models             | `prisma/schema.prisma`                                       |
| Local MinIO/CDN           | `infra/storage/`                                             |
