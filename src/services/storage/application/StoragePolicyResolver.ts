import {
  StorageCardinality,
  StorageFileClass,
  StoragePolicyOverrides,
  StorageVisibility,
  StorageUploadStrategy,
} from "../public/storage.contracts";
import { ResolvedStoragePolicy } from "../domain/storage.records";
import {
  StorageError,
  StorageErrorCode,
} from "../domain/StorageError";

const FIVE_MB = 5 * 1024 * 1024;
const TEN_MB = 10 * 1024 * 1024;
const TWENTY_MB = 20 * 1024 * 1024;

const DEFAULT_POLICIES: Readonly<
  Record<StorageFileClass, ResolvedStoragePolicy>
> = {
  [StorageFileClass.IMAGE]: {
    visibility: StorageVisibility.PRIVATE,
    cardinality: StorageCardinality.MULTIPLE,

    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],

    maxSizeBytes: FIVE_MB,
    uploadExpiresInSeconds: 10 * 60,
    cacheControl: "private, no-store",
    uploadStrategy: StorageUploadStrategy.DIRECT,
  },

  [StorageFileClass.DOCUMENT]: {
    visibility: StorageVisibility.PRIVATE,
    cardinality: StorageCardinality.MULTIPLE,

    allowedMimeTypes: [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/json",
    ],

    maxSizeBytes: TEN_MB,
    uploadExpiresInSeconds: 10 * 60,
    cacheControl: "private, no-store",
    uploadStrategy: StorageUploadStrategy.DIRECT,
  },

  [StorageFileClass.BINARY]: {
    visibility: StorageVisibility.PRIVATE,
    cardinality: StorageCardinality.MULTIPLE,

    allowedMimeTypes: [
      "application/octet-stream",
      "application/zip",
    ],

    maxSizeBytes: TWENTY_MB,
    uploadExpiresInSeconds: 10 * 60,
    cacheControl: "private, no-store",
    uploadStrategy: StorageUploadStrategy.QUARANTINE,
  },
};

export class StoragePolicyResolver {
  resolve(
    fileClass: StorageFileClass,
    overrides?: StoragePolicyOverrides,
  ): ResolvedStoragePolicy {
    const defaultPolicy = DEFAULT_POLICIES[fileClass];

    if (!defaultPolicy) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 400,
        message: `Unsupported storage file class: ${fileClass}`,
      });
    }

    const visibility =
      overrides?.visibility ?? defaultPolicy.visibility;

    const resolvedPolicy: ResolvedStoragePolicy = {
      ...defaultPolicy,
      ...overrides,

      visibility,

      allowedMimeTypes: (
        overrides?.allowedMimeTypes ??
        defaultPolicy.allowedMimeTypes
      ).map((mimeType) => mimeType.trim().toLowerCase()),

      cacheControl:
        overrides?.cacheControl ??
        this.defaultCacheControl(visibility),
    };

    this.validatePolicy(resolvedPolicy);

    return resolvedPolicy;
  }

  private defaultCacheControl(
    visibility: StorageVisibility,
  ): string {
    if (visibility === StorageVisibility.PUBLIC) {
      return "public, max-age=31536000, immutable";
    }

    return "private, no-store";
  }

  private validatePolicy(policy: ResolvedStoragePolicy): void {
    if (!policy.allowedMimeTypes.length) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 500,
        message: "Storage policy must allow at least one MIME type.",
      });
    }

    if (
      !Number.isSafeInteger(policy.maxSizeBytes) ||
      policy.maxSizeBytes <= 0
    ) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 500,
        message: "Storage policy has an invalid maximum file size.",
      });
    }

    if (
      !Number.isSafeInteger(policy.uploadExpiresInSeconds) ||
      policy.uploadExpiresInSeconds < 60 ||
      policy.uploadExpiresInSeconds > 3600
    ) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 500,
        message:
          "Upload expiry must be between 60 and 3600 seconds.",
      });
    }
  }
}
