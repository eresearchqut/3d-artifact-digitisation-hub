import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  DescribeUserPoolClientCommand,
  ListUserPoolClientsCommand,
  UpdateUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Site } from './site.model';
import { PaginatedResponse } from '../utils/pagination.model';

@Injectable()
export class SiteService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cognitoClient: CognitoIdentityProviderClient,
    private readonly s3Client: S3Client,
  ) {}

  async create(site: Site): Promise<Site> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const { name } = site;

    const response = await this.cognitoClient.send(
      new CreateUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientName: name,
      }),
    );

    const clientId = response.UserPoolClient?.ClientId || '';

    return {
      ...site,
      id: clientId,
      name,
    };
  }

  async findAll(
    limit = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<Site>> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const response = await this.cognitoClient.send(
      new ListUserPoolClientsCommand({
        UserPoolId: userPoolId,
        MaxResults: limit,
        NextToken: cursor,
      }),
    );

    const data: Site[] = [];

    for (const { ClientId, ClientName } of response.UserPoolClients || []) {
      data.push({
        id: ClientId,
        name: ClientName,
      });
    }

    return {
      data,
      pagination: {
        limit,
        has_more: !!response.NextToken,
        next_cursor: response.NextToken,
      },
    };
  }

  async findOne(id: string): Promise<Site> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    try {
      const response = await this.cognitoClient.send(
        new DescribeUserPoolClientCommand({
          UserPoolId: userPoolId,
          ClientId: id,
        }),
      );

      const { ClientId, ClientName } = response.UserPoolClient || {};

      return {
        id: ClientId,
        name: ClientName,
      };
    } catch (e: any) {
      if (
        e.name === 'ResourceNotFoundException' ||
        e.name === 'NotAuthorizedException'
      ) {
        throw new NotFoundException(`Site with id #${id} not found`);
      }
      throw e;
    }
  }

  async update(id: string, site: Site): Promise<Site> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    // 1. Find the existing site record
    const existingSite = await this.findOne(id);

    // 2. Prepare the updated site object
    const name = site.name !== undefined ? site.name : existingSite.name;

    await this.cognitoClient.send(
      new UpdateUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientId: id,
        ClientName: name,
      }),
    );

    return {
      id,
      name,
    };
  }

  async remove(id: string): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    // 1. Get the site using findOne (throws NotFoundException if not found)
    await this.findOne(id);

    // 2. Delete User Pool Client from Cognito
    await this.cognitoClient.send(
      new DeleteUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientId: id,
      }),
    );
  }

  async generateUploadUrl(id: string, extension: string): Promise<{ uploadUrl: string }> {
    // 1. Validate the site ID by finding it
    await this.findOne(id);

    if (extension !== '.ply' && extension !== '.mp3') {
      throw new BadRequestException('Unsupported file extension. Only .ply and .mp3 are supported.');
    }

    const bucketName = this.configService.get<string>('S3_UPLOAD_BUCKET') || 'site-uploads';
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `${id}/asset${extension}`,
      ContentType: 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { uploadUrl };
  }
}
