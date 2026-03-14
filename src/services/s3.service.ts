import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3 as s3Config } from '../config';

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (s3Client) return s3Client;

  const credentials = s3Config.accessKeyId && s3Config.secretAccessKey
    ? {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
        ...(s3Config.sessionToken ? { sessionToken: s3Config.sessionToken } : {})
      }
    : undefined;

  const clientConfig = {
    region: s3Config.region,
    forcePathStyle: s3Config.forcePathStyle,
    ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
    ...(credentials ? { credentials } : {})
  };

  s3Client = new S3Client(clientConfig);

  return s3Client;
};

export const S3Service = {
  async checkBucket(): Promise<void> {
    const client = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: s3Config.bucket }));
  },

  async putTestObject(key: string, body: string, contentType?: string) {
    const client = getS3Client();
    return client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
  },

  async deleteObject(key: string) {
    const client = getS3Client();
    return client.send(
      new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: key
      })
    );
  },

  async listObjects(options?: { prefix?: string; maxKeys?: number; continuationToken?: string }) {
    const client = getS3Client();
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: s3Config.bucket,
        Prefix: options?.prefix,
        MaxKeys: options?.maxKeys,
        ContinuationToken: options?.continuationToken
      })
    );

    return {
      items: (response.Contents || []).map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified?.toISOString() ?? null,
        etag: item.ETag ?? null
      })),
      isTruncated: response.IsTruncated ?? false,
      nextToken: response.NextContinuationToken ?? null
    };
  },

  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      ContentType: contentType
    });

    return getSignedUrl(client, command, { expiresIn });
  },

  async generatePresignedGetUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key
    });

    return getSignedUrl(client, command, { expiresIn });
  }
};

export default S3Service;
