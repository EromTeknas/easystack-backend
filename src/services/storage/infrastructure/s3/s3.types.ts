export interface S3ObjectStorageConfig {
  bucket: string;
  region: string;

  /**
   * Used for backend-to-storage operations.
   *
   * Local:
   * http://minio:9000
   *
   * AWS:
   * undefined
   */
  internalEndpoint?: string | undefined;

  /**
   * Used when creating browser-facing signed URLs.
   *
   * Local:
   * http://localhost:9000
   *
   * AWS:
   * undefined
   */
  publicEndpoint?: string | undefined;

  /**
   * Required for MinIO and most local S3-compatible services.
   */
  forcePathStyle: boolean;

  /**
   * Leave credentials undefined in production when using an
   * IAM role or another default AWS credential provider.
   */
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  sessionToken?: string | undefined;

  serverSideEncryption?:
    | "AES256"
    | "aws:kms"
    | undefined;

  kmsKeyId?: string | undefined;
}
