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
} from '@aws-sdk/client-cognito-identity-provider';
import { User } from './user.model';
import { ADMINISTRATORS_GROUP, JwtPayload } from '../auth/auth.constants';

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

  async findAll(actor?: JwtPayload): Promise<User[]> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    if (actor && !actor.isAdmin) {
      // Non-admin: return only users who share a team with the actor.
      const teamGroups = (actor.groups ?? []).filter(
        (g) => g.toLowerCase() !== ADMINISTRATORS_GROUP,
      );
      const seen = new Map<string, User>();
      await Promise.all(
        teamGroups.map(async (groupName) => {
          const groupUsers: any[] = [];
          let token: string | undefined;
          do {
            const r = await this.cognitoClient.send(
              new ListUsersInGroupCommand({
                UserPoolId: userPoolId,
                GroupName: groupName,
                Limit: 60,
                NextToken: token,
              }),
            );
            groupUsers.push(...(r.Users ?? []));
            token = r.NextToken;
          } while (token);
          for (const u of groupUsers) {
            if (!seen.has(u.Username)) {
              const emailAttr = u.Attributes?.find(
                (a: any) => a.Name === 'email',
              );
              const subAttr = u.Attributes?.find((a: any) => a.Name === 'sub');
              seen.set(u.Username, {
                id: u.Username,
                sub: subAttr?.Value,
                email: emailAttr?.Value || '',
              } as User);
            }
          }
        }),
      );
      return Array.from(seen.values());
    }

    const [allCognitoUsers, adminsResponse] = await Promise.all([
      (async () => {
        const users: any[] = [];
        let token: string | undefined;
        do {
          const r = await this.cognitoClient.send(
            new ListUsersCommand({
              UserPoolId: userPoolId,
              Limit: 60,
              PaginationToken: token,
            }),
          );
          users.push(...(r.Users || []));
          token = r.PaginationToken;
        } while (token);
        return users;
      })(),
      this.cognitoClient
        .send(
          new ListUsersInGroupCommand({
            UserPoolId: userPoolId,
            GroupName: ADMINISTRATORS_GROUP,
          }),
        )
        .catch(() => ({ Users: [] })),
    ]);

    const adminUsernames = new Set(
      (adminsResponse.Users ?? []).map((u: any) => u.Username),
    );

    return allCognitoUsers.map((u) => {
      const emailAttr = u.Attributes?.find((a: any) => a.Name === 'email');
      const subAttr = u.Attributes?.find((a: any) => a.Name === 'sub');
      return {
        id: u.Username,
        sub: subAttr?.Value,
        email: emailAttr?.Value || '',
        isAdmin: adminUsernames.has(u.Username),
      } as User;
    });
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
