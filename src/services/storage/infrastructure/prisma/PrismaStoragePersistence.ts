import {
  Prisma,
  PrismaClient,
  StorageAssetStatus as PrismaStorageAssetStatus,
  StorageCardinality as PrismaStorageCardinality,
  StorageFileClass as PrismaStorageFileClass,
  StorageUploadIntentStatus as PrismaUploadIntentStatus,
  StorageUploadStrategy as PrismaUploadStrategy,
  StorageVisibility as PrismaStorageVisibility,
} from "@prisma/client";

import {
  StorageCardinality,
  StorageFileClass,
  StorageTarget,
  StorageVisibility,
  StorageUploadStrategy,
} from "../../public/storage.contracts";

import {
  CompleteUploadTransactionInput,
  CompleteUploadTransactionResult,
  StorageAssetRecord,
  StorageAssetStatus,
  StorageUploadIntentRecord,
  StorageUploadIntentStatus,
} from "../../domain/storage.records";

import {
  StorageError,
  StorageErrorCode,
} from "../../domain/StorageError";

import { StoragePersistence } from "../../ports/StoragePersistence";

type UploadIntentRow =
  Prisma.StorageUploadIntentGetPayload<Record<string, never>>;

type AssetRow =
  Prisma.StorageAssetGetPayload<Record<string, never>>;

const MAX_TRANSACTION_RETRIES = 4;

export class PrismaStoragePersistence
  implements StoragePersistence
{
  constructor(private readonly prisma: PrismaClient) {}

  async createUploadIntent(
    intent: StorageUploadIntentRecord,
  ): Promise<void> {
    await this.execute(
      "create storage upload intent",
      async () => {
        await this.prisma.storageUploadIntent.create({
          data: {
            id: intent.id,
            intendedAssetId: intent.assetId,
            actorId: intent.actorId,

            targetKey: intent.targetKey,
            target: serializeTarget(intent.target),

            fileClass: toPrismaFileClass(intent.fileClass),

            originalName: intent.file.originalName,
            mimeType: intent.file.mimeType,
            claimedSizeBytes: BigInt(intent.file.sizeBytes),

            visibility: toPrismaVisibility(
              intent.policy.visibility,
            ),

            cardinality: toPrismaCardinality(
              intent.policy.cardinality,
            ),

            allowedMimeTypes: [
              ...intent.policy.allowedMimeTypes,
            ],

            maxSizeBytes: BigInt(
              intent.policy.maxSizeBytes,
            ),

            uploadExpiresInSeconds:
              intent.policy.uploadExpiresInSeconds,

            cacheControl: intent.policy.cacheControl,
            uploadStrategy: toPrismaUploadStrategy(intent.policy.uploadStrategy),

            temporaryObjectKey: intent.temporaryObjectKey,
            finalObjectKey: intent.finalObjectKey,

            status: toPrismaUploadStatus(intent.status),

            expiresAt: intent.expiresAt,
            completedAt: intent.completedAt,

            createdAt: intent.createdAt,
          },
        });
      },
    );
  }

  async findUploadIntentById(
    uploadIntentId: string,
  ): Promise<StorageUploadIntentRecord | null> {
    return this.execute(
      "find storage upload intent",
      async () => {
        const row =
          await this.prisma.storageUploadIntent.findUnique({
            where: {
              id: uploadIntentId,
            },
          });

        return row ? mapUploadIntent(row) : null;
      },
    );
  }

  async findAssetById(
    assetId: string,
  ): Promise<StorageAssetRecord | null> {
    return this.execute(
      "find storage asset",
      async () => {
        const row = await this.prisma.storageAsset.findUnique({
          where: {
            id: assetId,
          },
        });

        return row ? mapAsset(row) : null;
      },
    );
  }

  async findActiveAssetsByTarget(
    targetKey: string,
  ): Promise<StorageAssetRecord[]> {
    return this.execute(
      "find active storage assets",
      async () => {
        const rows =
          await this.prisma.storageAsset.findMany({
            where: {
              targetKey,
              status: PrismaStorageAssetStatus.ACTIVE,
            },
            orderBy: [
              {
                createdAt: "asc",
              },
              {
                id: "asc",
              },
            ],
          });

        return rows.map(mapAsset);
      },
    );
  }

  async findExpiredUploadIntents(
    before: Date,
    limit: number,
  ): Promise<StorageUploadIntentRecord[]> {
    return this.execute("find expired storage upload intents", async () => {
      const rows = await this.prisma.storageUploadIntent.findMany({
        where: { status: PrismaUploadIntentStatus.CREATED, expiresAt: { lte: before } },
        orderBy: { expiresAt: "asc" },
        take: validateLimit(limit),
      });
      return rows.map(mapUploadIntent);
    });
  }

  async findUploadIntentsRequiringTemporaryCleanup(
    before: Date,
    limit: number,
  ): Promise<StorageUploadIntentRecord[]> {
    return this.execute("find upload intents requiring temporary cleanup", async () => {
      const rows = await this.prisma.storageUploadIntent.findMany({
        where: {
          OR: [
            { status: PrismaUploadIntentStatus.EXPIRED },
            {
              status: PrismaUploadIntentStatus.COMPLETED,
              uploadStrategy: PrismaUploadStrategy.QUARANTINE,
            },
          ],
          updatedAt: { lte: before },
        },
        orderBy: { updatedAt: "asc" },
        take: validateLimit(limit),
      });
      return rows.map(mapUploadIntent);
    });
  }

  async markUploadIntentExpired(uploadIntentId: string): Promise<boolean> {
    return this.execute("mark storage upload intent expired", async () => {
      const result = await this.prisma.storageUploadIntent.updateMany({
        where: {
          id: uploadIntentId,
          status: PrismaUploadIntentStatus.CREATED,
          expiresAt: { lte: new Date() },
        },
        data: { status: PrismaUploadIntentStatus.EXPIRED },
      });
      return result.count === 1;
    });
  }

  async findDeletionPendingAssets(limit: number): Promise<StorageAssetRecord[]> {
    return this.execute("find deletion-pending storage assets", async () => {
      const rows = await this.prisma.storageAsset.findMany({
        where: { status: PrismaStorageAssetStatus.DELETION_PENDING },
        orderBy: { deletionRequestedAt: "asc" },
        take: validateLimit(limit),
      });
      return rows.map(mapAsset);
    });
  }

  async completeUpload(
    input: CompleteUploadTransactionInput,
  ): Promise<CompleteUploadTransactionResult> {
    return this.execute(
      "complete storage upload",
      () =>
        this.withSerializableTransaction(
          async (transaction) => {
            const intent =
              await transaction.storageUploadIntent.findUnique({
                where: {
                  id: input.uploadIntentId,
                },
              });

            if (!intent) {
              throw new StorageError({
                code:
                  StorageErrorCode.UPLOAD_INTENT_NOT_FOUND,
                statusCode: 404,
                message: "Upload intent was not found.",
              });
            }

            /*
             * Idempotent completion.
             *
             * A repeated /complete request returns the existing
             * asset instead of attempting another replacement.
             */
            if (
              intent.status ===
              PrismaUploadIntentStatus.COMPLETED
            ) {
              const existingAsset =
                await transaction.storageAsset.findUnique({
                  where: {
                    uploadIntentId: intent.id,
                  },
                });

              if (!existingAsset) {
                throw new StorageError({
                  code:
                    StorageErrorCode
                      .STORAGE_PERSISTENCE_ERROR,
                  statusCode: 500,
                  message:
                    "Completed upload intent does not have " +
                    "an associated storage asset.",
                });
              }

              return {
                asset: mapAsset(existingAsset),
                replacedAssets: [],
              };
            }

            if (
              intent.status ===
              PrismaUploadIntentStatus.EXPIRED
            ) {
              throw new StorageError({
                code:
                  StorageErrorCode.UPLOAD_INTENT_EXPIRED,
                statusCode: 410,
                message: "Upload intent has expired.",
              });
            }

            if (
              intent.status ===
              PrismaUploadIntentStatus.FAILED
            ) {
              throw new StorageError({
                code:
                  StorageErrorCode.UPLOAD_INTENT_FAILED,
                statusCode: 409,
                message: "Upload intent has failed.",
              });
            }

            validateCompletionInput(intent, input.asset);

            /*
             * Claim this upload intent.
             *
             * The status change and asset insertion are part of
             * the same transaction, so a later failure rolls
             * everything back.
             */
            const claimResult =
              await transaction.storageUploadIntent.updateMany({
                where: {
                  id: intent.id,
                  status:
                    PrismaUploadIntentStatus.CREATED,
                },
                data: {
                  status:
                    PrismaUploadIntentStatus.COMPLETED,
                  completedAt: new Date(),
                  failureReason: null,
                },
              });

            if (claimResult.count !== 1) {
              throw new StorageError({
                code:
                  StorageErrorCode
                    .STORAGE_PERSISTENCE_ERROR,
                statusCode: 409,
                message:
                  "Upload intent was completed by another request.",
              });
            }

            let replacedRows: AssetRow[] = [];

            if (
              input.asset.cardinality ===
              StorageCardinality.SINGLE
            ) {
              replacedRows =
                await transaction.storageAsset.findMany({
                  where: {
                    targetKey: input.asset.targetKey,
                    status:
                      PrismaStorageAssetStatus.ACTIVE,
                    id: {
                      not: input.asset.id,
                    },
                  },
                });

              if (replacedRows.length > 0) {
                const replacedIds = replacedRows.map(
                  (asset) => asset.id,
                );

                await transaction.storageAsset.updateMany({
                  where: {
                    id: {
                      in: replacedIds,
                    },
                    status:
                      PrismaStorageAssetStatus.ACTIVE,
                  },
                  data: {
                    status:
                      PrismaStorageAssetStatus
                        .DELETION_PENDING,

                    /*
                     * Release the database-enforced singleton
                     * lock before inserting the new asset.
                     */
                    activeSingletonKey: null,
                    deletionRequestedAt: new Date(),
                  },
                });
              }
            }

            const createdAsset =
              await transaction.storageAsset.create({
                data: {
                  id: input.asset.id,

                  uploadIntentId: intent.id,

                  targetKey: input.asset.targetKey,
                  target: serializeTarget(
                    input.asset.target,
                  ),

                  objectKey: input.asset.objectKey,

                  visibility: toPrismaVisibility(
                    input.asset.visibility,
                  ),

                  cardinality: toPrismaCardinality(
                    input.asset.cardinality,
                  ),

                  originalName:
                    input.asset.originalName,

                  mimeType: input.asset.mimeType,
                  sizeBytes: BigInt(
                    input.asset.sizeBytes,
                  ),

                  etag: input.asset.etag,
                  checksum: input.asset.checksum,

                  status: PrismaStorageAssetStatus.ACTIVE,

                  activeSingletonKey:
                    input.asset.cardinality ===
                    StorageCardinality.SINGLE
                      ? input.asset.targetKey
                      : null,

                  createdById:
                    input.asset.createdById,

                  createdAt: input.asset.createdAt,
                },
              });

            return {
              asset: mapAsset(createdAsset),
              replacedAssets:
                replacedRows.map(mapAsset),
            };
          },
        ),
    );
  }

  async markUploadIntentFailed(
    uploadIntentId: string,
    reason: string,
  ): Promise<void> {
    await this.execute(
      "mark storage upload intent failed",
      async () => {
        await this.prisma.storageUploadIntent.updateMany({
          where: {
            id: uploadIntentId,
            status: PrismaUploadIntentStatus.CREATED,
          },
          data: {
            status: PrismaUploadIntentStatus.FAILED,
            failureReason: truncate(reason, 4_000),
          },
        });
      },
    );
  }

  async requestAssetDeletion(
    assetId: string,
    expectedTargetKey: string,
    deletedById: string,
  ): Promise<StorageAssetRecord> {
    return this.execute(
      "request storage asset deletion",
      async () => {
        return this.withSerializableTransaction(
          async (transaction) => {
            const currentAsset =
              await transaction.storageAsset.findFirst({
                where: {
                  id: assetId,
                  targetKey: expectedTargetKey,
                },
              });

            if (!currentAsset) {
              throw new StorageError({
                code: StorageErrorCode.ASSET_NOT_FOUND,
                statusCode: 404,
                message: "Storage asset was not found.",
              });
            }

            /*
             * Deletion is idempotent. A worker can safely receive
             * the same deletion job more than once.
             */
            if (
              currentAsset.status ===
                PrismaStorageAssetStatus
                  .DELETION_PENDING ||
              currentAsset.status ===
                PrismaStorageAssetStatus.DELETED
            ) {
              return mapAsset(currentAsset);
            }

            const updatedAsset =
              await transaction.storageAsset.update({
                where: {
                  id: assetId,
                },
                data: {
                  status:
                    PrismaStorageAssetStatus
                      .DELETION_PENDING,

                  activeSingletonKey: null,
                  deletionRequestedAt: new Date(),
                  deletedById,
                },
              });

            return mapAsset(updatedAsset);
          },
        );
      },
    );
  }

  async markAssetDeleted(assetId: string): Promise<void> {
    await this.execute(
      "mark storage asset deleted",
      async () => {
        /*
         * updateMany makes the operation idempotent and does not
         * throw when the record was already removed.
         */
        await this.prisma.storageAsset.updateMany({
          where: {
            id: assetId,
            status: {
              not: PrismaStorageAssetStatus.DELETED,
            },
          },
          data: {
            status: PrismaStorageAssetStatus.DELETED,
            activeSingletonKey: null,
            deletedAt: new Date(),
          },
        });
      },
    );
  }

  private async withSerializableTransaction<T>(
    callback: (
      transaction: Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    let attempt = 0;

    while (attempt < MAX_TRANSACTION_RETRIES) {
      try {
        return await this.prisma.$transaction(callback, {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,

          maxWait: 5_000,
          timeout: 10_000,
        });
      } catch (error) {
        attempt += 1;

        if (
          isPrismaWriteConflict(error) &&
          attempt < MAX_TRANSACTION_RETRIES
        ) {
          await sleep(calculateRetryDelay(attempt));
          continue;
        }

        throw error;
      }
    }

    throw new StorageError({
      code:
        StorageErrorCode.STORAGE_PERSISTENCE_ERROR,
      statusCode: 503,
      message:
        "Storage transaction could not be completed after retries.",
    });
  }

  private async execute<T>(
    operation: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError({
        code:
          StorageErrorCode.STORAGE_PERSISTENCE_ERROR,
        statusCode: 500,
        message: `Failed to ${operation}.`,
        cause: error,
      });
    }
  }
}

function validateCompletionInput(
  intent: UploadIntentRow,
  asset: StorageAssetRecord,
): void {
  const validationFailed =
    intent.intendedAssetId !== asset.id ||
    intent.targetKey !== asset.targetKey ||
    intent.finalObjectKey !== asset.objectKey ||
    intent.mimeType !== asset.mimeType ||
    intent.actorId !== asset.createdById ||
    intent.visibility !==
      toPrismaVisibility(asset.visibility) ||
    intent.cardinality !==
      toPrismaCardinality(asset.cardinality);

  if (validationFailed) {
    throw new StorageError({
      code:
        StorageErrorCode.UPLOADED_OBJECT_INVALID,
      statusCode: 422,
      message:
        "Storage asset does not match its upload intent.",
    });
  }
}

function mapUploadIntent(
  row: UploadIntentRow,
): StorageUploadIntentRecord {
  return {
    id: row.id,
    assetId: row.intendedAssetId,
    actorId: row.actorId,

    target: parseTarget(row.target),
    targetKey: row.targetKey,

    fileClass: row.fileClass as StorageFileClass,

    file: {
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: bigIntToSafeNumber(
        row.claimedSizeBytes,
        "claimedSizeBytes",
      ),
    },

    policy: {
      visibility:
        row.visibility as StorageVisibility,

      cardinality:
        row.cardinality as StorageCardinality,

      allowedMimeTypes: parseStringArray(
        row.allowedMimeTypes,
        "allowedMimeTypes",
      ),

      maxSizeBytes: bigIntToSafeNumber(
        row.maxSizeBytes,
        "maxSizeBytes",
      ),

      uploadExpiresInSeconds:
        row.uploadExpiresInSeconds,

      cacheControl: row.cacheControl,
      uploadStrategy: row.uploadStrategy as StorageUploadStrategy,
    },

    temporaryObjectKey: row.temporaryObjectKey,
    finalObjectKey: row.finalObjectKey,

    status:
      row.status as StorageUploadIntentStatus,

    expiresAt: row.expiresAt,
    completedAt: row.completedAt,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAsset(row: AssetRow): StorageAssetRecord {
  return {
    id: row.id,

    target: parseTarget(row.target),
    targetKey: row.targetKey,

    objectKey: row.objectKey,

    visibility:
      row.visibility as StorageVisibility,

    cardinality:
      row.cardinality as StorageCardinality,

    originalName: row.originalName,
    mimeType: row.mimeType,

    sizeBytes: bigIntToSafeNumber(
      row.sizeBytes,
      "sizeBytes",
    ),

    etag: row.etag,
    checksum: row.checksum,

    status: row.status as StorageAssetStatus,

    createdById: row.createdById,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeTarget(
  target: StorageTarget,
): Prisma.InputJsonValue {
  return {
    nodes: target.nodes.map((node) => ({
      collection: node.collection,
      id: node.id,
    })),
    slot: target.slot,
  };
}

function parseTarget(
  value: Prisma.JsonValue,
): StorageTarget {
  if (!isJsonObject(value)) {
    throw invalidPersistedData("target");
  }

  const nodesValue = value.nodes;
  const slotValue = value.slot;

  if (
    !Array.isArray(nodesValue) ||
    typeof slotValue !== "string"
  ) {
    throw invalidPersistedData("target");
  }

  const nodes = nodesValue.map((node) => {
    if (!isJsonObject(node)) {
      throw invalidPersistedData("target.nodes");
    }

    if (
      typeof node.collection !== "string" ||
      typeof node.id !== "string"
    ) {
      throw invalidPersistedData("target.nodes");
    }

    return {
      collection: node.collection,
      id: node.id,
    };
  });

  if (nodes.length === 0) {
    throw invalidPersistedData("target.nodes");
  }

  return {
    nodes,
    slot: slotValue,
  };
}

function parseStringArray(
  value: Prisma.JsonValue,
  fieldName: string,
): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw invalidPersistedData(fieldName);
  }

  return value;
}

function isJsonObject(
  value: Prisma.JsonValue,
): value is Prisma.JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function bigIntToSafeNumber(
  value: bigint,
  fieldName: string,
): number {
  const numberValue = Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw invalidPersistedData(fieldName);
  }

  return numberValue;
}

function invalidPersistedData(
  fieldName: string,
): StorageError {
  return new StorageError({
    code:
      StorageErrorCode.STORAGE_PERSISTENCE_ERROR,
    statusCode: 500,
    message:
      `Stored storage data is invalid: ${fieldName}.`,
  });
}

function toPrismaVisibility(
  value: StorageVisibility,
): PrismaStorageVisibility {
  return value as PrismaStorageVisibility;
}

function toPrismaCardinality(
  value: StorageCardinality,
): PrismaStorageCardinality {
  return value as PrismaStorageCardinality;
}

function toPrismaFileClass(
  value: StorageFileClass,
): PrismaStorageFileClass {
  return value as PrismaStorageFileClass;
}

function toPrismaUploadStatus(
  value: StorageUploadIntentStatus,
): PrismaUploadIntentStatus {
  return value as PrismaUploadIntentStatus;
}

function toPrismaUploadStrategy(value: StorageUploadStrategy): PrismaUploadStrategy {
  return value as PrismaUploadStrategy;
}

function isPrismaWriteConflict(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = 25 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 25);

  return exponentialDelay + jitter;
}

function validateLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new StorageError({
      code: StorageErrorCode.STORAGE_PERSISTENCE_ERROR,
      statusCode: 500,
      message: "Storage query limit must be between 1 and 1000.",
    });
  }
  return limit;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function truncate(
  value: string,
  maximumLength: number,
): string {
  if (value.length <= maximumLength) {
    return value;
  }

  return value.slice(0, maximumLength);
}
