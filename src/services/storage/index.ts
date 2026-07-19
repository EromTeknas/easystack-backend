/**
 * Public storage module exports.
 *
 * Infrastructure ports and implementations are intentionally not exported.
 */

export type { StorageService } from "./public/StorageService";

export {
  StorageCardinality,
  StorageFileClass,
  StoragePrivateAccess,
  StorageVisibility,
  StorageUploadStrategy,
} from "./public/storage.contracts";

export type {
  CompleteUploadInput,
  CompletedStorageAsset,
  CreateUploadIntentInput,
  DeleteStorageAssetInput,
  PresignedPostUpload,
  ResolvedStorageAsset,
  ResolveTargetUrlsInput,
  StorageFileDescriptor,
  StorageAssetAccess,
  StoragePathNode,
  StoragePolicyOverrides,
  StorageTarget,
  UploadIntentResult,
} from "./public/storage.contracts";

export {
  StorageError,
  StorageErrorCode,
} from "./domain/StorageError";
