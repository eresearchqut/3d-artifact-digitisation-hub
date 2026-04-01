import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient, GetItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Asset } from './asset.model';
import { PaginatedResponse } from '../utils/pagination.model';

@Injectable()
export class AssetService {
  private readonly tableName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly s3Client: S3Client,
  ) {
    this.tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME') || '3d-hub-assets';
  }

  async findAll(
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<Asset>> {
    // Note: scan is used here for simplicity as the table design may not have a GSI for all assets
    // A better approach would be to use a GSI or query if the partition key is known.
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: "begins_with(PK, :prefix)",
      ExpressionAttributeValues: marshall({ ":prefix": "ASSET#" }),
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) : undefined,
    });

    const response = await this.dynamoDBClient.send(command);

    const data: Asset[] = (response.Items || []).map((item) => {
      const unmarshalled = unmarshall(item);
      return {
        id: unmarshalled.PK.replace('ASSET#', ''),
        key: unmarshalled.key || '',
      };
    });

    let next_cursor = null;
    if (response.LastEvaluatedKey) {
      next_cursor = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
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
    };
  }

  async update(id: string, asset: Asset): Promise<Asset> {
    // Assets do not have updatable attributes right now besides key which comes from S3
    // But keeping the interface for compatibility
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ PK: `ASSET#${id}`, SK: `ASSET#${id}` }),
    });

    await this.dynamoDBClient.send(command);
  }

  async generateUploadUrl(id: string, extension: string): Promise<{ uploadUrl: string }> {
    if (extension !== '.ply' && extension !== '.mp3') {
      throw new BadRequestException('Unsupported file extension. Only .ply and .mp3 are supported.');
    }

    const bucketName = this.configService.get<string>('S3_UPLOAD_BUCKET') || 'asset-uploads';
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `assets/${id}${extension}`,
      ContentType: 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { uploadUrl };
  }
}
