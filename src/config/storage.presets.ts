import { StorageCardinality, StorageFileClass, StorageVisibility } from "../services/storage/public/storage.contracts";
import type { StoragePolicyOverrides } from "../services/storage/public/storage.contracts";

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
  },
} as const;

export type PresetName = keyof typeof STORAGE_PRESETS;
