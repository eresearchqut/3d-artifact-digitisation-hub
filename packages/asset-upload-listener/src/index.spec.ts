import { handler } from './index';
import { S3Event, Context } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);

describe('asset-upload-listener handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    s3Mock.reset();
  });

  it('should process S3 event and write to DynamoDB', async () => {
    const event: Partial<S3Event> = {
      Records: [
        {
          s3: {
            bucket: { name: 'site-uploads', ownerIdentity: { principalId: 'A' }, arn: 'arn' },
            object: { key: 'assets/asset-123', size: 100, eTag: 'test-etag', sequencer: 'a' },
            s3SchemaVersion: '1.0',
            configurationId: 'test',
          },
          awsRegion: 'us-east-1',
          eventName: 'ObjectCreated:Put',
          eventSource: 'aws:s3',
          eventTime: new Date().toISOString(),
          eventVersion: '2.0',
          requestParameters: { sourceIPAddress: '127.0.0.1' },
          responseElements: { 'x-amz-request-id': 'xyz', 'x-amz-id-2': 'abc' },
          userIdentity: { principalId: 'A' },
        },
      ],
    };

    const context = {} as Context;

    s3Mock.on(HeadObjectCommand).resolves({ Metadata: { name: 'my-model.ply' } });
    dynamoMock.on(PutItemCommand).resolves({});

    await handler(event as S3Event, context, () => {});

    expect(dynamoMock.calls().length).toBe(1);
    const command = dynamoMock.call(0).args[0] as PutItemCommand;
    const item = command.input.Item;

    expect(item).toBeDefined();
    expect(item?.PK.S).toBe('ASSET#asset-123');
    expect(item?.SK.S).toBe('ASSET#asset-123');
    expect(item?.bucket.S).toBe('site-uploads');
    expect(item?.key.S).toBe('assets/asset-123');
    expect(item?.name.S).toBe('my-model.ply');
  });

  it('should fall back to assetId as name when HeadObject metadata is absent', async () => {
    const event: Partial<S3Event> = {
      Records: [
        {
          s3: {
            bucket: { name: 'site-uploads', ownerIdentity: { principalId: 'A' }, arn: 'arn' },
            object: { key: 'assets/asset-456', size: 100, eTag: 'test-etag', sequencer: 'b' },
            s3SchemaVersion: '1.0',
            configurationId: 'test',
          },
          awsRegion: 'us-east-1',
          eventName: 'ObjectCreated:Put',
          eventSource: 'aws:s3',
          eventTime: new Date().toISOString(),
          eventVersion: '2.0',
          requestParameters: { sourceIPAddress: '127.0.0.1' },
          responseElements: { 'x-amz-request-id': 'xyz', 'x-amz-id-2': 'abc' },
          userIdentity: { principalId: 'A' },
        },
      ],
    };

    const context = {} as Context;

    s3Mock.on(HeadObjectCommand).resolves({ Metadata: {} });
    dynamoMock.on(PutItemCommand).resolves({});

    await handler(event as S3Event, context, () => {});

    expect(dynamoMock.calls().length).toBe(1);
    const command = dynamoMock.call(0).args[0] as PutItemCommand;
    expect(command.input.Item?.name.S).toBe('asset-456');
  });

  it('should skip objects with keys not containing assets prefix', async () => {
    const event: Partial<S3Event> = {
      Records: [
        {
          s3: {
            bucket: { name: 'site-uploads', ownerIdentity: { principalId: 'A' }, arn: 'arn' },
            object: { key: 'invalid-key-no-slash.ply', size: 100, eTag: 'test-etag', sequencer: 'a' },
            s3SchemaVersion: '1.0',
            configurationId: 'test',
          },
          awsRegion: 'us-east-1',
          eventName: 'ObjectCreated:Put',
          eventSource: 'aws:s3',
          eventTime: new Date().toISOString(),
          eventVersion: '2.0',
          requestParameters: { sourceIPAddress: '127.0.0.1' },
          responseElements: { 'x-amz-request-id': 'xyz', 'x-amz-id-2': 'abc' },
          userIdentity: { principalId: 'A' },
        },
      ],
    };

    const context = {} as Context;

    await handler(event as S3Event, context, () => {});

    expect(s3Mock.calls().length).toBe(0);
    expect(dynamoMock.calls().length).toBe(0);
  });
});
