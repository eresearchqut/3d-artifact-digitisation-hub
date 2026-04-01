import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Organisation } from './organisation.model';
import { Team } from '../team/team.model';
import { TeamService } from '../team/team.service';
import { User } from '../user/user.model';
import { UserService } from '../user/user.service';
import { PaginatedResponse } from '../utils/pagination.model';

@Injectable()
export class OrganisationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDbClient: DynamoDBClient,
    private readonly userService: UserService,
    private readonly teamService: TeamService,
  ) {}

  async create(organisation: Organisation) {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    const id = uuidv4();
    const newOrganisation = {
      ...organisation,
      id,
    };

    const item = {
      PK: `ORGANISATION#${id}`,
      SK: `ORGANISATION#${id}`,
      ...newOrganisation,
    };

    await this.dynamoDbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return newOrganisation;
  }

  async findAll(
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<Organisation>> {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    const exclusiveStartKey = cursor
      ? (marshall(
          JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')),
        ) as Record<string, AttributeValue>)
      : undefined;

    const { Items = [], LastEvaluatedKey } = await this.dynamoDbClient.send(
      new ScanCommand({
        TableName: tableName,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression:
          'begins_with(PK, :prefix) AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: marshall({
          ':prefix': 'ORGANISATION#',
        }),
      }),
    );

    const data = Items.map((item) => {
      const { PK, SK, ...rest } = unmarshall(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = { PK, SK };
      return rest as Organisation;
    });

    let nextCursor: string | undefined;
    if (LastEvaluatedKey) {
      nextCursor = Buffer.from(
        JSON.stringify(unmarshall(LastEvaluatedKey)),
      ).toString('base64');
    }

    return {
      data,
      pagination: {
        limit,
        has_more: !!nextCursor,
        next_cursor: nextCursor,
      },
    };
  }

  async findOne(id: string) {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    const { Item } = await this.dynamoDbClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `ORGANISATION#${id}`,
        }),
      }),
    );

    if (!Item) {
      throw new NotFoundException(`Organisation with id #${id} not found`);
    }
    const { PK, SK, ...rest } = unmarshall(Item);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unused = { PK, SK };
    return rest as Organisation;
  }

  async update(id: string, organisation: Organisation) {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    // 1. Find the existing organisation record
    const existingOrganisation = await this.findOne(id);

    // 2. Prepare the updated organisation object
    const updatedOrganisation = {
      ...existingOrganisation,
      ...organisation,
    };

    // 3. Store the updated record in DynamoDB
    const item = {
      PK: `ORGANISATION#${id}`,
      SK: `ORGANISATION#${id}`,
      ...updatedOrganisation,
    };

    await this.dynamoDbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }),
    );

    return updatedOrganisation;
  }

  async remove(id: string): Promise<void> {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    // 1. Get the organisation using findOne (throws NotFoundException if not found)
    await this.findOne(id);

    // 2. Remove the record from DynamoDB
    await this.dynamoDbClient.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `ORGANISATION#${id}`,
        }),
      }),
    );
  }

  async listUsers(
    id: string,
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<User>> {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    const exclusiveStartKey = cursor
      ? (marshall(
          JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')),
        ) as Record<string, AttributeValue>)
      : undefined;

    const { Items = [], LastEvaluatedKey } = await this.dynamoDbClient.send(
      new QueryCommand({
        TableName: tableName,
        ConsistentRead: true,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: marshall({
          ':pk': `ORGANISATION#${id}`,
          ':skPrefix': 'USER#',
        }),
      }),
    );

    const data = Items.map((item) => {
      const { PK, SK, organisationId, userId, userEmail, ...rest } =
        unmarshall(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = { PK, SK, organisationId };
      return {
        id: userId,
        email: userEmail,
        ...rest,
      } as User;
    });

    let nextCursor: string | undefined;
    if (LastEvaluatedKey) {
      nextCursor = Buffer.from(
        JSON.stringify(unmarshall(LastEvaluatedKey)),
      ).toString('base64');
    }

    return {
      data,
      pagination: {
        limit,
        has_more: !!nextCursor,
        next_cursor: nextCursor,
      },
    };
  }

  async addUser(id: string, userId: string): Promise<void> {
    const tableName: string = this.configService.get<string>(
      'DYNAMODB_TABLE_NAME',
    );

    // 1. Look up the organisation (ensure it exists)
    await this.findOne(id);

    // 2. Look up the user record using UserService to retrieve the email address
    const { email } = await this.userService.findOne(userId);

    // 3. Put an item in the DynamoDB table
    await this.dynamoDbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `USER#${userId}`,
          organisationId: id,
          userId,
          userEmail: email,
        }),
      }),
    );
  }

  async removeUser(id: string, userId: string): Promise<void> {
    const tableName: string = this.configService.get<string>(
      'DYNAMODB_TABLE_NAME',
    );

    // 1. Look up the organisation
    await this.findOne(id);

    // 2. Ensure user exists (optional, but consistent with team service pattern)
    await this.userService.findOne(userId);

    // 3. Delete the item from the DynamoDB table
    await this.dynamoDbClient.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `USER#${userId}`,
        }),
      }),
    );
  }

  async listTeams(
    id: string,
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<Team>> {
    const tableName = this.configService.get<string>('DYNAMODB_TABLE_NAME');

    const exclusiveStartKey = cursor
      ? (marshall(
          JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')),
        ) as Record<string, AttributeValue>)
      : undefined;

    const { Items = [], LastEvaluatedKey } = await this.dynamoDbClient.send(
      new QueryCommand({
        TableName: tableName,
        ConsistentRead: true,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: marshall({
          ':pk': `ORGANISATION#${id}`,
          ':skPrefix': 'TEAM#',
        }),
      }),
    );

    const data = Items.map((item) => {
      const { PK, SK, organisationId, teamId, teamName, ...rest } =
        unmarshall(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = { PK, SK, organisationId };
      return {
        id: teamId,
        name: teamName,
        groupId: teamId, // Assuming groupId is same as teamId as in team.service.ts
        ...rest,
      } as Team;
    });

    let nextCursor: string | undefined;
    if (LastEvaluatedKey) {
      nextCursor = Buffer.from(
        JSON.stringify(unmarshall(LastEvaluatedKey)),
      ).toString('base64');
    }

    return {
      data,
      pagination: {
        limit,
        has_more: !!nextCursor,
        next_cursor: nextCursor,
      },
    };
  }

  async addTeam(id: string, teamId: string): Promise<void> {
    const tableName: string = this.configService.get<string>(
      'DYNAMODB_TABLE_NAME',
    );

    // 1. Look up the organisation (ensure it exists)
    await this.findOne(id);

    // 2. Look up the team record using TeamService
    const { name } = await this.teamService.findOne(teamId);

    // 3. Put an item in the DynamoDB table
    await this.dynamoDbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `TEAM#${teamId}`,
          organisationId: id,
          teamId,
          teamName: name,
        }),
      }),
    );
  }

  async removeTeam(id: string, teamId: string): Promise<void> {
    const tableName: string = this.configService.get<string>(
      'DYNAMODB_TABLE_NAME',
    );

    // 1. Look up the organisation
    await this.findOne(id);

    // 2. Ensure team exists
    await this.teamService.findOne(teamId);

    // 3. Delete the item from the DynamoDB table
    await this.dynamoDbClient.send(
      new DeleteItemCommand({
        TableName: tableName,
        Key: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `TEAM#${teamId}`,
        }),
      }),
    );
  }
}
