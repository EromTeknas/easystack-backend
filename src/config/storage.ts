import { env } from "./env";

const bucket = env.STORAGE_S3_BUCKET ?? env.S3_BUCKET;
if (!bucket) throw new Error("STORAGE_S3_BUCKET is required");

const region = env.STORAGE_S3_REGION ?? env.S3_REGION ?? "us-east-1";
const internalEndpoint = env.STORAGE_S3_INTERNAL_ENDPOINT ?? env.S3_ENDPOINT;
const publicEndpoint = env.STORAGE_S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT;
const forcePathStyle = env.STORAGE_S3_FORCE_PATH_STYLE ?? env.S3_FORCE_PATH_STYLE ?? false;
const accessKeyId = env.STORAGE_S3_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY_ID;
const secretAccessKey = env.STORAGE_S3_SECRET_ACCESS_KEY ?? env.S3_SECRET_ACCESS_KEY;
const sessionToken = env.STORAGE_S3_SESSION_TOKEN ?? env.S3_SESSION_TOKEN;

export const storageConfig = {
  cdnBaseUrl: env.STORAGE_CDN_BASE_URL,
  privateUrlExpiresInSeconds: env.STORAGE_PRIVATE_URL_EXPIRY_SECONDS,
  s3: {
    bucket,
    region,
    internalEndpoint,
    publicEndpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
    sessionToken,
  },
};

/** Compatibility view for legacy S3Service consumers. */
export const s3 = {
  region: storageConfig.s3.region,
  bucket: storageConfig.s3.bucket,
  accessKeyId: storageConfig.s3.accessKeyId,
  secretAccessKey: storageConfig.s3.secretAccessKey,
  sessionToken: storageConfig.s3.sessionToken,
  endpoint: storageConfig.s3.publicEndpoint ?? storageConfig.s3.internalEndpoint,
  forcePathStyle: storageConfig.s3.forcePathStyle,
};
