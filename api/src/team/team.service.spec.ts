import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { TeamService } from './team.service';
import { UserService } from '../user/user.service';

describe('TeamService', () => {
  let service: TeamService;
  let cognitoClient: CognitoIdentityProviderClient;

  const mockCognitoClient = {
    send: jest.fn(),
  };

  const mockUserService = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        USER_POOL_ID: 'test-user-pool-id',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CognitoIdentityProviderClient, useValue: mockCognitoClient },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    cognitoClient = module.get<CognitoIdentityProviderClient>(
      CognitoIdentityProviderClient,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new team in Cognito', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Test Team' },
      });

      const result = await service.create({
        name: 'team-1',
        description: 'Test Team',
      });
      expect(result.name).toBe('team-1');
      expect(result.description).toBe('Test Team');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[0][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        GroupName: 'team-1',
        Description: 'Test Team',
      });
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of teams', async () => {
      // Page data
      mockCognitoClient.send.mockResolvedValueOnce({
        Groups: [
          { GroupName: 'team-1', Description: 'Team 1' },
          { GroupName: 'team-2', Description: 'Team 2' },
        ],
        NextToken: 'token',
      });
      // Count scan (all groups, no NextToken)
      mockCognitoClient.send.mockResolvedValueOnce({
        Groups: [{ GroupName: 'team-1' }, { GroupName: 'team-2' }],
      });

      const result = await service.findAll(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('team-1');
      expect(result.data[0].description).toBe('Team 1');
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.next_cursor).toBe('token');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[0][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        Limit: 2,
        NextToken: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should return a team if it exists', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Team 1' },
      });

      const result = await service.findOne('team-1');
      expect(result.name).toBe('team-1');
      expect(result.description).toBe('Team 1');
    });

    it('should throw NotFoundException if team does not exist', async () => {
      mockCognitoClient.send.mockRejectedValueOnce({
        name: 'ResourceNotFoundException',
      });
      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update description only when name is unchanged', async () => {
      // findOne → UpdateGroupCommand → findOne
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Old Description' },
      });
      mockCognitoClient.send.mockResolvedValueOnce({});
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'New Description' },
      });

      const result = await service.update('team-1', {
        name: 'team-1',
        description: 'New Description',
      });
      expect(result.description).toBe('New Description');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[1][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        GroupName: 'team-1',
        Description: 'New Description',
      });
    });

    it('should rename: create new group, copy members, delete old group', async () => {
      // findOne → CreateGroupCommand → ListUsersInGroupCommand → AdminAddUserToGroupCommand → DeleteGroupCommand
      mockCognitoClient.send
        .mockResolvedValueOnce({
          Group: { GroupName: 'team-1', Description: 'Desc' },
        }) // findOne
        .mockResolvedValueOnce({}) // CreateGroupCommand
        .mockResolvedValueOnce({
          // ListUsersInGroupCommand (page 1, no more)
          Users: [{ Username: 'user-1' }],
          NextToken: undefined,
        })
        .mockResolvedValueOnce({}) // AdminAddUserToGroupCommand
        .mockResolvedValueOnce({}); // DeleteGroupCommand

      const result = await service.update('team-1', {
        name: 'team-renamed',
        description: 'Desc',
      });

      expect(result.name).toBe('team-renamed');

      const calls = (cognitoClient.send as jest.Mock).mock.calls;
      expect(calls[1][0].input).toMatchObject({ GroupName: 'team-renamed' }); // CreateGroupCommand
      expect(calls[2][0].input).toMatchObject({ GroupName: 'team-1' }); // ListUsersInGroupCommand
      expect(calls[3][0].input).toMatchObject({
        GroupName: 'team-renamed',
        Username: 'user-1',
      }); // AddUser
      expect(calls[4][0].input).toMatchObject({ GroupName: 'team-1' }); // DeleteGroupCommand
    });
  });

  describe('remove', () => {
    it('should delete a team', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Test Team' },
      });
      mockCognitoClient.send.mockResolvedValueOnce({});

      await service.remove('team-1');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[1][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        GroupName: 'team-1',
      });
    });
  });

  describe('addUser', () => {
    it('should add a user to a team', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Test Team' },
      });
      mockUserService.findOne.mockResolvedValueOnce({
        id: 'user-1',
        cognitoUsername: 'user-1',
      });
      mockCognitoClient.send.mockResolvedValueOnce({});

      await service.addUser('team-1', 'user-1');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[1][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        GroupName: 'team-1',
        Username: 'user-1',
      });
    });
  });

  describe('removeUser', () => {
    it('should remove a user from a team', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Test Team' },
      });
      mockUserService.findOne.mockResolvedValueOnce({
        id: 'user-1',
        cognitoUsername: 'user-1',
      });
      mockCognitoClient.send.mockResolvedValueOnce({});

      await service.removeUser('team-1', 'user-1');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[1][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        GroupName: 'team-1',
        Username: 'user-1',
      });
    });
  });

  describe('listUsers', () => {
    it('should list users in a team', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        Group: { GroupName: 'team-1', Description: 'Test Team' },
      });
      mockCognitoClient.send.mockResolvedValueOnce({
        Users: [
          {
            Username: 'user-1',
            Attributes: [{ Name: 'email', Value: 'u1@example.com' }],
          },
        ],
        NextToken: 'token',
      });

      const result = await service.listUsers('team-1', 2);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('user-1');
      expect(result.pagination.has_more).toBe(true);
    });
  });
});
