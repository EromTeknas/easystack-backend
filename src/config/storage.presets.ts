import { StorageCardinality, StorageFileClass, StorageVisibility } from "../services/storage/public/storage.contracts";
import type { StoragePolicyOverrides } from "../services/storage/public/storage.contracts";

export const PROJECT_ASSET_ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-msvideo",
  // Documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const STORAGE_PRESETS = {
  "workspace-logo": {
    fileClass: StorageFileClass.IMAGE,
    slot: "workspace-logo",
    policy: {
      visibility: StorageVisibility.PUBLIC,
      cardinality: StorageCardinality.SINGLE,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    } as StoragePolicyOverrides,
    requiredPermission: "workspace:update",
  },
  "project-asset": {
    fileClass: StorageFileClass.BINARY,
    slot: "assets",
    policy: {
      visibility: StorageVisibility.PUBLIC,
      cardinality: StorageCardinality.MULTIPLE,
      maxSizeBytes: 100 * 1024 * 1024, // 100 MB max per single file
      allowedMimeTypes: PROJECT_ASSET_ALLOWED_MIME_TYPES,
      cacheControl: "public, max-age=31536000, immutable",
    } as StoragePolicyOverrides,
    requiredPermission: "project:update",
  },
} as const;

export type PresetName = keyof typeof STORAGE_PRESETS;
