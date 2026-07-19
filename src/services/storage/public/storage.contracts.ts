export enum StorageVisibility {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export enum StorageCardinality {
  SINGLE = "SINGLE",
  MULTIPLE = "MULTIPLE",
}

export enum StorageFileClass {
  IMAGE = "IMAGE",
  DOCUMENT = "DOCUMENT",
  BINARY = "BINARY",
}

export enum StoragePrivateAccess {
  PUBLIC_ONLY = "PUBLIC_ONLY",
  AUTHORIZED_PRIVATE = "AUTHORIZED_PRIVATE",
}

export enum StorageUploadStrategy {
  DIRECT = "DIRECT",
  QUARANTINE = "QUARANTINE",
}

/**
 * A trusted backend path component.
 *
 * Example:
 * [
 *   { collection: "workspaces", id: "wrk_123" },
 *   { collection: "projects", id: "prj_456" }
 * ]
 */
export interface StoragePathNode {
  collection: string;
  id: string;
}

/**
 * Identifies the logical location of an asset.
 *
 * This does not contain an S3 key. The storage module creates the key.
 */
export interface StorageTarget {
  nodes: readonly StoragePathNode[];

  /**
   * Logical field such as:
   * avatar, logo, cover, thumbnail, gallery, attachment.
   */
  slot: string;
}

export interface StorageFileDescriptor {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StoragePolicyOverrides {
  visibility?: StorageVisibility;
  cardinality?: StorageCardinality;
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
  uploadExpiresInSeconds?: number;
  cacheControl?: string;
  uploadStrategy?: StorageUploadStrategy;
}

export interface CreateUploadIntentInput {
  actorId: string;
  target: StorageTarget;
  fileClass: StorageFileClass;
  file: StorageFileDescriptor;

  /**
   * Supplied only by trusted backend domain services.
   * This must never come directly from the frontend request.
   */
  policy?: StoragePolicyOverrides;
}

export interface PresignedPostUpload {
  method: "POST";
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface UploadIntentResult {
  uploadId: string;
  upload: PresignedPostUpload;
}

export interface CompleteUploadInput {
  actorId: string;
  uploadId: string;
}

export interface StorageAssetAccess {
  url: string;
  expiresAt: Date | null;
}

export interface CompletedStorageAsset {
  id: string;
  targetKey: string;
  visibility: StorageVisibility;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  /** Null only when post-commit private URL signing temporarily fails. */
  access: StorageAssetAccess | null;
}

export interface ResolveTargetUrlsInput {
  target: StorageTarget;

  /**
   * Domain modules must authorize private access before passing
   * AUTHORIZED_PRIVATE.
   */
  privateAccess: StoragePrivateAccess;

  privateUrlExpiresInSeconds?: number;
}

export interface ResolvedStorageAsset {
  id: string;
  url: string;
  visibility: StorageVisibility;
  mimeType: string;
  sizeBytes: number;
}

export interface DeleteStorageAssetInput {
  actorId: string;
  assetId: string;
  target: StorageTarget;
}
