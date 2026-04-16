import type { Readable } from 'stream';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
  QueryCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { JwtPayload, ADMINISTRATORS_GROUP } from '../auth/auth.constants';
import { Asset, AssetStatus } from './asset.model';
import { AssetAccess } from './asset-access.model';

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
    private readonly cognitoClient: CognitoIdentityProviderClient,
  ) {
    this.tableName =
      this.configService.get<string>('DYNAMODB_TABLE_NAME') || '3d-hub-assets';
  }

  async findAll(
    userEmail?: string,
    isAdmin?: boolean,
    userGroups?: string[],
  ): Promise<Asset[]> {
    // Scan all items under ASSET# partition keys — this includes main records
    // (SK = ASSET#<id>) and access records (SK = USER#<email> or TEAM#<name>)
    const allItems: Record<string, any>[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const resp = await this.dynamoDBClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'begins_with(PK, :prefix)',
          ExpressionAttributeValues: marshall({ ':prefix': 'ASSET#' }),
          ExclusiveStartKey: lastKey,
        }),
      );
      allItems.push(...(resp.Items || []));
      lastKey = resp.LastEvaluatedKey;
    } while (lastKey);

    // Separate main asset records from access records
    const assetRecords = new Map<string, Record<string, any>>();
    const accessibleIds = new Set<string>();

    for (const item of allItems) {
      const u = unmarshall(item);
      const assetId = u.PK.replace('ASSET#', '');

      if (u.SK === u.PK) {
        // Main asset record
        assetRecords.set(assetId, u);
      } else if (!isAdmin && userEmail) {
        // Access record — check if this user or one of their teams has access
        if (u.SK === `USER#${userEmail}`) {
          accessibleIds.add(assetId);
        } else if (u.SK.startsWith('TEAM#') && userGroups?.length) {
          const teamName = u.SK.replace('TEAM#', '');
          if (userGroups.includes(teamName)) {
            accessibleIds.add(assetId);
          }
        }
      }
    }

    const mapRecord = (u: Record<string, any>): Asset => ({
      id: u.PK.replace('ASSET#', ''),
      key: u.key || '',
      ...(u.status && { status: u.status as AssetStatus }),
      ...(u.uploadedBy && { uploadedBy: u.uploadedBy }),
      ...(u.metadata && { metadata: u.metadata }),
    });

    // Admins (or unauthenticated callers) see everything
    if (isAdmin || !userEmail) {
      return Array.from(assetRecords.values()).map(mapRecord);
    }

    // Non-admins only see assets they have direct or team-based access to
    return Array.from(assetRecords.entries())
      .filter(([id]) => accessibleIds.has(id))
      .map(([, u]) => mapRecord(u));
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
      ...(unmarshalled.status && {
        status: unmarshalled.status as AssetStatus,
      }),
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

    // Collect all DynamoDB items for this asset (main record + ownership + shares)
    await this.deleteAllAssetItems(id);

    await Promise.all([
      this.s3Client.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: `assets/${id}` }),
      ),
      this.deleteViewerFiles(bucketName, id),
    ]);
  }

  private async deleteAllAssetItems(assetId: string): Promise<void> {
    let lastKey: Record<string, any> | undefined;
    do {
      const result = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: marshall({ ':pk': `ASSET#${assetId}` }),
          ExclusiveStartKey: lastKey,
        }),
      );

      const items = result.Items ?? [];

      // For each SHARE# item found, also delete the share's access records
      const shareIds = items
        .map((item) => unmarshall(item))
        .filter((u) => u.SK?.startsWith('SHARE#'))
        .map((u) => u.SK.replace('SHARE#', ''));

      await Promise.all([
        this.batchDeleteItems(items.map((item) => unmarshall(item))),
        ...shareIds.map((shareId) => this.deleteShareAccessItems(shareId)),
      ]);

      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  }

  async deleteShareAccessItems(shareId: string): Promise<void> {
    let lastKey: Record<string, any> | undefined;
    do {
      const result = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: marshall({ ':pk': `SHARE#${shareId}` }),
          ExclusiveStartKey: lastKey,
        }),
      );
      await this.batchDeleteItems(
        (result.Items ?? []).map((i) => unmarshall(i)),
      );
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  }

  private async batchDeleteItems(
    items: Array<Record<string, any>>,
  ): Promise<void> {
    // DynamoDB BatchWriteItem limit is 25 items per request
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await this.dynamoDBClient.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [this.tableName]: chunk.map(({ PK, SK }) => ({
              DeleteRequest: {
                Key: marshall({ PK, SK }),
              },
            })),
          },
        }),
      );
    }
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
      status: AssetStatus.UPLOADING,
      ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
    };
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    // Write the uploader as the initial owner
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `ASSET#${id}`,
          SK: `USER#${uploadedBy}`,
          grantedAt: new Date().toISOString(),
          grantedBy: uploadedBy,
        }),
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

  /** Returns index.html as a raw string so callers can rewrite its content. */
  async getViewerHtmlString(id: string): Promise<string> {
    const bucketName =
      this.configService.get<string>('S3_UPLOAD_BUCKET') || 'asset-uploads';
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `viewer/${id}/index.html`,
    });
    try {
      const response = await this.s3Client.send(command);
      return (
        response.Body as Readable & { transformToString(): Promise<string> }
      ).transformToString();
    } catch {
      throw new NotFoundException(
        `Viewer file 'index.html' not found for asset ${id}`,
      );
    }
  }

  // ─── Ownership management ────────────────────────────────────────────────

  private async listAccessBySKPrefix(
    assetId: string,
    skPrefix: string,
  ): Promise<AssetAccess[]> {
    const items: Record<string, any>[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const resp = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: marshall({
            ':pk': `ASSET#${assetId}`,
            ':prefix': skPrefix,
          }),
          ExclusiveStartKey: lastKey,
        }),
      );
      items.push(...(resp.Items ?? []));
      lastKey = resp.LastEvaluatedKey;
    } while (lastKey);

    return items.map((item) => {
      const u = unmarshall(item);
      return {
        id: u.SK.replace(/^(USER|TEAM)#/, ''),
        type: u.SK.startsWith('USER#') ? 'user' : 'team',
        grantedAt: u.grantedAt,
        ...(u.grantedBy && { grantedBy: u.grantedBy }),
      } as AssetAccess;
    });
  }

  /** Throws ForbiddenException if actor doesn't have direct or team-based access to the asset. */
  async verifyActorHasAssetAccess(
    assetId: string,
    actor: JwtPayload,
  ): Promise<void> {
    if (actor.isAdmin) return;

    const { Item: directItem } = await this.dynamoDBClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `ASSET#${assetId}`, SK: `USER#${actor.username}` }),
      }),
    );
    if (directItem) return;

    for (const teamName of actor.groups ?? []) {
      const { Item: teamItem } = await this.dynamoDBClient.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({ PK: `ASSET#${assetId}`, SK: `TEAM#${teamName}` }),
        }),
      );
      if (teamItem) return;
    }

    throw new ForbiddenException('You do not have access to this asset');
  }

  /** Throws ForbiddenException if targetEmail is not in any team the actor belongs to. */
  async verifyTargetUserInActorTeams(
    targetEmail: string,
    actor: JwtPayload,
  ): Promise<void> {
    if (actor.isAdmin) return;
    const actorTeams = (actor.groups ?? []).filter(
      (g) => g.toLowerCase() !== ADMINISTRATORS_GROUP,
    );
    if (!actorTeams.length) {
      throw new ForbiddenException(
        'You must be a member of a team to grant access to other users',
      );
    }
    const userPoolId = this.configService.get<string>('USER_POOL_ID');
    for (const teamName of actorTeams) {
      let token: string | undefined;
      do {
        const r = await this.cognitoClient.send(
          new ListUsersInGroupCommand({
            UserPoolId: userPoolId,
            GroupName: teamName,
            Limit: 60,
            NextToken: token,
          }),
        );
        const found = (r.Users ?? []).some((u) =>
          u.Attributes?.some(
            (a) => a.Name === 'email' && a.Value === targetEmail,
          ),
        );
        if (found) return;
        token = r.NextToken;
      } while (token);
    }
    throw new ForbiddenException(
      'You can only grant access to users who share a team with you',
    );
  }

  async listUserAccess(assetId: string): Promise<AssetAccess[]> {
    await this.findOne(assetId);
    return this.listAccessBySKPrefix(assetId, 'USER#');
  }

  async addUserAccess(
    assetId: string,
    email: string,
    actor: JwtPayload,
  ): Promise<void> {
    await this.findOne(assetId);
    if (!actor.isAdmin) {
      await this.verifyActorHasAssetAccess(assetId, actor);
      await this.verifyTargetUserInActorTeams(email, actor);
    }
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `ASSET#${assetId}`,
          SK: `USER#${email}`,
          grantedAt: new Date().toISOString(),
          grantedBy: actor.username,
        }),
      }),
    );
  }

  async removeUserAccess(assetId: string, email: string): Promise<void> {
    await this.findOne(assetId);
    await this.dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `ASSET#${assetId}`, SK: `USER#${email}` }),
      }),
    );
  }

  async listTeamAccess(assetId: string): Promise<AssetAccess[]> {
    await this.findOne(assetId);
    return this.listAccessBySKPrefix(assetId, 'TEAM#');
  }

  async addTeamAccess(
    assetId: string,
    teamName: string,
    actor: JwtPayload,
  ): Promise<void> {
    await this.findOne(assetId);
    if (!actor.isAdmin) {
      await this.verifyActorHasAssetAccess(assetId, actor);
      if (!actor.groups?.includes(teamName)) {
        throw new ForbiddenException(
          'You can only grant access to teams you belong to',
        );
      }
    }
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `ASSET#${assetId}`,
          SK: `TEAM#${teamName}`,
          grantedAt: new Date().toISOString(),
          grantedBy: actor.username,
        }),
      }),
    );
  }

  async removeTeamAccess(assetId: string, teamName: string): Promise<void> {
    await this.findOne(assetId);
    await this.dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `ASSET#${assetId}`, SK: `TEAM#${teamName}` }),
      }),
    );
  }
}
