import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
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
import { AssetService } from '../asset/asset.service';
import { JwtPayload } from '../auth/auth.constants';

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

    // Write a lookup record so the share can be resolved by shareId alone
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({ PK: `SHARE#${id}`, SK: `SHARE#${id}`, assetId }),
      }),
    );

    return this.mapShare(item);
  }

  async findAll(assetId: string): Promise<Share[]> {
    await this.assetService.findOne(assetId);
    const items: Record<string, any>[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const resp = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: marshall({
            ':pk': `ASSET#${assetId}`,
            ':prefix': 'SHARE#',
          }),
          ExclusiveStartKey: lastKey,
        }),
      );
      items.push(...(resp.Items ?? []));
      lastKey = resp.LastEvaluatedKey;
    } while (lastKey);
    return items.map((item) => this.mapShare(unmarshall(item)));
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
  ): Promise<ShareAccess[]> {
    const items: Record<string, any>[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const resp = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: marshall({
            ':pk': `SHARE#${shareId}`,
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
      } as ShareAccess;
    });
  }

  async listShareUserAccess(
    assetId: string,
    shareId: string,
  ): Promise<ShareAccess[]> {
    await this.findOne(assetId, shareId);
    return this.listShareAccessBySKPrefix(shareId, 'USER#');
  }

  async addShareUserAccess(
    assetId: string,
    shareId: string,
    email: string,
    actor: JwtPayload,
  ): Promise<void> {
    await this.findOne(assetId, shareId);
    if (!actor.isAdmin) {
      await this.assetService.verifyActorHasAssetAccess(assetId, actor);
      await this.assetService.verifyTargetUserInActorTeams(email, actor);
    }
    await this.dynamoDBClient.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `SHARE#${shareId}`,
          SK: `USER#${email}`,
          grantedAt: new Date().toISOString(),
          grantedBy: actor.username,
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
  ): Promise<ShareAccess[]> {
    await this.findOne(assetId, shareId);
    return this.listShareAccessBySKPrefix(shareId, 'TEAM#');
  }

  async addShareTeamAccess(
    assetId: string,
    shareId: string,
    teamName: string,
    actor: JwtPayload,
  ): Promise<void> {
    await this.findOne(assetId, shareId);
    if (!actor.isAdmin) {
      await this.assetService.verifyActorHasAssetAccess(assetId, actor);
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
          PK: `SHARE#${shareId}`,
          SK: `TEAM#${teamName}`,
          grantedAt: new Date().toISOString(),
          grantedBy: actor.username,
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

  async getShareViewerFile(
    shareId: string,
    filename: string,
    username?: string,
    token?: string,
  ) {
    // Resolve assetId from the share lookup record
    const lookup = await this.dynamoDBClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `SHARE#${shareId}`, SK: `SHARE#${shareId}` }),
      }),
    );
    if (!lookup.Item) {
      throw new NotFoundException(`Share ${shareId} not found`);
    }
    const { assetId } = unmarshall(lookup.Item);

    const share = await this.findOne(assetId, shareId);

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      throw new ForbiddenException('Share has expired');
    }

    if (!share.isPublic) {
      if (!username) {
        throw new ForbiddenException(
          'Authentication required to access this share',
        );
      }
      const [assetAccess, shareAccess] = await Promise.all([
        this.dynamoDBClient.send(
          new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({ PK: `ASSET#${assetId}`, SK: `USER#${username}` }),
          }),
        ),
        this.dynamoDBClient.send(
          new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({ PK: `SHARE#${shareId}`, SK: `USER#${username}` }),
          }),
        ),
      ]);

      if (!assetAccess.Item && !shareAccess.Item) {
        throw new ForbiddenException('Access denied');
      }
    }

    // For private shares, rewrite index.html so that relative sub-resource URLs
    // (index.js, index.css, index.sog, settings.json) include the JWT token as
    // a query parameter. Without this the browser requests sub-resources without
    // the token and they fail the auth check.
    if (filename === 'index.html' && token && !share.isPublic) {
      const html = await this.assetService.getViewerHtmlString(assetId);
      const encodedToken = encodeURIComponent(token);
      const rewritten = html.replace(
        /(["'(])((?:\.\/)?(?:index\.(?:js|css|sog)|settings\.json))(["')])/g,
        `$1$2?token=${encodedToken}$3`,
      );
      return {
        type: 'stream' as const,
        file: new StreamableFile(Buffer.from(rewritten)),
        contentType: 'text/html',
      };
    }

    return this.assetService.getViewerFile(assetId, filename);
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
