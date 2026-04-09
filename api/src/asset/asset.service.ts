import type { Readable } from 'stream';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Asset } from './asset.model';
import { PaginatedResponse } from '../utils/pagination.model';

const VIEWER_FILES: Record<string, string> = {
  'index.html': 'text/html',
  'index.css': 'text/css',
  'index.js': 'application/javascript',
  'index.sog': 'application/octet-stream',
  'settings.json': 'application/json',
};

// index.html must be served directly so the iframe's base URL stays on the API
// domain. This allows the viewer to resolve relative resource URLs (index.sog,
// index.js, etc.) back through the API, which then redirect to presigned S3 URLs.
const STREAM_DIRECTLY = new Set(['index.html']);

export type ViewerFileResult =
  | { type: 'redirect'; url: string }
  | { type: 'stream'; file: StreamableFile; contentType: string };

@Injectable()
export class AssetService {
  private readonly tableName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly s3Client: S3Client,
  ) {
    this.tableName =
      this.configService.get<string>('DYNAMODB_TABLE_NAME') || '3d-hub-assets';
  }

  async findAll(
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<Asset>> {
    // Note: scan is used here for simplicity as the table design may not have a GSI for all assets
    // A better approach would be to use a GSI or query if the partition key is known.
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: marshall({ ':prefix': 'ASSET#' }),
      Limit: limit,
      ExclusiveStartKey: cursor
        ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
        : undefined,
    });

    const response = await this.dynamoDBClient.send(command);

    const data: Asset[] = (response.Items || []).map((item) => {
      const unmarshalled = unmarshall(item);
      return {
        id: unmarshalled.PK.replace('ASSET#', ''),
        key: unmarshalled.key || '',
        ...(unmarshalled.uploadedBy && { uploadedBy: unmarshalled.uploadedBy }),
        ...(unmarshalled.metadata && { metadata: unmarshalled.metadata }),
      };
    });

    let next_cursor = null;
    if (response.LastEvaluatedKey) {
      next_cursor = Buffer.from(
        JSON.stringify(response.LastEvaluatedKey),
      ).toString('base64');
    }

    return {
      data,
      pagination: {
        limit,
        has_more: !!next_cursor,
        next_cursor,
      },
    };
  }

  async findOne(id: string): Promise<Asset> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ PK: `ASSET#${id}`, SK: `ASSET#${id}` }),
    });

    const response = await this.dynamoDBClient.send(command);

    if (!response.Item) {
      throw new NotFoundException(`Asset with id #${id} not found`);
    }

    const unmarshalled = unmarshall(response.Item);
    return {
      id: unmarshalled.PK.replace('ASSET#', ''),
      key: unmarshalled.key || '',
      ...(unmarshalled.uploadedBy && { uploadedBy: unmarshalled.uploadedBy }),
      ...(unmarshalled.metadata && { metadata: unmarshalled.metadata }),
    };
  }

  async update(id: string): Promise<Asset> {
    // Assets do not have updatable attributes right now besides key which comes from S3
    // But keeping the interface for compatibility
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const bucketName =
      this.configService.get<string>('S3_UPLOAD_BUCKET') || 'asset-uploads';

    // Delete raw upload and all viewer files concurrently
    await Promise.all([
      this.dynamoDBClient.send(
        new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({ PK: `ASSET#${id}`, SK: `ASSET#${id}` }),
        }),
      ),
      this.s3Client.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: `assets/${id}` }),
      ),
      this.deleteViewerFiles(bucketName, id),
    ]);
  }

  private async deleteViewerFiles(
    bucketName: string,
    assetId: string,
  ): Promise<void> {
    const prefix = `viewer/${assetId}/`;
    let continuationToken: string | undefined;

    do {
      const list = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (list.Contents ?? []).map((obj) => ({ Key: obj.Key! }));
      if (keys.length > 0) {
        await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: keys, Quiet: true },
          }),
        );
      }

      continuationToken = list.IsTruncated
        ? list.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  async generateUploadUrl(
    uploadedBy: string,
    metadata?: Record<string, string>,
  ): Promise<{ uploadUrl: string; id: string }> {
    const id = randomUUID();
    const supportedExtensions = ['.ply', '.spz', '.splat', '.sog'];
    const extension = metadata?.name
      ? '.' + metadata.name.split('.').pop()?.toLowerCase()
      : '';
    if (!supportedExtensions.includes(extension)) {
      throw new BadRequestException(
        'Unsupported file extension. Only .ply, .spz, .splat, and .sog are supported.',
      );
    }

    const bucketName =
      this.configService.get<string>('S3_UPLOAD_BUCKET') || 'asset-uploads';

    // Pre-write the asset record to DynamoDB so metadata is stored independently
    // of the presigned URL — avoids SigV4 header mismatch when metadata is baked
    // into the signed headers and the browser PUT doesn't exactly match.
    const item = {
      PK: `ASSET#${id}`,
      SK: `ASSET#${id}`,
      bucket: bucketName,
      key: `assets/${id}`,
      name: metadata?.name || id,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      status: 'pending',
      ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
    };
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    // Generate the presigned URL with only Content-Type signed — no metadata headers
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `assets/${id}`,
      ContentType: 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
    return { uploadUrl, id };
  }

  async getFile(id: string): Promise<StreamableFile> {
    const asset = await this.findOne(id);
    const bucketName =
      this.configService.get<string>('S3_UPLOAD_BUCKET') || 'asset-uploads';
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: asset.key || `assets/${id}`,
    });

    const response = await this.s3Client.send(command);
    return new StreamableFile(response.Body as Readable);
  }

  async getViewerFile(id: string, filename: string): Promise<ViewerFileResult> {
    const contentType = VIEWER_FILES[filename];
    if (!contentType) {
      throw new BadRequestException(
        `Invalid viewer file. Allowed: ${Object.keys(VIEWER_FILES).join(', ')}`,
      );
    }

    const bucketName =
      this.configService.get<string>('S3_UPLOAD_BUCKET') || 'asset-uploads';
    const s3Key = `viewer/${id}/${filename}`;

    const command = new GetObjectCommand({ Bucket: bucketName, Key: s3Key });

    try {
      if (STREAM_DIRECTLY.has(filename)) {
        const response = await this.s3Client.send(command);
        return {
          type: 'stream',
          file: new StreamableFile(response.Body as Readable),
          contentType,
        };
      }

      // All other files: 302 redirect to a short-lived presigned S3 GET URL.
      // The browser fetches binary/JS/CSS directly from S3, avoiding Lambda
      // payload limits and binary encoding issues.
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: 300,
      });
      return { type: 'redirect', url };
    } catch {
      throw new NotFoundException(
        `Viewer file '${filename}' not found for asset ${id}`,
      );
    }
  }
}
