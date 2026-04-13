import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  DeleteGroupCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListGroupsCommand,
  GetGroupCommand,
  UpdateGroupCommand,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Team } from './team.model';
import { User } from '../user/user.model';
import { UserService } from '../user/user.service';
import { PaginatedResponse } from '../utils/pagination.model';
import { ADMINISTRATORS_GROUP } from '../auth/auth.constants';

const RESERVED_GROUP = ADMINISTRATORS_GROUP;

function assertNotReserved(name: string) {
  if (name?.toLowerCase() === RESERVED_GROUP) {
    throw new ForbiddenException(
      `'${RESERVED_GROUP}' is a reserved group and cannot be managed as a team`,
    );
  }
}

@Injectable()
export class TeamService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cognitoClient: CognitoIdentityProviderClient,
    private readonly userService: UserService,
  ) {}

  async create(team: Team): Promise<Team> {
    assertNotReserved(team.name);
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const response = await this.cognitoClient.send(
      new CreateGroupCommand({
        UserPoolId: userPoolId,
        GroupName: team.name,
        Description: team.description,
      }),
    );

    const {
      Group: { GroupName, Description },
    } = response;

    return {
      name: GroupName,
      description: Description,
    };
  }

  async findAll(
    limit = 10,
    cursor?: string,
  ): Promise<PaginatedResponse<Team>> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    // Fetch the requested page and count all groups in parallel
    const [response, totalCount] = await Promise.all([
      this.cognitoClient.send(
        new ListGroupsCommand({
          UserPoolId: userPoolId,
          Limit: limit,
          NextToken: cursor,
        }),
      ),
      (async () => {
        let count = 0;
        let token: string | undefined;
        do {
          const r = await this.cognitoClient.send(
            new ListGroupsCommand({ UserPoolId: userPoolId, Limit: 60, NextToken: token }),
          );
          count += (r.Groups || []).filter(
            (g) => g.GroupName?.toLowerCase() !== RESERVED_GROUP,
          ).length;
          token = r.NextToken;
        } while (token);
        return count;
      })(),
    ]);

    const data: Team[] = (response.Groups || [])
      .filter((group) => group.GroupName?.toLowerCase() !== RESERVED_GROUP)
      .map((group) => ({
        name: group.GroupName,
        description: group.Description,
      }));

    return {
      data,
      pagination: {
        limit,
        has_more: !!response.NextToken,
        next_cursor: response.NextToken,
        total: totalCount,
      },
    };
  }

  async findOne(name: string): Promise<Team> {
    assertNotReserved(name);
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    try {
      const response = await this.cognitoClient.send(
        new GetGroupCommand({
          UserPoolId: userPoolId,
          GroupName: name,
        }),
      );

      return {
        name: response.Group?.GroupName,
        description: response.Group?.Description,
      };
    } catch (error: any) {
      if (
        error.name === 'ResourceNotFoundException' ||
        error.name === 'GroupNotFoundException'
      ) {
        throw new NotFoundException(`Team with id #${name} not found`);
      }
      throw error;
    }
  }

  async update(name: string, team: Team): Promise<Team> {
    assertNotReserved(name);
    if (team.name) assertNotReserved(team.name);
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    const existing = await this.findOne(name);
    const newName = team.name ?? existing.name;
    const newDescription = team.description ?? existing.description;

    if (newName !== name) {
      // Rename: Cognito has no rename operation, so create new group → copy
      // all members → delete old group.
      try {
        await this.cognitoClient.send(
          new CreateGroupCommand({
            UserPoolId: userPoolId,
            GroupName: newName,
            Description: newDescription,
          }),
        );
      } catch (error: any) {
        if (error.name === 'GroupExistsException') {
          throw new ConflictException(
            `A team named '${newName}' already exists`,
          );
        }
        throw error;
      }

      // Copy all members from the old group to the new one (paginated).
      let nextToken: string | undefined;
      do {
        const page = await this.cognitoClient.send(
          new ListUsersInGroupCommand({
            UserPoolId: userPoolId,
            GroupName: name,
            NextToken: nextToken,
          }),
        );
        await Promise.all(
          (page.Users ?? []).map((u) =>
            this.cognitoClient.send(
              new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                GroupName: newName,
                Username: u.Username,
              }),
            ),
          ),
        );
        nextToken = page.NextToken;
      } while (nextToken);

      await this.cognitoClient.send(
        new DeleteGroupCommand({ UserPoolId: userPoolId, GroupName: name }),
      );

      return { name: newName, description: newDescription };
    }

    // Description-only update.
    await this.cognitoClient.send(
      new UpdateGroupCommand({
        UserPoolId: userPoolId,
        GroupName: name,
        Description: newDescription,
      }),
    );

    return this.findOne(name);
  }

  async remove(id: string): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    await this.findOne(id);

    await this.cognitoClient.send(
      new DeleteGroupCommand({
        UserPoolId: userPoolId,
        GroupName: id,
      }),
    );
  }

  async addUser(name: string, userId: string): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    // Ensure team exists
    await this.findOne(name);

    // Ensure user exists
    const user = await this.userService.findOne(userId);

    await this.cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        GroupName: name,
        Username: user.id,
      }),
    );
  }

  async removeUser(name: string, userId: string): Promise<void> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');

    // Ensure team exists
    await this.findOne(name);

    // Ensure user exists
    const user = await this.userService.findOne(userId);

    await this.cognitoClient.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        GroupName: name,
        Username: user.id,
      }),
    );
  }

  async listUsers(
    teamId: string,
    limit: number = 100,
    cursor?: string,
  ): Promise<PaginatedResponse<User>> {
    const userPoolId = this.configService.get<string>('USER_POOL_ID');
    await this.findOne(teamId);

    const response = await this.cognitoClient.send(
      new ListUsersInGroupCommand({
        UserPoolId: userPoolId,
        GroupName: teamId,
        Limit: limit,
        NextToken: cursor,
      }),
    );

    const data = (response.Users || []).map((u) => {
      const emailAttr = u.Attributes?.find((a) => a.Name === 'email');
      return {
        id: u.Username,
        email: emailAttr?.Value || '',
        cognitoUsername: u.Username,
      } as User;
    });

    return {
      data,
      pagination: {
        limit,
        has_more: !!response.NextToken,
        next_cursor: response.NextToken,
      },
    };
  }
}
