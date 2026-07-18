import {
  CompleteUploadInput,
  CompletedStorageAsset,
  CreateUploadIntentInput,
  DeleteStorageAssetInput,
  ResolvedStorageAsset,
  ResolveTargetUrlsInput,
  UploadIntentResult,
} from "./storage.contracts";

export interface StorageService {
  /**
   * Creates a temporary upload intent and returns a presigned
   * browser upload request.
   */
  createUploadIntent(
    input: CreateUploadIntentInput,
  ): Promise<UploadIntentResult>;

  /**
   * Verifies the uploaded object and promotes it from temporary
   * storage into its final public/private location.
   */
  completeUpload(
    input: CompleteUploadInput,
  ): Promise<CompletedStorageAsset>;

  /**
   * Resolves active assets attached to a logical target.
   *
   * SINGLE targets return zero or one asset.
   * MULTIPLE targets may return multiple assets.
   */
  resolveTargetUrls(
    input: ResolveTargetUrlsInput,
  ): Promise<ResolvedStorageAsset[]>;

  /**
   * Removes the asset from active application use and queues the
   * physical object for deletion.
   */
  deleteAsset(input: DeleteStorageAssetInput): Promise<void>;
}