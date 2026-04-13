import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  AdminGetUserCommand,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { User } from './user.model';
import { PaginatedResponse } from '../utils/pagination.model';
import { ADMINISTRATORS_GROUP } from '../auth/auth.constants';

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
    const subAttr = response.User?.Attributes?.find((a) => a.Name === 'sub');

    return {
      id: cognitoUsername,
      sub: subAttr?.Value,
      email: user.email,
    } as User;
  }

  async findAll(
    limit: number = 10,
    cursor?: string,
  ): Promise<PaginatedResponse<User>> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const [usersResponse, adminsResponse, poolResponse] = await Promise.all([
      this.cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Limit: limit,
          PaginationToken: cursor,
        }),
      ),
      // Fetch current admin members to annotate each user with isAdmin.
      // Ignore errors gracefully — the administrators group may not exist yet.
      this.cognitoClient
        .send(
          new ListUsersInGroupCommand({
            UserPoolId: userPoolId,
            GroupName: ADMINISTRATORS_GROUP,
          }),
        )
        .catch(() => ({ Users: [] })),
      // EstimatedNumberOfUsers is cheap — no full scan required
      this.cognitoClient
        .send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }))
        .catch(() => null),
    ]);

    const adminUsernames = new Set(
      (adminsResponse.Users ?? []).map((u) => u.Username),
    );

    const data: User[] = (usersResponse.Users || []).map((u) => {
      const emailAttr = u.Attributes?.find((a) => a.Name === 'email');
      const subAttr = u.Attributes?.find((a) => a.Name === 'sub');
      return {
        id: u.Username,
        sub: subAttr?.Value,
        email: emailAttr?.Value || '',
        isAdmin: adminUsernames.has(u.Username),
      } as User;
    });

    return {
      data,
      pagination: {
        limit,
        has_more: !!usersResponse.PaginationToken,
        next_cursor: usersResponse.PaginationToken,
        total: poolResponse?.UserPool?.EstimatedNumberOfUsers,
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    try {
      const [userResponse, adminsResponse] = await Promise.all([
        this.cognitoClient.send(
          new AdminGetUserCommand({ UserPoolId: userPoolId, Username: id }),
        ),
        this.cognitoClient
          .send(
            new ListUsersInGroupCommand({
              UserPoolId: userPoolId,
              GroupName: ADMINISTRATORS_GROUP,
            }),
          )
          .catch(() => ({ Users: [] })),
      ]);

      const emailAttr = userResponse.UserAttributes?.find(
        (a) => a.Name === 'email',
      );
      const subAttr = userResponse.UserAttributes?.find(
        (a) => a.Name === 'sub',
      );
      const adminUsernames = new Set(
        (adminsResponse.Users ?? []).map((u) => u.Username),
      );

      return {
        id: userResponse.Username,
        sub: subAttr?.Value,
        email: emailAttr?.Value || '',
        isAdmin: adminUsernames.has(userResponse.Username),
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

  async remove(id: string, callerSub: string): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const targetUser = await this.findOne(id);

    if (targetUser.sub === callerSub) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: id,
      }),
    );
  }

  async setAdmin(
    id: string,
    isAdmin: boolean,
    callerSub: string,
  ): Promise<void> {
    const targetUser = await this.findOne(id);
    if (!isAdmin && targetUser.sub === callerSub) {
      throw new ForbiddenException(
        'You cannot remove your own administrator role',
      );
    }

    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const Command = isAdmin
      ? AdminAddUserToGroupCommand
      : AdminRemoveUserFromGroupCommand;

    await this.cognitoClient.send(
      new Command({
        UserPoolId: userPoolId,
        Username: id,
        GroupName: ADMINISTRATORS_GROUP,
      }),
    );
  }

  async resetPassword(
    id: string,
    password: string,
    requireReset: boolean,
  ): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    await this.findOne(id);

    await this.cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: id,
        Password: password,
        // When Permanent is false Cognito marks the account FORCE_CHANGE_PASSWORD,
        // prompting the user to set a new password on next login.
        Permanent: !requireReset,
      }),
    );
  }
}
