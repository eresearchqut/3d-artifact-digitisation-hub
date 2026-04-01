import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { OrganisationService } from './organisation.service';
import { UserService } from '../user/user.service';
import { TeamService } from '../team/team.service';

describe('OrganisationService', () => {
  let service: OrganisationService;
  let dynamoDbClient: DynamoDBClient;

  const mockDynamoDbClient = {
    send: jest.fn(),
  };

  const mockUserService = {
    findOne: jest.fn(),
  };

  const mockTeamService = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        DYNAMODB_TABLE_NAME: 'test-table',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganisationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DynamoDBClient,
          useValue: mockDynamoDbClient,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: TeamService,
          useValue: mockTeamService,
        },
      ],
    }).compile();

    service = module.get<OrganisationService>(OrganisationService);
    dynamoDbClient = module.get<DynamoDBClient>(DynamoDBClient);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new organisation in DynamoDB with a generated ID', async () => {
      const org = { name: 'Test Org' };
      mockDynamoDbClient.send.mockResolvedValueOnce({});

      const result = await service.create(org as any);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.name).toBe(org.name);
      expect(dynamoDbClient.send).toHaveBeenCalledWith(
        expect.any(PutItemCommand),
      );

      const { input } = (dynamoDbClient.send as jest.Mock).mock.calls[0][0];
      const expectedItem = {
        PK: `ORGANISATION#${result.id}`,
        SK: `ORGANISATION#${result.id}`,
        ...result,
      };

      expect(input).toEqual({
        TableName: 'test-table',
        Item: marshall(expectedItem),
      });
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of organisations', async () => {
      const mockItems = [
        {
          PK: { S: 'ORGANISATION#1' },
          SK: { S: 'ORGANISATION#1' },
          id: { S: '1' },
          name: { S: 'Org 1' },
        },
        {
          PK: { S: 'ORGANISATION#2' },
          SK: { S: 'ORGANISATION#2' },
          id: { S: '2' },
          name: { S: 'Org 2' },
        },
      ];

      mockDynamoDbClient.send.mockResolvedValueOnce({
        Items: mockItems,
        LastEvaluatedKey: {
          PK: { S: 'ORGANISATION#2' },
          SK: { S: 'ORGANISATION#2' },
        },
      });

      const result = await service.findAll(2);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('1');
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.next_cursor).toBeDefined();
      expect(dynamoDbClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            FilterExpression:
              'begins_with(PK, :prefix) AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: marshall({ ':prefix': 'ORGANISATION#' }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an organisation if it exists in DynamoDB', async () => {
      const id = 'org-123';
      const mockOrg = {
        PK: `ORGANISATION#${id}`,
        SK: `ORGANISATION#${id}`,
        id,
        name: 'Test Org',
      };

      mockDynamoDbClient.send.mockResolvedValueOnce({
        Item: marshall(mockOrg),
      });

      const result = await service.findOne(id);

      const { PK, SK, ...expectedResult } = mockOrg;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = { PK, SK };
      expect(result).toEqual(expectedResult);
      expect(dynamoDbClient.send).toHaveBeenCalledWith(
        expect.any(GetItemCommand),
      );
    });

    it('should throw NotFoundException if organisation does not exist', async () => {
      const id = 'non-existent';
      mockDynamoDbClient.send.mockResolvedValueOnce({ Item: undefined });

      await expect(service.findOne(id)).rejects.toThrow(
        'Organisation with id #non-existent not found',
      );
    });
  });

  describe('update', () => {
    it('should update an organisation', async () => {
      const id = 'org-123';
      const existingOrg = {
        PK: `ORGANISATION#${id}`,
        SK: `ORGANISATION#${id}`,
        id,
        name: 'Old Name',
      };

      const updates = { name: 'New Name' };

      mockDynamoDbClient.send.mockResolvedValueOnce({
        Item: marshall(existingOrg),
      });
      mockDynamoDbClient.send.mockResolvedValueOnce({});

      const result = await service.update(id, updates as any);

      const { PK, SK, ...expectedBase } = existingOrg;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _unused = { PK, SK };
      expect(result).toEqual({ ...expectedBase, ...updates });
      expect(dynamoDbClient.send).toHaveBeenCalledWith(
        expect.any(PutItemCommand),
      );
    });
  });

  describe('remove', () => {
    it('should remove an organisation from DynamoDB', async () => {
      const id = 'org-123';
      mockDynamoDbClient.send.mockResolvedValueOnce({
        Item: marshall({
          PK: `ORGANISATION#${id}`,
          SK: `ORGANISATION#${id}`,
          id,
        }),
      });
      mockDynamoDbClient.send.mockResolvedValueOnce({});

      await service.remove(id);

      expect(dynamoDbClient.send).toHaveBeenCalledWith(
        expect.any(DeleteItemCommand),
      );
    });

    it('should throw NotFoundException if organisation does not exist', async () => {
      const id = 'non-existent';
      mockDynamoDbClient.send.mockResolvedValueOnce({ Item: undefined });

      await expect(service.remove(id)).rejects.toThrow(
        'Organisation with id #non-existent not found',
      );
    });
  });

  describe('organisation-user associations', () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const userEmail = 'test@example.com';

    describe('addUser', () => {
      it('should add a user to an organisation in DynamoDB', async () => {
        mockDynamoDbClient.send.mockResolvedValueOnce({
          Item: marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `ORGANISATION#${orgId}`,
          }),
        });
        mockUserService.findOne.mockResolvedValueOnce({
          id: userId,
          email: userEmail,
        });
        mockDynamoDbClient.send.mockResolvedValueOnce({});

        await service.addUser(orgId, userId);

        expect(mockUserService.findOne).toHaveBeenCalledWith(userId);
        expect(dynamoDbClient.send).toHaveBeenCalledWith(
          expect.any(PutItemCommand),
        );
        const { input } = (dynamoDbClient.send as jest.Mock).mock.calls[1][0];
        expect(input.Item).toEqual(
          marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `USER#${userId}`,
            organisationId: orgId,
            userId,
            userEmail,
          }),
        );
      });
    });

    describe('removeUser', () => {
      it('should remove a user from an organisation in DynamoDB', async () => {
        mockDynamoDbClient.send.mockResolvedValueOnce({
          Item: marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `ORGANISATION#${orgId}`,
          }),
        });
        mockUserService.findOne.mockResolvedValueOnce({
          id: userId,
          email: userEmail,
        });
        mockDynamoDbClient.send.mockResolvedValueOnce({});

        await service.removeUser(orgId, userId);

        expect(dynamoDbClient.send).toHaveBeenCalledWith(
          expect.any(DeleteItemCommand),
        );
        // Find the DeleteItemCommand call (it's the 3rd call to send: findOne, userService.findOne, DeleteItemCommand)
        const deleteCall = (dynamoDbClient.send as jest.Mock).mock.calls.find(
          (call) => call[0] instanceof DeleteItemCommand,
        );
        const { input } = deleteCall[0];
        expect(input.Key).toEqual(
          marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `USER#${userId}`,
          }),
        );
      });
    });

    describe('listUsers', () => {
      it('should list users in an organisation', async () => {
        mockDynamoDbClient.send.mockResolvedValueOnce({
          Items: [
            marshall({
              PK: `ORGANISATION#${orgId}`,
              SK: `USER#${userId}`,
              organisationId: orgId,
              userId,
              userEmail,
            }),
          ],
        });

        const result = await service.listUsers(orgId);

        expect(dynamoDbClient.send).toHaveBeenCalledWith(
          expect.any(QueryCommand),
        );
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          id: userId,
          email: userEmail,
        });
      });
    });
  });

  describe('organisation-team associations', () => {
    const orgId = 'org-1';
    const teamId = 'team-1';
    const teamName = 'Team Alpha';

    describe('addTeam', () => {
      it('should add a team to an organisation in DynamoDB', async () => {
        mockDynamoDbClient.send.mockResolvedValueOnce({
          Item: marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `ORGANISATION#${orgId}`,
          }),
        });
        mockTeamService.findOne.mockResolvedValueOnce({
          id: teamId,
          name: teamName,
        });
        mockDynamoDbClient.send.mockResolvedValueOnce({});

        await service.addTeam(orgId, teamId);

        expect(mockTeamService.findOne).toHaveBeenCalledWith(teamId);
        expect(dynamoDbClient.send).toHaveBeenCalledWith(
          expect.any(PutItemCommand),
        );
        const { input } = (dynamoDbClient.send as jest.Mock).mock.calls[1][0];
        expect(input.Item).toEqual(
          marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `TEAM#${teamId}`,
            organisationId: orgId,
            teamId,
            teamName,
          }),
        );
      });
    });

    describe('removeTeam', () => {
      it('should remove a team from an organisation in DynamoDB', async () => {
        mockDynamoDbClient.send.mockResolvedValueOnce({
          Item: marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `ORGANISATION#${orgId}`,
          }),
        });
        mockTeamService.findOne.mockResolvedValueOnce({
          id: teamId,
          name: teamName,
        });
        mockDynamoDbClient.send.mockResolvedValueOnce({});

        await service.removeTeam(orgId, teamId);

        expect(dynamoDbClient.send).toHaveBeenCalledWith(
          expect.any(DeleteItemCommand),
        );
        // Find the DeleteItemCommand call
        const deleteCall = (dynamoDbClient.send as jest.Mock).mock.calls.find(
          (call) => call[0] instanceof DeleteItemCommand,
        );
        const { input } = deleteCall[0];
        expect(input.Key).toEqual(
          marshall({
            PK: `ORGANISATION#${orgId}`,
            SK: `TEAM#${teamId}`,
          }),
        );
      });
    });

    describe('listTeams', () => {
      it('should list teams in an organisation', async () => {
        mockDynamoDbClient.send.mockResolvedValueOnce({
          Items: [
            marshall({
              PK: `ORGANISATION#${orgId}`,
              SK: `TEAM#${teamId}`,
              organisationId: orgId,
              teamId,
              teamName,
            }),
          ],
        });

        const result = await service.listTeams(orgId);

        expect(dynamoDbClient.send).toHaveBeenCalledWith(
          expect.any(QueryCommand),
        );
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          id: teamId,
          name: teamName,
          groupId: teamId,
        });
      });
    });
  });
});
