import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  Share,
  ShareAccess,
  CreateShareDto,
  DurationUnit,
} from './share.model';
import { PaginatedResponse } from '../utils/pagination.model';
import { AssetService } from '../asset/asset.service';

const UNIT_MS: Record<DurationUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
  year: 31_536_000_000,
};

@Injectable()
export class ShareService {
  private readonly tableName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly assetService: AssetService,
  ) {
    this.tableName =
      this.configService.get<string>('DYNAMODB_TABLE_NAME') || '3d-hub-assets';
  }

  async create(
    assetId: string,
    dto: CreateShareDto,
    createdBy?: string,
  ): Promise<Share> {
    await this.assetService.findOne(assetId);
    const id = randomUUID();
    const now = new Date().toISOString();

    const expiresAt =
      dto.durationValue && dto.durationUnit
        ? new Date(
            Date.now() + dto.durationValue * UNIT_MS[dto.durationUnit],
          ).toISOString()
        : undefined;

    const item = {
      PK: `ASSET#${assetId}`,
      SK: `SHARE#${id}`,
      shareId: id,
      assetId,
      createdAt: now,
      ...(createdBy && { createdBy }),
      ...(dto.durationValue && { durationValue: dto.durationValue }),
      ...(dto.durationUnit && { durationUnit: dto.durationUnit }),
      ...(expiresAt && { expiresAt }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
    };
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );
    return this.mapShare(item);
  }

  async findAll(
    assetId: string,
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<Share>> {
    await this.assetService.findOne(assetId);
    const result = await this.dynamoDBClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: marshall({
          ':pk': `ASSET#${assetId}`,
          ':prefix': 'SHARE#',
        }),
        Limit: limit,
        ExclusiveStartKey: cursor
          ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
          : undefined,
      }),
    );

    const data = (result.Items ?? []).map((item) =>
      this.mapShare(unmarshall(item)),
    );
    const next_cursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null;

    return {
      data,
      pagination: { limit, has_more: !!next_cursor, next_cursor },
    };
  }

  async findOne(assetId: string, shareId: string): Promise<Share> {
    const result = await this.dynamoDBClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `ASSET#${assetId}`, SK: `SHARE#${shareId}` }),
      }),
    );
    if (!result.Item) {
      throw new NotFoundException(
        `Share ${shareId} not found for asset ${assetId}`,
      );
    }
    return this.mapShare(unmarshall(result.Item));
  }

  async remove(assetId: string, shareId: string): Promise<void> {
    await this.findOne(assetId, shareId);
    await Promise.all([
      this.dynamoDBClient.send(
        new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({ PK: `ASSET#${assetId}`, SK: `SHARE#${shareId}` }),
        }),
      ),
      this.assetService.deleteShareAccessItems(shareId),
    ]);
  }

  // ─── Share access management ─────────────────────────────────────────────

  private async listShareAccessBySKPrefix(
    shareId: string,
    skPrefix: string,
    limit: number,
    cursor?: string,
  ): Promise<PaginatedResponse<ShareAccess>> {
    const result = await this.dynamoDBClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: marshall({
          ':pk': `SHARE#${shareId}`,
          ':prefix': skPrefix,
        }),
        Limit: limit,
        ExclusiveStartKey: cursor
          ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
          : undefined,
      }),
    );

    const data: ShareAccess[] = (result.Items ?? []).map((item) => {
      const u = unmarshall(item);
      return {
        id: u.SK.replace(/^(USER|TEAM)#/, ''),
        type: u.SK.startsWith('USER#') ? 'user' : 'team',
        grantedAt: u.grantedAt,
        ...(u.grantedBy && { grantedBy: u.grantedBy }),
      };
    });

    const next_cursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null;

    return {
      data,
      pagination: { limit, has_more: !!next_cursor, next_cursor },
    };
  }

  async listShareUserAccess(
    assetId: string,
    shareId: string,
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<ShareAccess>> {
    await this.findOne(assetId, shareId);
    return this.listShareAccessBySKPrefix(shareId, 'USER#', limit, cursor);
  }

  async addShareUserAccess(
    assetId: string,
    shareId: string,
    email: string,
    grantedBy?: string,
  ): Promise<void> {
    await this.findOne(assetId, shareId);
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `SHARE#${shareId}`,
          SK: `USER#${email}`,
          grantedAt: new Date().toISOString(),
          ...(grantedBy && { grantedBy }),
        }),
      }),
    );
  }

  async removeShareUserAccess(
    assetId: string,
    shareId: string,
    email: string,
  ): Promise<void> {
    await this.findOne(assetId, shareId);
    await this.dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `SHARE#${shareId}`, SK: `USER#${email}` }),
      }),
    );
  }

  async listShareTeamAccess(
    assetId: string,
    shareId: string,
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<ShareAccess>> {
    await this.findOne(assetId, shareId);
    return this.listShareAccessBySKPrefix(shareId, 'TEAM#', limit, cursor);
  }

  async addShareTeamAccess(
    assetId: string,
    shareId: string,
    teamName: string,
    grantedBy?: string,
  ): Promise<void> {
    await this.findOne(assetId, shareId);
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `SHARE#${shareId}`,
          SK: `TEAM#${teamName}`,
          grantedAt: new Date().toISOString(),
          ...(grantedBy && { grantedBy }),
        }),
      }),
    );
  }

  async removeShareTeamAccess(
    assetId: string,
    shareId: string,
    teamName: string,
  ): Promise<void> {
    await this.findOne(assetId, shareId);
    await this.dynamoDBClient.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `SHARE#${shareId}`, SK: `TEAM#${teamName}` }),
      }),
    );
  }

  private mapShare(u: Record<string, any>): Share {
    return {
      id: u.shareId ?? u.SK?.replace('SHARE#', ''),
      assetId: u.assetId,
      createdAt: u.createdAt,
      ...(u.createdBy && { createdBy: u.createdBy }),
      ...(u.durationValue && { durationValue: u.durationValue }),
      ...(u.durationUnit && { durationUnit: u.durationUnit }),
      ...(u.expiresAt && { expiresAt: u.expiresAt }),
      ...(u.isPublic !== undefined && { isPublic: u.isPublic }),
    };
  }
}
