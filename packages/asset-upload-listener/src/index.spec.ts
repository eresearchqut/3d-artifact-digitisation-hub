import { handler } from './index';
import { EventBridgeEvent, Context } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBClient);

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
  });

  it('should process S3 event and update DynamoDB record', async () => {
    const event = makeEvent('site-uploads', 'assets/asset-123');
    const context = {} as Context;

    dynamoMock.on(UpdateItemCommand).resolves({});

    await handler(event, context, () => {});

    expect(dynamoMock.calls().length).toBe(1);
    const command = dynamoMock.call(0).args[0] as UpdateItemCommand;
    const input = command.input;

    expect(input.Key?.PK?.S).toBe('ASSET#asset-123');
    expect(input.Key?.SK?.S).toBe('ASSET#asset-123');
    expect(input.ExpressionAttributeValues?.[':bucket']?.S).toBe('site-uploads');
    expect(input.ExpressionAttributeValues?.[':key']?.S).toBe('assets/asset-123');
    expect(input.ExpressionAttributeValues?.[':status']?.S).toBe('uploaded');
  });

  it('should fall back to assetId as name via if_not_exists expression', async () => {
    const event = makeEvent('site-uploads', 'assets/asset-456');
    const context = {} as Context;

    dynamoMock.on(UpdateItemCommand).resolves({});

    await handler(event, context, () => {});

    expect(dynamoMock.calls().length).toBe(1);
    const command = dynamoMock.call(0).args[0] as UpdateItemCommand;
    // The fallback name is provided as the :name expression value
    expect(command.input.ExpressionAttributeValues?.[':name']?.S).toBe('asset-456');
  });

  it('should skip objects with keys not containing assets prefix', async () => {
    const event = makeEvent('site-uploads', 'invalid-key-no-slash.ply');
    const context = {} as Context;

    await handler(event, context, () => {});

    expect(dynamoMock.calls().length).toBe(0);
  });
});
