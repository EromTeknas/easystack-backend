import type { Request, Response } from "express";

import { prisma } from "../../db/prisma";
import { BadRequestError, UnauthorizedError } from "../../errors";
import {
  StorageCardinality,
  StorageFileClass,
  StoragePrivateAccess,
  StorageVisibility,
} from "../../services/storage";
import type {
  StorageFileDescriptor,
  StoragePolicyOverrides,
  StorageTarget,
} from "../../services/storage";
import { createStorageModule } from "../../services/storage/infrastructure/createStorageModule";
import { asyncHandler } from "../../utils/asyncHandler";
import logger from "../../utils/logger";
import { ok } from "../../utils/response";

const storageService = createStorageModule(prisma);

const DEMO_PRESETS = {
  "public-image-single": {
    fileClass: StorageFileClass.IMAGE,
    slot: "demo-public-image",
    policy: {
      visibility: StorageVisibility.PUBLIC,
      cardinality: StorageCardinality.SINGLE,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  },
  "private-image-single": {
    fileClass: StorageFileClass.IMAGE,
    slot: "demo-private-image",
    policy: {
      visibility: StorageVisibility.PRIVATE,
      cardinality: StorageCardinality.SINGLE,
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  },
  "private-document-multiple": {
    fileClass: StorageFileClass.DOCUMENT,
    slot: "demo-private-documents",
    policy: {
      visibility: StorageVisibility.PRIVATE,
      cardinality: StorageCardinality.MULTIPLE,
      maxSizeBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf", "text/plain", "text/csv", "application/json"],
    },
  },
  "private-binary-multiple": {
    fileClass: StorageFileClass.BINARY,
    slot: "demo-private-binaries",
    policy: {
      visibility: StorageVisibility.PRIVATE,
      cardinality: StorageCardinality.MULTIPLE,
      maxSizeBytes: 20 * 1024 * 1024,
      allowedMimeTypes: ["application/octet-stream", "application/zip"],
    },
  },
} satisfies Record<string, {
  fileClass: StorageFileClass;
  slot: string;
  policy: StoragePolicyOverrides;
}>;

type DemoPresetName = keyof typeof DEMO_PRESETS;

function actorId(req: Request): string {
  if (!req.user) {
    throw new UnauthorizedError("Authentication is required for storage demos");
  }
  return String(req.user.id);
}

function parsePreset(value: unknown): DemoPresetName {
  if (typeof value !== "string" || !(value in DEMO_PRESETS)) {
    throw new BadRequestError(
      `preset must be one of: ${Object.keys(DEMO_PRESETS).join(", ")}`,
    );
  }
  return value as DemoPresetName;
}

function targetFor(userId: string, presetName: DemoPresetName): StorageTarget {
  return {
    nodes: [{ collection: "users", id: userId }],
    slot: DEMO_PRESETS[presetName].slot,
  };
}

function parseFile(value: unknown): StorageFileDescriptor {
  if (!value || typeof value !== "object") {
    throw new BadRequestError("file is required");
  }
  const file = value as Record<string, unknown>;
  if (
    typeof file.originalName !== "string" ||
    typeof file.mimeType !== "string" ||
    typeof file.sizeBytes !== "number"
  ) {
    throw new BadRequestError(
      "file must contain originalName, mimeType, and numeric sizeBytes",
    );
  }
  return {
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  };
}

export const listStorageDemoPresets = asyncHandler(async (req: Request, res: Response) => {
  const userId = actorId(req);
  logger.info("Storage demo: listing server-controlled upload presets", {
    actorId: userId,
    presetCount: Object.keys(DEMO_PRESETS).length,
  });

  return ok(res, {
    presets: Object.entries(DEMO_PRESETS).map(([name, preset]) => ({
      name,
      fileClass: preset.fileClass,
      target: targetFor(userId, name as DemoPresetName),
      policy: preset.policy,
    })),
  });
});

export const createStorageDemoUploadIntent = asyncHandler(
  async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = actorId(req);
    const presetName = parsePreset(req.body?.preset);
    const preset = DEMO_PRESETS[presetName];
    const file = parseFile(req.body?.file);
    const target = targetFor(userId, presetName);

    logger.info("Storage demo: upload-intent creation started", {
      actorId: userId,
      preset: presetName,
      target,
      file: {
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
      policy: preset.policy,
    });

    try {
      const result = await storageService.createUploadIntent({
        actorId: userId,
        target,
        fileClass: preset.fileClass,
        file,
        policy: preset.policy,
      });

      logger.info("Storage demo: presigned POST created", {
        actorId: userId,
        preset: presetName,
        uploadId: result.uploadId,
        method: result.upload.method,
        uploadHost: safeUrlHost(result.upload.url),
        formFieldNames: Object.keys(result.upload.fields).sort(),
        expiresAt: result.upload.expiresAt.toISOString(),
        durationMs: Date.now() - startedAt,
        note: "URL signatures and form-field values are intentionally not logged",
      });

      return ok(
        res,
        {
          preset: presetName,
          target,
          uploadId: result.uploadId,
          upload: result.upload,
          nextStep: `POST /api/storage/demo/upload-intents/${result.uploadId}/complete`,
        },
        { statusCode: 201 },
      );
    } catch (error) {
      logFailure("upload-intent creation", startedAt, userId, { preset: presetName }, error);
      throw error;
    }
  },
);

export const completeStorageDemoUpload = asyncHandler(
  async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = actorId(req);
    const uploadId = parseRouteParameter(req.params.uploadId, "uploadId");

    logger.info("Storage demo: upload completion started", { actorId: userId, uploadId });
    logger.debug("Storage demo: completion will HEAD the temporary object, validate metadata, copy it, and commit the asset", {
      actorId: userId,
      uploadId,
    });

    try {
      const asset = await storageService.completeUpload({ actorId: userId, uploadId });
      logger.info("Storage demo: upload completed and asset activated", {
        actorId: userId,
        uploadId,
        assetId: asset.id,
        targetKey: asset.targetKey,
        visibility: asset.visibility,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        createdAt: asset.createdAt.toISOString(),
        durationMs: Date.now() - startedAt,
      });
      return ok(res, { asset });
    } catch (error) {
      logFailure("upload completion", startedAt, userId, { uploadId }, error);
      throw error;
    }
  },
);

export const resolveStorageDemoUrls = asyncHandler(
  async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = actorId(req);
    const presetName = parsePreset(req.query.preset);
    const target = targetFor(userId, presetName);
    const includePrivate = parseBoolean(req.query.includePrivate, false);
    const requestedExpiry = parseOptionalPositiveInteger(req.query.expiresInSeconds);

    logger.info("Storage demo: URL hydration started", {
      actorId: userId,
      preset: presetName,
      target,
      includePrivate,
      requestedExpirySeconds: requestedExpiry ?? "default",
    });

    try {
      const assets = await storageService.resolveTargetUrls({
        target,
        privateAccess: includePrivate
          ? StoragePrivateAccess.AUTHORIZED_PRIVATE
          : StoragePrivateAccess.PUBLIC_ONLY,
        ...(requestedExpiry ? { privateUrlExpiresInSeconds: requestedExpiry } : {}),
      });

      logger.info("Storage demo: URL hydration completed", {
        actorId: userId,
        preset: presetName,
        assetCount: assets.length,
        assets: assets.map((asset) => ({
          assetId: asset.id,
          visibility: asset.visibility,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          urlKind: asset.visibility === StorageVisibility.PUBLIC
            ? "PUBLIC_CDN_URL"
            : "PRIVATE_PRESIGNED_INLINE_URL",
          urlHost: safeUrlHost(asset.url),
        })),
        durationMs: Date.now() - startedAt,
        note: "Full hydrated URLs are returned to the authenticated caller but not logged",
      });

      return ok(res, {
        preset: presetName,
        target,
        accessMode: includePrivate ? "AUTHORIZED_PRIVATE" : "PUBLIC_ONLY",
        assets,
      });
    } catch (error) {
      logFailure("URL hydration", startedAt, userId, { preset: presetName }, error);
      throw error;
    }
  },
);

export const deleteStorageDemoAsset = asyncHandler(
  async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const userId = actorId(req);
    const presetName = parsePreset(req.body?.preset);
    const assetId = parseRouteParameter(req.params.assetId, "assetId");
    const target = targetFor(userId, presetName);

    logger.info("Storage demo: asynchronous asset deletion requested", {
      actorId: userId,
      preset: presetName,
      assetId,
      target,
    });

    try {
      await storageService.deleteAsset({ actorId: userId, assetId, target });
      logger.info("Storage demo: asset marked for deletion and cleanup scheduling attempted", {
        actorId: userId,
        preset: presetName,
        assetId,
        durationMs: Date.now() - startedAt,
      });
      return ok(res, {
        assetId,
        status: "DELETION_PENDING",
        message: "Physical deletion is processed asynchronously by the storage worker.",
      });
    } catch (error) {
      logFailure("asset deletion", startedAt, userId, { preset: presetName, assetId }, error);
      throw error;
    }
  },
);

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new BadRequestError("includePrivate must be true or false");
}

function parseRouteParameter(value: string | string[] | undefined, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestError(`${name} is required`);
  }
  return value;
}

function parseOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new BadRequestError("expiresInSeconds must be a positive integer");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 3600) {
    throw new BadRequestError("expiresInSeconds must be between 1 and 3600");
  }
  return parsed;
}

function safeUrlHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

function logFailure(
  operation: string,
  startedAt: number,
  userId: string,
  context: Record<string, unknown>,
  error: unknown,
): void {
  logger.error(`Storage demo: ${operation} failed`, {
    actorId: userId,
    ...context,
    durationMs: Date.now() - startedAt,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : String(error),
    errorCode: typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined,
    causeChain: describeErrorCauses(error),
  });
}

function describeErrorCauses(error: unknown): Array<{
  name: string;
  message: string;
  code?: string;
}> {
  const causes: Array<{ name: string; message: string; code?: string }> = [];
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current) && causes.length < 5) {
    visited.add(current);
    const value = current as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
    causes.push({
      name: typeof value.name === "string" ? value.name : "UnknownError",
      message: typeof value.message === "string" ? value.message : "Unknown error",
      ...(value.code !== undefined ? { code: String(value.code) } : {}),
    });
    current = value.cause;
  }

  return causes;
}
