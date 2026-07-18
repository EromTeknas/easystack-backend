export interface CreatePresignedPostInput {
  objectKey: string;
  contentType: string;

  minimumSizeBytes: number;
  maximumSizeBytes: number;

  expiresInSeconds: number;
  cacheControl: string;

  metadata: Readonly<Record<string, string>>;
}

export interface PresignedPostResult {
  url: string;
  fields: Record<string, string>;
}

export interface ObjectMetadata {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksum: string | null;
  metadata: Record<string, string>;
}

export interface CopyStoredObjectInput {
  sourceObjectKey: string;
  destinationObjectKey: string;

  contentType: string;
  cacheControl: string;

  metadata: Readonly<Record<string, string>>;
}

export interface CreatePresignedDownloadInput {
  objectKey: string;
  expiresInSeconds: number;
  downloadFileName?: string;
}

export interface ObjectStorageProvider {
  createPresignedPost(
    input: CreatePresignedPostInput,
  ): Promise<PresignedPostResult>;

  headObject(objectKey: string): Promise<ObjectMetadata>;

  copyObject(input: CopyStoredObjectInput): Promise<void>;

  deleteObject(objectKey: string): Promise<void>;

  createPresignedDownloadUrl(
    input: CreatePresignedDownloadInput,
  ): Promise<string>;
}