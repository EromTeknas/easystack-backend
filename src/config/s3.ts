import { z } from 'zod';

const S3Env = z.object({
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_SESSION_TOKEN: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false)
});

const parsed = S3Env.parse(process.env);

export const s3 = {
  region: parsed.S3_REGION,
  bucket: parsed.S3_BUCKET,
  accessKeyId: parsed.S3_ACCESS_KEY_ID,
  secretAccessKey: parsed.S3_SECRET_ACCESS_KEY,
  sessionToken: parsed.S3_SESSION_TOKEN,
  endpoint: parsed.S3_ENDPOINT,
  forcePathStyle: parsed.S3_FORCE_PATH_STYLE
};

export default s3;
