import { randomUUID } from "node:crypto";

import {
  CompleteUploadInput,
  CompletedStorageAsset,
  CreateUploadIntentInput,
  DeleteStorageAssetInput,
  ResolvedStorageAsset,
  ResolveTargetUrlsInput,
  StoragePrivateAccess,
  StorageVisibility,
  StorageAssetAccess,
  StorageUploadStrategy,
  UploadIntentResult,
} from "../public/storage.contracts";
import { StorageService } from "../public/StorageService";

import { ObjectKeyBuilder } from "../domain/ObjectKeyBuilder";
import {
  StorageAssetRecord,
  StorageAssetStatus,
  StorageUploadIntentRecord,
  StorageUploadIntentStatus,
} from "../domain/storage.records";
import { StorageError, StorageErrorCode } from "../domain/StorageError";

import { ObjectStorageProvider, StorageContentDisposition } from "../ports/ObjectStorageProvider";
import { ObjectStorageProviderError, ObjectStorageProviderErrorCode } from "../ports/ObjectStorageProviderError";
import {
  ScheduleObjectDeletionInput,
  StorageCleanupScheduler,
  StorageDeletionReason,
} from "../ports/StorageCleanupScheduler";
import { StoragePersistence } from "../ports/StoragePersistence";
import { StoragePolicyResolver } from "./StoragePolicyResolver";

interface DefaultStorageServiceConfig {
  cdnBaseUrl: string;
  defaultPrivateUrlExpiresInSeconds: number;
}

export class DefaultStorageService implements StorageService {
  constructor(
    private readonly persistence: StoragePersistence,
    private readonly objectStorage: ObjectStorageProvider,
    private readonly cleanupScheduler: StorageCleanupScheduler,
    private readonly keyBuilder: ObjectKeyBuilder,
    private readonly policyResolver: StoragePolicyResolver,
    private readonly config: DefaultStorageServiceConfig,
  ) {}

  async createUploadIntent(
    input: CreateUploadIntentInput,
  ): Promise<UploadIntentResult> {
    this.validateActorId(input.actorId);
    this.keyBuilder.validateTarget(input.target);
    this.validateOriginalName(input.file.originalName);

    const policy = this.policyResolver.resolve(input.fileClass, input.policy);

    const normalizedMimeType = this.normalizeMimeType(input.file.mimeType);

    this.validateFile({
      sizeBytes: input.file.sizeBytes,
      mimeType: normalizedMimeType,
      maxSizeBytes: policy.maxSizeBytes,
      allowedMimeTypes: policy.allowedMimeTypes,
    });

    const uploadId = `upl_${randomUUID()}`;
    const assetId = `ast_${randomUUID()}`;

    const targetKey = this.keyBuilder.buildTargetKey(input.target);

    const temporaryObjectKey = this.keyBuilder.buildTemporaryObjectKey({
      uploadId,
      assetId,
      mimeType: normalizedMimeType,
    });

    const finalObjectKey = this.keyBuilder.buildFinalObjectKey({
      visibility: policy.visibility,
      target: input.target,
      assetId,
      mimeType: normalizedMimeType,
    });

    const uploadObjectKey = policy.uploadStrategy === StorageUploadStrategy.QUARANTINE
      ? temporaryObjectKey
      : finalObjectKey;

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() + policy.uploadExpiresInSeconds * 1000,
    );

    const uploadIntent: StorageUploadIntentRecord = {
      id: uploadId,
      assetId,
      actorId: input.actorId,

      target: input.target,
      targetKey,

      fileClass: input.fileClass,

      file: {
        ...input.file,
        mimeType: normalizedMimeType,
      },

      policy,

      temporaryObjectKey,
      finalObjectKey,

      status: StorageUploadIntentStatus.CREATED,
      expiresAt,
      completedAt: null,
      cleanedAt: null,

      createdAt: now,
      updatedAt: now,
    };

    await this.persistence.createUploadIntent(uploadIntent);

    try {
      const presignedUpload = await this.objectStorage.createPresignedPost({
        objectKey: uploadObjectKey,
        contentType: normalizedMimeType,

        minimumSizeBytes: 1,
        maximumSizeBytes: policy.maxSizeBytes,

        expiresInSeconds: policy.uploadExpiresInSeconds,
        cacheControl: policy.uploadStrategy === StorageUploadStrategy.DIRECT
          ? policy.cacheControl
          : "private, no-store",

        metadata: {
          "upload-id": uploadId,
          "asset-id": assetId,
          "actor-id": input.actorId,
        },
      });

      return {
        uploadId,
        upload: {
          method: "POST",
          url: presignedUpload.url,
          fields: presignedUpload.fields,
          expiresAt,
        },
      };
    } catch (error) {
      await this.persistence.markUploadIntentFailed(
        uploadId,
        "Failed to create presigned upload.",
      );

      throw new StorageError({
        code: StorageErrorCode.STORAGE_PROVIDER_ERROR,
        statusCode: 502,
        message: "Failed to create the upload request.",
        cause: error,
      });
    }
  }

  async completeUpload(
    input: CompleteUploadInput,
  ): Promise<CompletedStorageAsset> {
    this.validateActorId(input.actorId);

    const intent = await this.persistence.findUploadIntentById(input.uploadId);

    if (!intent) {
      throw new StorageError({
        code: StorageErrorCode.UPLOAD_INTENT_NOT_FOUND,
        statusCode: 404,
        message: "Upload intent was not found.",
      });
    }

    if (intent.actorId !== input.actorId) {
      throw new StorageError({
        code: StorageErrorCode.UPLOAD_INTENT_FORBIDDEN,
        statusCode: 403,
        message: "You are not permitted to complete this upload.",
      });
    }

    if (intent.status === StorageUploadIntentStatus.COMPLETED) {
      const completedAsset = await this.persistence.findAssetById(
        intent.assetId,
      );

      if (!completedAsset) {
        throw new StorageError({
          code: StorageErrorCode.STORAGE_PERSISTENCE_ERROR,
          statusCode: 500,
          message: "Completed upload does not have an associated asset.",
        });
      }

      return this.toCompletedAsset(completedAsset);
    }

    if (intent.status === StorageUploadIntentStatus.FAILED) {
      throw new StorageError({
        code: StorageErrorCode.UPLOAD_INTENT_FAILED,
        statusCode: 409,
        message: "The upload intent has failed.",
      });
    }

    if (intent.expiresAt.getTime() <= Date.now()) {
      throw new StorageError({
        code: StorageErrorCode.UPLOAD_INTENT_EXPIRED,
        statusCode: 410,
        message: "The upload intent has expired.",
      });
    }

    let uploadedObject;

    try {
      uploadedObject = await this.objectStorage.headObject(
        this.getUploadObjectKey(intent),
      );
    } catch (error) {
      if (
        error instanceof ObjectStorageProviderError &&
        error.code === ObjectStorageProviderErrorCode.OBJECT_NOT_FOUND
      ) {
        throw new StorageError({
          code: StorageErrorCode.UPLOADED_OBJECT_NOT_FOUND,
          statusCode: 404,
        message: "The uploaded object could not be found in object storage.",
          cause: error,
        });
      }

      throw new StorageError({
        code: StorageErrorCode.STORAGE_PROVIDER_ERROR,
        statusCode: 502,
        message: "Uploaded object storage could not be verified.",
        cause: error,
      });
    }

    this.validateUploadedObject({
      intent,
      contentType: uploadedObject.contentType,
      contentLength: uploadedObject.contentLength,
      metadata: uploadedObject.metadata,
    });

    if (intent.policy.uploadStrategy === StorageUploadStrategy.QUARANTINE) {
      try {
        await this.objectStorage.copyObject({
        sourceObjectKey: intent.temporaryObjectKey,
        destinationObjectKey: intent.finalObjectKey,

        contentType: intent.file.mimeType,
        cacheControl: intent.policy.cacheControl,

        metadata: {
          "upload-id": intent.id,
          "asset-id": intent.assetId,
          "created-by": intent.actorId,
        },
        });
      } catch (error) {
        throw new StorageError({
          code: StorageErrorCode.STORAGE_PROVIDER_ERROR,
          statusCode: 502,
          message: "Failed to move the uploaded object into permanent storage.",
          cause: error,
        });
      }
    }

    const now = new Date();

    const asset: StorageAssetRecord = {
      id: intent.assetId,

      target: intent.target,
      targetKey: intent.targetKey,

      objectKey: intent.finalObjectKey,
      visibility: intent.policy.visibility,
      cardinality: intent.policy.cardinality,

      originalName: intent.file.originalName,
      mimeType: intent.file.mimeType,
      sizeBytes: uploadedObject.contentLength ?? intent.file.sizeBytes,

      etag: uploadedObject.etag,
      checksum: uploadedObject.checksum,

      status: StorageAssetStatus.ACTIVE,
      createdById: intent.actorId,

      createdAt: now,
      updatedAt: now,
    };

    let completionResult;

    try {
      completionResult = await this.persistence.completeUpload({
        uploadIntentId: intent.id,
        asset,
      });
    } catch (error) {
      /*
       * Another request may have completed the same upload.
       * Never delete the final object until this is ruled out.
       */
      const existingAsset = await this.persistence.findAssetById(
        intent.assetId,
      );

      if (
        existingAsset &&
        existingAsset.objectKey === intent.finalObjectKey &&
        existingAsset.status === StorageAssetStatus.ACTIVE
      ) {
        if (intent.policy.uploadStrategy === StorageUploadStrategy.QUARANTINE) {
          await this.scheduleDeletionSafely({
            objectKey: intent.temporaryObjectKey,
            reason: StorageDeletionReason.TEMPORARY_UPLOAD_COMPLETED,
          });
        }

        return this.toCompletedAsset(existingAsset);
      }

      await this.scheduleDeletionSafely({
        objectKey: intent.finalObjectKey,
        reason: StorageDeletionReason.ROLLBACK_AFTER_FAILURE,
      });

      throw new StorageError({
        code: StorageErrorCode.STORAGE_PERSISTENCE_ERROR,
        statusCode: 500,
        message:
          "Uploaded file was stored, but its database record could not be completed.",
        cause: error,
      });
    }

    await Promise.all([
      ...(intent.policy.uploadStrategy === StorageUploadStrategy.QUARANTINE
        ? [this.scheduleDeletionSafely({
            objectKey: intent.temporaryObjectKey,
            reason: StorageDeletionReason.TEMPORARY_UPLOAD_COMPLETED,
          })]
        : []),
      ...completionResult.replacedAssets.map((replacedAsset) =>
        this.scheduleDeletionSafely({
          objectKey: replacedAsset.objectKey,
          assetId: replacedAsset.id,
          reason: StorageDeletionReason.REPLACED_BY_NEW_ASSET,
        }),
      ),
    ]);

    return this.toCompletedAsset(completionResult.asset);
  }

  private async scheduleDeletionSafely(
    input: ScheduleObjectDeletionInput,
  ): Promise<void> {
    try {
      await this.cleanupScheduler.scheduleObjectDeletion(input);
    } catch (error) {
      /*
       * Log the error. Do not fail an already committed upload.
       * The reconciliation worker will enqueue it again.
       */
      console.error("Failed to schedule storage cleanup", {
        input,
        error,
      });
    }
  }
  async resolveTargetUrls(
    input: ResolveTargetUrlsInput,
  ): Promise<ResolvedStorageAsset[]> {
    const targetKey = this.keyBuilder.buildTargetKey(input.target);

    const assets = await this.persistence.findActiveAssetsByTarget(targetKey);

    const resolvedAssets: ResolvedStorageAsset[] = [];

    for (const asset of assets) {
      if (asset.visibility === StorageVisibility.PUBLIC) {
        resolvedAssets.push({
          id: asset.id,
          url: this.buildCdnUrl(asset.objectKey),
          visibility: asset.visibility,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
        });

        continue;
      }

      if (input.privateAccess !== StoragePrivateAccess.AUTHORIZED_PRIVATE) {
        continue;
      }

      const url = await this.objectStorage.createPresignedDownloadUrl({
        objectKey: asset.objectKey,
        expiresInSeconds:
          input.privateUrlExpiresInSeconds ??
          this.config.defaultPrivateUrlExpiresInSeconds,
        disposition: StorageContentDisposition.INLINE,
      });

      resolvedAssets.push({
        id: asset.id,
        url,
        visibility: asset.visibility,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      });
    }

    return resolvedAssets;
  }

  async deleteAsset(input: DeleteStorageAssetInput): Promise<void> {
    this.validateActorId(input.actorId);

    /**
     * Authorization belongs to the domain calling this service.
     *
     * For example:
     * - User module checks user owns avatar
     * - Workspace module checks workspace:update
     * - Project module checks project:update
     */
    this.keyBuilder.validateTarget(input.target);
    const asset = await this.persistence.requestAssetDeletion(
      input.assetId,
      this.keyBuilder.buildTargetKey(input.target),
      input.actorId,
    );

    await this.scheduleDeletionSafely({
      objectKey: asset.objectKey,
      assetId: asset.id,
      reason: StorageDeletionReason.USER_REQUESTED_DELETION,
    });
  }

  private validateFile(input: {
    sizeBytes: number;
    mimeType: string;
    maxSizeBytes: number;
    allowedMimeTypes: readonly string[];
  }): void {
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 400,
        message: "File size must be a positive integer.",
      });
    }

    if (input.sizeBytes > input.maxSizeBytes) {
      throw new StorageError({
        code: StorageErrorCode.FILE_TOO_LARGE,
        statusCode: 413,
        message: `File exceeds the maximum size of ${input.maxSizeBytes} bytes.`,
        details: {
          receivedSizeBytes: input.sizeBytes,
          maximumSizeBytes: input.maxSizeBytes,
        },
      });
    }

    if (!input.allowedMimeTypes.includes(input.mimeType)) {
      throw new StorageError({
        code: StorageErrorCode.MIME_TYPE_NOT_ALLOWED,
        statusCode: 415,
        message: `MIME type ${input.mimeType} is not permitted.`,
      });
    }
  }

  private validateUploadedObject(input: {
    intent: StorageUploadIntentRecord;
    contentType: string | null;
    contentLength: number | null;
    metadata: Record<string, string>;
  }): void {
    const contentType = input.contentType
      ? this.normalizeMimeType(input.contentType)
      : null;

    if (!contentType || contentType !== input.intent.file.mimeType) {
      throw new StorageError({
        code: StorageErrorCode.UPLOADED_OBJECT_INVALID,
        statusCode: 422,
        message: "Uploaded object MIME type does not match the upload intent.",
      });
    }

    if (
      input.contentLength === null ||
      input.contentLength <= 0 ||
      input.contentLength > input.intent.policy.maxSizeBytes
    ) {
      throw new StorageError({
        code: StorageErrorCode.UPLOADED_OBJECT_INVALID,
        statusCode: 422,
        message: "Uploaded object has an invalid size.",
      });
    }

    const uploadId = input.metadata["upload-id"];
    const assetId = input.metadata["asset-id"];
    const actorId = input.metadata["actor-id"];

    if (
      uploadId !== input.intent.id ||
      assetId !== input.intent.assetId ||
      actorId !== input.intent.actorId
    ) {
      throw new StorageError({
        code: StorageErrorCode.UPLOADED_OBJECT_INVALID,
        statusCode: 422,
        message: "Uploaded object metadata does not match the upload intent.",
      });
    }
  }

  private normalizeMimeType(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase().split(";", 1)[0];
    if (!normalized) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 400,
        message: "MIME type cannot be empty.",
      });
    }
    return normalized;
  }

  private validateOriginalName(originalName: string): void {
    const normalized = originalName.trim();
    if (!normalized || normalized.length > 255 || /[\r\n\0]/.test(normalized)) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 400,
        message: "File name must be valid and contain between 1 and 255 characters.",
      });
    }
  }

  private validateActorId(actorId: string): void {
    if (!actorId?.trim()) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_FILE,
        statusCode: 400,
        message: "Actor ID is required.",
      });
    }
  }

  private buildCdnUrl(objectKey: string): string {
    const baseUrl = this.config.cdnBaseUrl.replace(/\/+$/, "");
    const normalizedObjectKey = objectKey.replace(/^\/+/, "");

    return `${baseUrl}/${normalizedObjectKey}`;
  }

  private async toCompletedAsset(asset: StorageAssetRecord): Promise<CompletedStorageAsset> {
    return {
      id: asset.id,
      targetKey: asset.targetKey,
      visibility: asset.visibility,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt,
      access: await this.resolveAssetAccessSafely(asset),
    };
  }

  private getUploadObjectKey(intent: StorageUploadIntentRecord): string {
    return intent.policy.uploadStrategy === StorageUploadStrategy.QUARANTINE
      ? intent.temporaryObjectKey
      : intent.finalObjectKey;
  }

  private async resolveAssetAccessSafely(
    asset: StorageAssetRecord,
  ): Promise<StorageAssetAccess | null> {
    if (asset.visibility === StorageVisibility.PUBLIC) {
      return { url: this.buildCdnUrl(asset.objectKey), expiresAt: null };
    }

    const expiresInSeconds = this.config.defaultPrivateUrlExpiresInSeconds;
    try {
      const url = await this.objectStorage.createPresignedDownloadUrl({
        objectKey: asset.objectKey,
        expiresInSeconds,
        disposition: StorageContentDisposition.INLINE,
      });
      return {
        url,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    } catch (error) {
      console.error("Failed to resolve access for a committed storage asset", {
        assetId: asset.id,
        error,
      });
      return null;
    }
  }
}
