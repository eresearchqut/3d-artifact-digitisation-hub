import { handler } from './index';
import { S3Event, Context } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBClient);

describe('site-upload-listener handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  it('should process S3 event and write to DynamoDB', async () => {
    const event: Partial<S3Event> = {
      Records: [
        {
          s3: {
            bucket: { name: 'site-uploads', ownerIdentity: { principalId: 'A' }, arn: 'arn' },
            object: { key: 'site-123/asset.ply', size: 100, eTag: 'test-etag', sequencer: 'a' },
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

    dynamoMock.on(PutItemCommand).resolves({});

    await handler(event as S3Event, context, () => {});

    expect(dynamoMock.calls().length).toBe(1);
    const command = dynamoMock.call(0).args[0] as PutItemCommand;
    const item = command.input.Item;

    expect(item).toBeDefined();
    // Item is unmarshalled in tests since it's marshalled internally, wait, we can just check the raw properties in PutItemCommand
    expect(item?.PK.S).toBe('SITE#site-123');
    expect(item?.SK.S).toBe('ASSET#test-etag');
    expect(item?.bucket.S).toBe('site-uploads');
    expect(item?.key.S).toBe('site-123/asset.ply');
  });

  it('should skip objects with keys not containing site ID', async () => {
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

    expect(dynamoMock.calls().length).toBe(0);
  });
});
