import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ClientModule } from './client.module';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('ClientModule with Mocks', () => {
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [ClientModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          const config = {
            AWS_REGION: 'us-east-1',
            S3_ENDPOINT: 'http://localhost:9000',
            DYNAMODB_ENDPOINT: 'http://localhost:4566',
            COGNITO_ENDPOINT: 'http://localhost:9229',
            AWS_ACCESS_KEY_ID: 'test-key',
            AWS_SECRET_ACCESS_KEY: 'test-secret',
          };
          return config[key];
        }),
      })
      .compile();
  });

  it('should verify S3Client is provided and configured correctly', () => {
    const client = module.get<S3Client>(S3Client);
    expect(client).toBeDefined();
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      }),
    );
  });

  it('should verify DynamoDBClient is provided and configured correctly', () => {
    const client = module.get<DynamoDBClient>(DynamoDBClient);
    expect(client).toBeDefined();
    expect(DynamoDBClient).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        endpoint: 'http://localhost:4566',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      }),
    );
  });

  it('should verify CognitoIdentityProviderClient is provided and configured correctly', () => {
    const client = module.get<CognitoIdentityProviderClient>(
      CognitoIdentityProviderClient,
    );
    expect(client).toBeDefined();
    expect(CognitoIdentityProviderClient).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        endpoint: 'http://localhost:9229',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      }),
    );
  });
});
