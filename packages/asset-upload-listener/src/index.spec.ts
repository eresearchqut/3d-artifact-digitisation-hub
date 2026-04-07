import { handler } from './index';
import { EventBridgeEvent, Context } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);

type S3ObjectCreatedEvent = EventBridgeEvent<'Object Created', {
  version: string;
  bucket: { name: string };
  object: { key: string; size: number; etag: string; sequencer: string };
  'request-id': string;
  requester: string;
  reason: string;
}>;

function makeEvent(bucket: string, key: string): S3ObjectCreatedEvent {
  return {
    version: '0',
    id: 'test-event-id',
    source: 'aws.s3',
    account: '000000000000',
    time: new Date().toISOString(),
    region: 'us-east-1',
    resources: [`arn:aws:s3:::${bucket}`],
    'detail-type': 'Object Created',
    detail: {
      version: '0',
      bucket: { name: bucket },
      object: { key, size: 100, etag: 'test-etag', sequencer: 'a' },
      'request-id': 'test-request-id',
      requester: '000000000000',
      reason: 'PutObject',
    },
  };
}

describe('asset-upload-listener handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    s3Mock.reset();
  });

  it('should process S3 event and write to DynamoDB', async () => {
    const event = makeEvent('site-uploads', 'assets/asset-123');
    const context = {} as Context;

    s3Mock.on(HeadObjectCommand).resolves({ Metadata: { name: 'my-model.ply' } });
    dynamoMock.on(PutItemCommand).resolves({});

    await handler(event, context, () => {});

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
    const event = makeEvent('site-uploads', 'assets/asset-456');
    const context = {} as Context;

    s3Mock.on(HeadObjectCommand).resolves({ Metadata: {} });
    dynamoMock.on(PutItemCommand).resolves({});

    await handler(event, context, () => {});

    expect(dynamoMock.calls().length).toBe(1);
    const command = dynamoMock.call(0).args[0] as PutItemCommand;
    expect(command.input.Item?.name.S).toBe('asset-456');
  });

  it('should skip objects with keys not containing assets prefix', async () => {
    const event = makeEvent('site-uploads', 'invalid-key-no-slash.ply');
    const context = {} as Context;

    await handler(event, context, () => {});

    expect(s3Mock.calls().length).toBe(0);
    expect(dynamoMock.calls().length).toBe(0);
  });
});
