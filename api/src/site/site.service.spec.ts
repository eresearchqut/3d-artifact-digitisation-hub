import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client } from '@aws-sdk/client-s3';
import { SiteService } from './site.service';

describe('SiteService', () => {
  let service: SiteService;
  let cognitoClient: CognitoIdentityProviderClient;

  const mockCognitoClient = {
    send: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        USER_POOL_ID: 'test-user-pool-id',
        S3_UPLOAD_BUCKET: 'test-bucket',
      };
      return config[key];
    }),
  };

  const mockS3Client = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CognitoIdentityProviderClient, useValue: mockCognitoClient },
        { provide: S3Client, useValue: mockS3Client },
      ],
    }).compile();

    service = module.get<SiteService>(SiteService);
    cognitoClient = module.get<CognitoIdentityProviderClient>(
      CognitoIdentityProviderClient,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user pool client for the site', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        UserPoolClient: { ClientId: 'client-1' },
      });

      const result = await service.create({ name: 'Test Site', id: '' });
      expect(result.id).toBe('client-1');
      expect(result.name).toBe('Test Site');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[0][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        ClientName: 'Test Site',
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated list of sites parsed from client names', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        UserPoolClients: [
          { ClientId: 'client-1', ClientName: 'Site 1' },
          { ClientId: 'client-2', ClientName: 'Not-a-site' },
          { ClientId: 'client-3', ClientName: 'Site 2' },
        ],
        NextToken: 'token',
      });

      const result = await service.findAll(2);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toEqual({
        id: 'client-1',
        name: 'Site 1',
      });
      expect(result.data[1]).toEqual({
        id: 'client-2',
        name: 'Not-a-site',
      });
      expect(result.data[2]).toEqual({
        id: 'client-3',
        name: 'Site 2',
      });
      expect(result.pagination.has_more).toBe(true);
      expect(result.pagination.next_cursor).toBe('token');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[0][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        MaxResults: 2,
        NextToken: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should return site if valid user pool client is found', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        UserPoolClient: { ClientId: 'client-1', ClientName: 'Test Site' },
      });

      const result = await service.findOne('client-1');
      expect(result).toEqual({
        id: 'client-1',
        name: 'Test Site',
      });
    });

    it('should throw NotFoundException if Cognito throws ResourceNotFoundException', async () => {
      mockCognitoClient.send.mockRejectedValueOnce({
        name: 'ResourceNotFoundException',
      });

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update user pool client', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        UserPoolClient: { ClientId: 'client-1', ClientName: 'Test Site' },
      }); // from findOne
      mockCognitoClient.send.mockResolvedValueOnce({}); // from update

      const result = await service.update('client-1', {
        id: '',
        name: 'New Name',
      });
      expect(result.name).toBe('New Name');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[1][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        ClientId: 'client-1',
        ClientName: 'New Name',
      });
    });
  });

  describe('remove', () => {
    it('should find one and then delete user pool client', async () => {
      mockCognitoClient.send.mockResolvedValueOnce({
        UserPoolClient: { ClientId: 'client-1', ClientName: 'Test Site' },
      });
      mockCognitoClient.send.mockResolvedValueOnce({});

      await service.remove('client-1');

      const { input } = (cognitoClient.send as jest.Mock).mock.calls[1][0];
      expect(input).toEqual({
        UserPoolId: 'test-user-pool-id',
        ClientId: 'client-1',
      });
    });
  });
});
