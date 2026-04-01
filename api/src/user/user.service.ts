import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { User } from './user.model';
import { PaginatedResponse } from '../utils/pagination.model';

@Injectable()
export class UserService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cognitoClient: CognitoIdentityProviderClient,
  ) {}

  async create(user: User): Promise<User> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const response = await this.cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: 'SUPPRESS',
      }),
    );

    const cognitoUsername = response.User?.Username;

    return {
      id: cognitoUsername,
      email: user.email,
    } as User;
  }

  async findAll(
    limit: number = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<User>> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const response = await this.cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: limit,
        PaginationToken: cursor,
      }),
    );

    const data: User[] = (response.Users || []).map((u) => {
      const emailAttr = u.Attributes?.find((a) => a.Name === 'email');
      return {
        id: u.Username,
        email: emailAttr?.Value || '',
      } as User;
    });

    return {
      data,
      pagination: {
        limit,
        has_more: !!response.PaginationToken,
        next_cursor: response.PaginationToken,
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    try {
      const response = await this.cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: id,
        }),
      );

      const emailAttr = response.UserAttributes?.find(
        (a) => a.Name === 'email',
      );

      return {
        id: response.Username,
        email: emailAttr?.Value || '',
      } as User;
    } catch (e: any) {
      if (e.name === 'UserNotFoundException') {
        throw new NotFoundException(`User with id #${id} not found`);
      }
      throw e;
    }
  }

  async update(id: string, user: User): Promise<User> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const existingUser = await this.findOne(id);

    if (user.email && user.email !== existingUser.email) {
      await this.cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: existingUser.id,
          UserAttributes: [
            { Name: 'email', Value: user.email },
            { Name: 'email_verified', Value: 'true' },
          ],
        }),
      );
    }

    return {
      ...existingUser,
      ...user,
      id: existingUser.id,
    };
  }

  async remove(id: string): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    await this.findOne(id);

    await this.cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: id,
      }),
    );
  }
}
