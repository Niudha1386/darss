import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export interface MultipartPartInput {
  PartNumber: number;
  ETag: string;
}

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
  publicDomain?: string;
}

export class R2StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string = '';
  private configured: boolean = false;

  constructor() {
    this.initFromEnv();
  }

  public initFromEnv() {
    const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim();
    const bucketName = (process.env.R2_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '').trim();
    let endpoint = (process.env.R2_ENDPOINT || '').trim();

    if (!endpoint && accountId) {
      endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    }

    if (accessKeyId && secretAccessKey && bucketName && endpoint) {
      this.bucket = bucketName;
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.configured = true;
      console.log(`[R2 STORAGE] Initialized Cloudflare R2 Storage client with bucket: "${bucketName}"`);
    } else {
      this.configured = false;
      this.s3Client = null;
      console.log(
        '[R2 STORAGE] Cloudflare R2 credentials not fully configured. Local simulated direct storage will be used for fallback.'
      );
    }
  }

  public isR2Configured(): boolean {
    return this.configured && this.s3Client !== null;
  }

  public getBucketName(): string {
    return this.bucket;
  }

  /**
   * Generates a clean, room-isolated object key for storage.
   * Format: studyroom/{roomId}/uploads/{fileId}/{safeFilename}
   */
  public generateObjectKey(roomId: string, fileId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_');
    return `studyroom/${roomId}/uploads/${fileId}/${safeName}`;
  }

  /**
   * Initializes a Multipart Upload session in Cloudflare R2.
   * Returns the AWS S3 / Cloudflare R2 UploadId.
   */
  public async createMultipartUpload(
    key: string,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    if (!this.s3Client || !this.bucket) {
      throw new Error('R2 client is not configured');
    }

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const response = await this.s3Client.send(command);
    if (!response.UploadId) {
      throw new Error('Failed to retrieve UploadId from Cloudflare R2');
    }

    return response.UploadId;
  }

  /**
   * Generates Presigned PUT URLs for a batch of parts directly to Cloudflare R2.
   * The browser will send raw binary chunks straight to R2 via PUT requests.
   */
  public async getPresignedPartUrls(
    key: string,
    uploadId: string,
    partNumbers: number[],
    expiresInSeconds: number = 3600
  ): Promise<Record<number, string>> {
    if (!this.s3Client || !this.bucket) {
      throw new Error('R2 client is not configured');
    }

    const urls: Record<number, string> = {};

    await Promise.all(
      partNumbers.map(async (partNumber) => {
        const command = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });

        const presignedUrl = await getSignedUrl(this.s3Client!, command, {
          expiresIn: expiresInSeconds,
        });

        urls[partNumber] = presignedUrl;
      })
    );

    return urls;
  }

  /**
   * Completes a Multipart Upload in Cloudflare R2 by assembling all part ETags.
   */
  public async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPartInput[]
  ): Promise<void> {
    if (!this.s3Client || !this.bucket) {
      throw new Error('R2 client is not configured');
    }

    // Sort parts by PartNumber ascending (required by S3/R2 specification)
    const sortedParts = [...parts]
      .sort((a, b) => a.PartNumber - b.PartNumber)
      .map((p) => ({
        PartNumber: p.PartNumber,
        ETag: p.ETag.startsWith('"') ? p.ETag : `"${p.ETag}"`,
      }));

    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });

    await this.s3Client.send(command);
    console.log(`[R2 STORAGE] Completed Multipart Upload for key: ${key} (Parts: ${sortedParts.length})`);
  }

  /**
   * Aborts a Multipart Upload in Cloudflare R2 and removes all temporary parts.
   */
  public async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    if (!this.s3Client || !this.bucket) return;

    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);
      console.log(`[R2 STORAGE] Aborted Multipart Upload for key: ${key}`);
    } catch (err) {
      console.warn(`[R2 STORAGE] Warning: Error aborting multipart upload for ${key}:`, err);
    }
  }

  /**
   * Deletes an object from Cloudflare R2 when a pamphlet is removed from the room.
   */
  public async deleteObject(key: string): Promise<void> {
    if (!this.s3Client || !this.bucket) return;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log(`[R2 STORAGE] Deleted object from R2: ${key}`);
    } catch (err) {
      console.warn(`[R2 STORAGE] Warning: Error deleting object ${key} from R2:`, err);
    }
  }

  /**
   * Streams an object from Cloudflare R2 down to local disk for RAG text extraction & chunking.
   * This ensures the RAG extraction pipeline runs reliably with local memory/CPU.
   */
  public async downloadObjectToFile(key: string, localFilePath: string): Promise<void> {
    if (!this.s3Client || !this.bucket) {
      throw new Error('R2 client is not configured');
    }

    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`R2 object body is empty for key: ${key}`);
    }

    const nodeStream = response.Body as Readable;
    const writeStream = fs.createWriteStream(localFilePath);

    await pipeline(nodeStream, writeStream);
    console.log(`[R2 STORAGE] Downloaded R2 object to local path for RAG extraction: ${localFilePath}`);
  }

  /**
   * Simple Presigned Single-Put URL for small files (< 10MB) where multipart overhead is unnecessary.
   */
  public async getPresignedSingleUploadUrl(
    key: string,
    contentType: string = 'application/octet-stream',
    expiresInSeconds: number = 3600
  ): Promise<string> {
    if (!this.s3Client || !this.bucket) {
      throw new Error('R2 client is not configured');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }
}

export const r2StorageService = new R2StorageService();
