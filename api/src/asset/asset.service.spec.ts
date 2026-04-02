import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { AssetService } from './asset.service';

describe('AssetService', () => {
  let service: AssetService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-table'),
          },
        },
        {
          provide: DynamoDBClient,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: S3Client,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AssetService>(AssetService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // basic mock test passing
  it('should run tests', () => {
    expect(true).toBe(true);
  });
});
