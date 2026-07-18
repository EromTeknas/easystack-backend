import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ClientConfig,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { createPresignedPost } from
  "@aws-sdk/s3-presigned-post";

import { getSignedUrl } from
  "@aws-sdk/s3-request-presigner";

import {
  CopyStoredObjectInput,
  CreatePresignedDownloadInput,
  CreatePresignedPostInput,
  ObjectMetadata,
  ObjectStorageProvider,
  PresignedPostResult,
  StorageContentDisposition,
} from "../../ports/ObjectStorageProvider";

import {
  ObjectStorageProviderError,
  ObjectStorageProviderErrorCode,
} from "../../ports/ObjectStorageProviderError";

import { S3ObjectStorageConfig } from "./s3.types";

type ExactPostCondition = [
  "eq",
  string,
  string,
];

type ContentLengthPostCondition = [
  "content-length-range",
  number,
  number,
];

type PostCondition =
  | ExactPostCondition
  | ContentLengthPostCondition;

export class S3ObjectStorageProvider
  implements ObjectStorageProvider
{
  private readonly operationClient: S3Client;
  private readonly presignClient: S3Client;

  constructor(
    private readonly config: S3ObjectStorageConfig,
  ) {
    this.validateConfig(config);

    /*
     * operationClient is used by the backend container.
     *
     * Example:
     * http://minio:9000
     */
    this.operationClient = this.createClient(
      config.internalEndpoint,
    );

    /*
     * presignClient creates URLs that must be accessible from
     * the user's browser.
     *
     * Example:
     * http://localhost:9000
     */
    this.presignClient = this.createClient(
      config.publicEndpoint ??
        config.internalEndpoint,
    );
  }

  async createPresignedPost(
    input: CreatePresignedPostInput,
  ): Promise<PresignedPostResult> {
    return this.execute(
      "create presigned POST",
      async () => {
        this.validateObjectKey(input.objectKey);
        this.validateExpiry(input.expiresInSeconds);

        if (
          !Number.isSafeInteger(
            input.minimumSizeBytes,
          ) ||
          !Number.isSafeInteger(
            input.maximumSizeBytes,
          ) ||
          input.minimumSizeBytes < 0 ||
          input.maximumSizeBytes <= 0 ||
          input.minimumSizeBytes >
            input.maximumSizeBytes
        ) {
          throw new ObjectStorageProviderError({
            code:
              ObjectStorageProviderErrorCode
                .INVALID_REQUEST,

            message:
              "Invalid presigned POST size range.",
          });
        }

        const contentType =
          normalizeMimeType(input.contentType);

        const metadataFields =
          this.buildMetadataFields(input.metadata);

        const fields: Record<string, string> = {
          "Content-Type": contentType,
          "Cache-Control": input.cacheControl,

          ...metadataFields,
          ...this.buildEncryptionFields(),
        };

        const conditions: PostCondition[] = [
          [
            "content-length-range",
            input.minimumSizeBytes,
            input.maximumSizeBytes,
          ],

          [
            "eq",
            "$Content-Type",
            contentType,
          ],

          [
            "eq",
            "$Cache-Control",
            input.cacheControl,
          ],

          ...Object.entries(metadataFields).map(
            ([field, value]) =>
              [
                "eq",
                `$${field}`,
                value,
              ] as ExactPostCondition,
          ),

          ...Object.entries(
            this.buildEncryptionFields(),
          ).map(
            ([field, value]) =>
              [
                "eq",
                `$${field}`,
                value,
              ] as ExactPostCondition,
          ),
        ];

        const result = await createPresignedPost(
          this.presignClient as unknown as Parameters<typeof createPresignedPost>[0],
          {
            Bucket: this.config.bucket,
            Key: input.objectKey,
            Fields: fields,
            Conditions: conditions,
            Expires: input.expiresInSeconds,
          },
        );

        return {
          url: result.url,
          fields: result.fields,
        };
      },
    );
  }

  async headObject(
    objectKey: string,
  ): Promise<ObjectMetadata> {
    return this.execute(
      "read object metadata",
      async () => {
        this.validateObjectKey(objectKey);

        const response =
          await this.operationClient.send(
            new HeadObjectCommand({
              Bucket: this.config.bucket,
              Key: objectKey,
            }),
          );

        return {
          contentType: response.ContentType
            ? normalizeMimeType(response.ContentType)
            : null,

          contentLength:
            response.ContentLength ?? null,

          etag: normalizeEtag(response.ETag),

          checksum:
            response.ChecksumSHA256 ??
            response.ChecksumSHA1 ??
            response.ChecksumCRC32C ??
            response.ChecksumCRC32 ??
            null,

          /*
           * S3 returns user metadata without the
           * x-amz-meta- prefix.
           */
          metadata: normalizeReturnedMetadata(
            response.Metadata,
          ),
        };
      },
    );
  }

  async copyObject(
    input: CopyStoredObjectInput,
  ): Promise<void> {
    await this.execute(
      "copy object",
      async () => {
        this.validateObjectKey(
          input.sourceObjectKey,
        );

        this.validateObjectKey(
          input.destinationObjectKey,
        );

        const source = encodeCopySource(
          this.config.bucket,
          input.sourceObjectKey,
        );

        await this.operationClient.send(
          new CopyObjectCommand({
            Bucket: this.config.bucket,
            Key: input.destinationObjectKey,

            CopySource: source,

            /*
             * Replace temporary-object metadata with the final
             * asset metadata and caching policy.
             */
            MetadataDirective: "REPLACE",

            ContentType: normalizeMimeType(
              input.contentType,
            ),

            CacheControl: input.cacheControl,

            Metadata: normalizeMetadata(
              input.metadata,
            ),

            ...this.buildEncryptionCommandInput(),
          }),
        );
      },
    );
  }

  async deleteObject(
    objectKey: string,
  ): Promise<void> {
    await this.execute(
      "delete object",
      async () => {
        this.validateObjectKey(objectKey);

        /*
         * S3 DeleteObject is naturally suitable for idempotent
         * cleanup. Repeated deletion requests can use the same
         * operation.
         */
        await this.operationClient.send(
          new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: objectKey,
          }),
        );
      },
    );
  }

  async createPresignedDownloadUrl(
    input: CreatePresignedDownloadInput,
  ): Promise<string> {
    return this.execute(
      "create presigned download URL",
      async () => {
        this.validateObjectKey(input.objectKey);
        this.validateExpiry(
          input.expiresInSeconds,
        );

        const responseContentDisposition =
          input.disposition === StorageContentDisposition.ATTACHMENT
            ? buildContentDisposition("attachment", input.fileName)
            : input.disposition === StorageContentDisposition.INLINE
              ? buildContentDisposition("inline", input.fileName)
              : undefined;

        const command = new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,

          ResponseContentDisposition:
            responseContentDisposition,
        });

        return getSignedUrl(
          this.presignClient as unknown as Parameters<typeof getSignedUrl>[0],
          command,
          {
            expiresIn: input.expiresInSeconds,
          },
        );
      },
    );
  }

  private createClient(
    endpoint?: string,
  ): S3Client {
    const credentials =
      this.config.accessKeyId &&
      this.config.secretAccessKey
        ? {
            accessKeyId:
              this.config.accessKeyId,

            secretAccessKey:
              this.config.secretAccessKey,

            sessionToken:
              this.config.sessionToken,
          }
        : undefined;

    return new S3Client({
      region: this.config.region,
      endpoint,
      forcePathStyle:
        this.config.forcePathStyle,
      credentials,

      /*
       * Do not enable followRegionRedirects when the bucket
       * region is already known. A correct region avoids an
       * unnecessary failed request and redirect.
       */
      followRegionRedirects: false,
    } as S3ClientConfig);
  }

  private buildMetadataFields(
    metadata: Readonly<Record<string, string>>,
  ): Record<string, string> {
    const normalized = normalizeMetadata(metadata);

    return Object.fromEntries(
      Object.entries(normalized).map(
        ([key, value]) => [
          `x-amz-meta-${key}`,
          value,
        ],
      ),
    );
  }

  private buildEncryptionFields():
    Record<string, string> {
    if (!this.config.serverSideEncryption) {
      return {};
    }

    if (
      this.config.serverSideEncryption ===
      "AES256"
    ) {
      return {
        "x-amz-server-side-encryption":
          "AES256",
      };
    }

    if (!this.config.kmsKeyId) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          "S3 KMS encryption requires kmsKeyId.",
      });
    }

    return {
      "x-amz-server-side-encryption":
        "aws:kms",

      "x-amz-server-side-encryption-aws-kms-key-id":
        this.config.kmsKeyId,
    };
  }

  private buildEncryptionCommandInput(): {
    ServerSideEncryption?:
      | "AES256"
      | "aws:kms";

    SSEKMSKeyId?: string;
  } {
    if (!this.config.serverSideEncryption) {
      return {};
    }

    if (
      this.config.serverSideEncryption ===
      "AES256"
    ) {
      return {
        ServerSideEncryption: "AES256",
      };
    }

    if (!this.config.kmsKeyId) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          "S3 KMS encryption requires kmsKeyId.",
      });
    }

    return {
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: this.config.kmsKeyId,
    };
  }

  private validateObjectKey(
    objectKey: string,
  ): void {
    if (
      !objectKey ||
      objectKey.startsWith("/") ||
      objectKey.endsWith("/") ||
      objectKey.includes("\\") ||
      objectKey.includes("\0")
    ) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message: "Invalid object-storage key.",
      });
    }

    const sizeBytes = Buffer.byteLength(
      objectKey,
      "utf8",
    );

    if (sizeBytes > 512) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          "Object-storage key exceeds 512 bytes.",
      });
    }
  }

  private validateExpiry(
    expiresInSeconds: number,
  ): void {
    if (
      !Number.isSafeInteger(expiresInSeconds) ||
      expiresInSeconds < 1 ||
      expiresInSeconds > 3_600
    ) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          "Signed URL expiry must be between " +
          "1 and 3600 seconds.",
      });
    }
  }

  private validateConfig(
    config: S3ObjectStorageConfig,
  ): void {
    if (!config.bucket.trim()) {
      throw new Error(
        "S3 bucket configuration is required.",
      );
    }

    if (!config.region.trim()) {
      throw new Error(
        "S3 region configuration is required.",
      );
    }

    const hasAccessKey =
      Boolean(config.accessKeyId);

    const hasSecretKey =
      Boolean(config.secretAccessKey);

    if (hasAccessKey !== hasSecretKey) {
      throw new Error(
        "Both S3 access key and secret key " +
        "must be configured together.",
      );
    }

    if (
      config.serverSideEncryption ===
        "aws:kms" &&
      !config.kmsKeyId
    ) {
      throw new Error(
        "S3 KMS encryption requires a KMS key ID.",
      );
    }
  }

  private async execute<T>(
    operation: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      if (
        error instanceof
        ObjectStorageProviderError
      ) {
        throw error;
      }

      throw mapS3Error(operation, error);
    }
  }
}

function normalizeMetadata(
  metadata: Readonly<Record<string, string>>,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(
    metadata,
  )) {
    const key = rawKey
      .trim()
      .toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(key)) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          `Invalid object metadata key: ${rawKey}`,
      });
    }

    const value = rawValue.trim();

    if (!value) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          `Object metadata value is empty: ${key}`,
      });
    }

    if (/[\r\n]/.test(value)) {
      throw new ObjectStorageProviderError({
        code:
          ObjectStorageProviderErrorCode
            .INVALID_REQUEST,

        message:
          `Object metadata contains invalid characters: ${key}`,
      });
    }

    normalized[key] = value;
  }

  return normalized;
}

function normalizeReturnedMetadata(
  metadata:
    | Record<string, string>
    | undefined,
): Record<string, string> {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).map(
      ([key, value]) => [
        key.toLowerCase(),
        value,
      ],
    ),
  );
}

function normalizeMimeType(
  mimeType: string,
): string {
  const normalized = mimeType
    .trim()
    .toLowerCase()
    .split(";", 1)[0];

  if (!normalized) {
    throw new ObjectStorageProviderError({
      code: ObjectStorageProviderErrorCode.INVALID_REQUEST,
      message: "MIME type cannot be empty.",
    });
  }

  return normalized;
}

function normalizeEtag(
  etag: string | undefined,
): string | null {
  if (!etag) {
    return null;
  }

  return etag.replace(/^"|"$/g, "");
}

function encodeCopySource(
  bucket: string,
  objectKey: string,
): string {
  const encodedBucket =
    encodeURIComponent(bucket);

  const encodedKey = objectKey
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment),
    )
    .join("/");

  return `${encodedBucket}/${encodedKey}`;
}

function buildContentDisposition(
  disposition: "inline" | "attachment",
  originalName?: string,
): string {
  if (!originalName) {
    return disposition;
  }
  const cleanName = originalName
    .replace(/[\r\n]/g, "")
    .trim()
    .slice(0, 255);

  const asciiFallback = cleanName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");

  const encodedUtf8 =
    encodeURIComponent(cleanName)
      .replace(/['()*]/g, (character) => {
        return (
          "%" +
          character
            .charCodeAt(0)
            .toString(16)
            .toUpperCase()
        );
      });

  return (
    `${disposition}; filename="${asciiFallback}"; ` +
    `filename*=UTF-8''${encodedUtf8}`
  );
}

function mapS3Error(
  operation: string,
  error: unknown,
): ObjectStorageProviderError {
  const statusCode =
    error instanceof S3ServiceException
      ? error.$metadata.httpStatusCode
      : undefined;

  const errorName =
    error instanceof Error
      ? error.name
      : "UnknownError";

  if (
    statusCode === 404 ||
    errorName === "NotFound" ||
    errorName === "NoSuchKey"
  ) {
    return new ObjectStorageProviderError({
      code:
        ObjectStorageProviderErrorCode
          .OBJECT_NOT_FOUND,

      message:
        `Object was not found while attempting to ${operation}.`,

      cause: error,
      statusCode,
      retryable: false,
    });
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    errorName === "AccessDenied"
  ) {
    return new ObjectStorageProviderError({
      code:
        ObjectStorageProviderErrorCode
          .ACCESS_DENIED,

      message:
        `Object storage denied the request to ${operation}.`,

      cause: error,
      statusCode,
      retryable: false,
    });
  }

  if (
    statusCode === 400 ||
    statusCode === 409 ||
    statusCode === 412
  ) {
    return new ObjectStorageProviderError({
      code:
        ObjectStorageProviderErrorCode
          .INVALID_REQUEST,

      message:
        `Object storage rejected the request to ${operation}.`,

      cause: error,
      statusCode,
      retryable: false,
    });
  }

  if (
    statusCode === 429 ||
    (statusCode !== undefined &&
      statusCode >= 500)
  ) {
    return new ObjectStorageProviderError({
      code:
        ObjectStorageProviderErrorCode
          .TEMPORARY_FAILURE,

      message:
        `Object storage temporarily failed to ${operation}.`,

      cause: error,
      statusCode,
      retryable: true,
    });
  }

  return new ObjectStorageProviderError({
    code:
      ObjectStorageProviderErrorCode.UNKNOWN,

    message:
      `Unexpected object-storage error while attempting to ${operation}.`,

    cause: error,
    statusCode,
    retryable: false,
  });
}
