import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class R2Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private config: ConfigService) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.get<string>('r2.endpoint'),
      credentials: {
        accessKeyId: config.get<string>('r2.accessKeyId')!,
        secretAccessKey: config.get<string>('r2.secretAccessKey')!,
      },
    });
    this.bucket = config.get<string>('r2.bucket')!;
    this.publicBaseUrl = config.get<string>('r2.publicBaseUrl')!;
  }

  async generatePresignedPutUrl(objectKey: string, contentType: string, expiresIn = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  getPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl}/${objectKey}`;
  }

  buildObjectKey(entity: 'properties' | 'units' | 'professionals', entityId: string, filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    return `${entity}/${entityId}/${randomUUID()}.${ext}`;
  }
}
