import {
  StorageTarget,
  StorageVisibility,
} from "../public/storage.contracts";
import {
  StorageError,
  StorageErrorCode,
} from "./StorageError";

const MIME_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",

  "application/pdf": "pdf",
  "application/json": "json",
  "application/zip": "zip",

  "text/plain": "txt",
  "text/csv": "csv",

  "application/octet-stream": "bin",
};

export class ObjectKeyBuilder {
  buildTargetKey(target: StorageTarget): string {
    this.validateTarget(target);

    const hierarchy = target.nodes
      .map((node) => {
        const collection = this.sanitizeSegment(node.collection);
        const id = this.sanitizeSegment(node.id);

        return `${collection}:${id}`;
      })
      .join("/");

    const slot = this.sanitizeSegment(target.slot);

    return `${hierarchy}#${slot}`;
  }

  buildTemporaryObjectKey(input: {
    uploadId: string;
    assetId: string;
    mimeType: string;
  }): string {
    const uploadId = this.sanitizeSegment(input.uploadId);
    const assetId = this.sanitizeSegment(input.assetId);
    const extension = this.resolveExtension(input.mimeType);

    return [
      "temporary",
      "uploads",
      uploadId,
      `${assetId}.${extension}`,
    ].join("/");
  }

  buildFinalObjectKey(input: {
    visibility: StorageVisibility;
    target: StorageTarget;
    assetId: string;
    mimeType: string;
  }): string {
    this.validateTarget(input.target);

    const visibility = input.visibility.toLowerCase();
    const assetId = this.sanitizeSegment(input.assetId);
    const extension = this.resolveExtension(input.mimeType);

    const targetSegments = input.target.nodes.flatMap((node) => [
      this.sanitizeSegment(node.collection),
      this.sanitizeSegment(node.id),
    ]);

    return [
      visibility,
      ...targetSegments,
      this.sanitizeSegment(input.target.slot),
      `${assetId}.${extension}`,
    ].join("/");
  }

  validateTarget(target: StorageTarget): void {
    if (!target.nodes.length) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_TARGET,
        statusCode: 400,
        message: "Storage target must contain at least one path node.",
      });
    }

    for (const node of target.nodes) {
      this.sanitizeSegment(node.collection);
      this.sanitizeSegment(node.id);
    }

    this.sanitizeSegment(target.slot);
  }

  private resolveExtension(mimeType: string): string {
    const normalizedMimeType = mimeType
      .trim()
      .toLowerCase()
      .split(";")[0];

    const extension = MIME_TYPE_EXTENSIONS[normalizedMimeType!];

    if (!extension) {
      throw new StorageError({
        code: StorageErrorCode.MIME_EXTENSION_NOT_SUPPORTED,
        statusCode: 400,
        message: `No safe extension mapping exists for MIME type: ${normalizedMimeType}`,
      });
    }

    return extension;
  }

  private sanitizeSegment(value: string): string {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_TARGET,
        statusCode: 400,
        message: "Storage path segment cannot be empty.",
      });
    }

    if (
      normalized === "." ||
      normalized === ".." ||
      normalized.includes("/") ||
      normalized.includes("\\")
    ) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_TARGET,
        statusCode: 400,
        message: `Invalid storage path segment: ${value}`,
      });
    }

    const sanitized = normalized.replace(/[^a-z0-9._-]/g, "-");

    if (!sanitized || sanitized.length > 128) {
      throw new StorageError({
        code: StorageErrorCode.INVALID_TARGET,
        statusCode: 400,
        message: `Invalid storage path segment: ${value}`,
      });
    }

    return sanitized;
  }
}