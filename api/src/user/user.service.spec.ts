import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { UserService } from './user.service';
import { User } from './user.model';

describe('UserService', () => {
  let service: UserService;
  let cognitoClient: CognitoIdentityProviderClient;

  const mockCognitoClient = {
    send: jest.fn(),
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
        UserService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CognitoIdentityProviderClient,
          useValue: mockCognitoClient,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    cognitoClient = module.get<CognitoIdentityProviderClient>(
      CognitoIdentityProviderClient,
    );
    jest.clearAllMocks();
    // Default: resolve with an empty object so .catch() is never called on undefined
    mockCognitoClient.send.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with a generated ID in Cognito', async () => {
      const user: User = { id: '', email: 'test@example.com' };

      mockCognitoClient.send.mockResolvedValueOnce({
        User: { Username: 'mock-cognito-id' },
      });

      const result = await service.create(user);

      expect(result.id).toBe('mock-cognito-id');
      expect(result.email).toBe(user.email);
      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(AdminCreateUserCommand),
      );

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[0][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        Username: 'test@example.com',
        UserAttributes: [
          { Name: 'email', Value: 'test@example.com' },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: 'SUPPRESS',
      });
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of users', async () => {
      // ListUsersCommand
      mockCognitoClient.send.mockResolvedValueOnce({
        Users: [
          {
            Username: 'user-1',
            Attributes: [{ Name: 'email', Value: 'user1@example.com' }],
          },
          {
            Username: 'user-2',
            Attributes: [{ Name: 'email', Value: 'user2@example.com' }],
          },
        ],
        PaginationToken: 'next-token',
      });
      // ListUsersInGroupCommand (admins)
      mockCognitoClient.send.mockResolvedValueOnce({ Users: [] });
      // DescribeUserPoolCommand
      mockCognitoClient.send.mockResolvedValueOnce({
        UserPool: { EstimatedNumberOfUsers: 2 },
      });

      const result = await service.findAll(2);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('user-1');
      expect(result.data[0].email).toBe('user1@example.com');
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.next_cursor).toBe('next-token');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[0][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        Limit: 2,
        PaginationToken: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should return a user if it exists in Cognito', async () => {
      const id = 'user-123';

      mockCognitoClient.send.mockResolvedValueOnce({
        Username: id,
        UserAttributes: [{ Name: 'email', Value: 'test@example.com' }],
      });

      const result = await service.findOne(id);

      expect(result.id).toEqual(id);
      expect(result.email).toEqual('test@example.com');
      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(AdminGetUserCommand),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const id = 'non-existent';
      mockCognitoClient.send.mockRejectedValueOnce({
        name: 'UserNotFoundException',
      });

      await expect(service.findOne(id)).rejects.toThrow(
        'User with id #non-existent not found',
      );
    });
  });

  describe('update', () => {
    it('should update a user and Cognito if email changes', async () => {
      const id = 'user-123';
      const updates: User = { id, email: 'new@example.com' };

      // mock findOne
      mockCognitoClient.send.mockResolvedValueOnce({
        Username: id,
        UserAttributes: [{ Name: 'email', Value: 'old@example.com' }],
      });
      // mock update
      mockCognitoClient.send.mockResolvedValueOnce({});

      const result = await service.update(id, updates);

      expect(result.email).toBe('new@example.com');
      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(AdminUpdateUserAttributesCommand),
      );
    });
  });

  describe('remove', () => {
    it('should delete user from Cognito', async () => {
      const id = 'user-123';

      // mock findOne
      mockCognitoClient.send.mockResolvedValueOnce({
        Username: id,
        UserAttributes: [{ Name: 'email', Value: 'test@example.com' }],
      });
      // mock delete
      mockCognitoClient.send.mockResolvedValueOnce({});

      await service.remove(id, 'caller-sub');

      expect(cognitoClient.send).toHaveBeenCalledWith(
        expect.any(AdminDeleteUserCommand),
      );
    });

    it('should throw NotFoundException if user does not exist during removal', async () => {
      const id = 'non-existent';
      // mock findOne rejection
      mockCognitoClient.send.mockRejectedValueOnce({
        name: 'UserNotFoundException',
      });

      await expect(service.remove(id, 'caller-sub')).rejects.toThrow(
        `User with id #${id} not found`,
      );
    });
  });
});
