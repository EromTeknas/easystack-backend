import { s3 as s3Config } from '../config';
import { S3Service } from './s3.service';

/**
 * Extract S3 key from a raw S3 URL
 * Handles both virtual-hosted-style and path-style URLs
 */
const extractKeyFromUrl = (url: string): string | null => {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Virtual-hosted-style: https://bucket.s3.region.amazonaws.com/key
    if (urlObj.hostname?.includes(s3Config.bucket)) {
      return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    }

    // Path-style: https://s3.region.amazonaws.com/bucket/key
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts[0] === s3Config.bucket) {
      return pathParts.slice(1).join('/');
    }

    // Custom endpoint (MinIO, etc): https://endpoint/bucket/key
    if (urlObj.pathname.includes(`/${s3Config.bucket}/`)) {
      const key = urlObj.pathname.split(`/${s3Config.bucket}/`)[1];
      return key || null;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * ImageUrlService
 * Converts raw S3 URLs to presigned URLs for secure image delivery
 */
export const ImageUrlService = {
  /**
   * Convert a single raw S3 URL to presigned URL
   */
  async convertToPresigned(url: string, expiresIn: number = 3600): Promise<string | null> {
    if (!url) return null;

    const key = extractKeyFromUrl(url);
    if (!key) return url; // Return original if not an S3 URL

    try {
      return await S3Service.generatePresignedGetUrl(key, expiresIn);
    } catch (err) {
      console.error('Failed to generate presigned URL:', err);
      return url; // Fallback to original URL on error
    }
  },

  /**
   * Convert multiple URLs in an object
   * @param data Object containing image URL fields
   * @param imageFields Array of field names that contain image URLs
   * @param expiresIn URL expiration in seconds
   */
  async hydrateObject(
    data: Record<string, any>,
    imageFields: string[],
    expiresIn: number = 3600
  ): Promise<Record<string, any>> {
    if (!data) return data;

    const hydrated = { ...data };

    for (const field of imageFields) {
      if (hydrated[field]) {
        hydrated[field] = await this.convertToPresigned(hydrated[field], expiresIn);
      }
    }

    return hydrated;
  },

  /**
   * Convert multiple URLs in an array of objects
   * @param dataArray Array of objects containing image URLs
   * @param imageFields Array of field names that contain image URLs
   * @param expiresIn URL expiration in seconds
   */
  async hydrateArray(
    dataArray: Record<string, any>[],
    imageFields: string[],
    expiresIn: number = 3600
  ): Promise<Record<string, any>[]> {
    if (!Array.isArray(dataArray)) return dataArray;

    return Promise.all(dataArray.map((item) => this.hydrateObject(item, imageFields, expiresIn)));
  }
};

export default ImageUrlService;
