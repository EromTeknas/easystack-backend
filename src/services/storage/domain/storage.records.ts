import {
  StorageCardinality,
  StorageFileClass,
  StorageFileDescriptor,
  StorageTarget,
  StorageVisibility,
} from "../public/storage.contracts";

export enum StorageUploadIntentStatus {
  CREATED = "CREATED",
  COMPLETED = "COMPLETED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

export enum StorageAssetStatus {
  ACTIVE = "ACTIVE",
  DELETION_PENDING = "DELETION_PENDING",
  DELETED = "DELETED",
}

export interface ResolvedStoragePolicy {
  visibility: StorageVisibility;
  cardinality: StorageCardinality;
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
  uploadExpiresInSeconds: number;
  cacheControl: string;
}

export interface StorageUploadIntentRecord {
  id: string;
  assetId: string;
  actorId: string;

  target: StorageTarget;
  targetKey: string;

  fileClass: StorageFileClass;
  file: StorageFileDescriptor;
  policy: ResolvedStoragePolicy;

  temporaryObjectKey: string;
  finalObjectKey: string;

  status: StorageUploadIntentStatus;
  expiresAt: Date;
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface StorageAssetRecord {
  id: string;

  target: StorageTarget;
  targetKey: string;

  objectKey: string;
  visibility: StorageVisibility;
  cardinality: StorageCardinality;

  originalName: string;
  mimeType: string;
  sizeBytes: number;

  etag: string | null;
  checksum: string | null;

  status: StorageAssetStatus;
  createdById: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CompleteUploadTransactionInput {
  uploadIntentId: string;
  asset: StorageAssetRecord;
}

export interface CompleteUploadTransactionResult {
  asset: StorageAssetRecord;

  /**
   * For SINGLE targets, previous active assets are moved to
   * DELETION_PENDING and returned here.
   */
  replacedAssets: StorageAssetRecord[];
}