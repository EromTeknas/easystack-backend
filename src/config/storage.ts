import "dotenv/config";
import { z } from "zod";

const StorageEnv = z.object({
  STORAGE_CDN_BASE_URL: z.string().url().default("http://localhost:8081"),
  STORAGE_PRIVATE_URL_EXPIRY_SECONDS: z.coerce.number().int().min(1).max(3600).default(300),
  STORAGE_S3_BUCKET: z.string().min(1).default("easystack"),
  STORAGE_S3_REGION: z.string().min(1).default("us-east-1"),
  STORAGE_S3_INTERNAL_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_SESSION_TOKEN: z.string().optional(),
});

const parsed = StorageEnv.parse(process.env);

export const storageConfig = {
  cdnBaseUrl: parsed.STORAGE_CDN_BASE_URL,
  privateUrlExpiresInSeconds: parsed.STORAGE_PRIVATE_URL_EXPIRY_SECONDS,
  s3: {
    bucket: parsed.STORAGE_S3_BUCKET,
    region: parsed.STORAGE_S3_REGION,
    internalEndpoint: parsed.STORAGE_S3_INTERNAL_ENDPOINT,
    publicEndpoint: parsed.STORAGE_S3_PUBLIC_ENDPOINT,
    forcePathStyle: parsed.STORAGE_S3_FORCE_PATH_STYLE,
    accessKeyId: parsed.STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: parsed.STORAGE_S3_SECRET_ACCESS_KEY,
    sessionToken: parsed.STORAGE_S3_SESSION_TOKEN,
  },
};
