import { EventBridgeEvent, Handler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

// EventBridge S3 Object Created notification detail shape
interface S3ObjectCreatedDetail {
  version: string;
  bucket: { name: string };
  object: { key: string; size: number; etag: string; sequencer: string };
  'request-id': string;
  requester: string;
  reason: string;
}

type S3ObjectCreatedEvent = EventBridgeEvent<'Object Created', S3ObjectCreatedDetail>;

const dynamoClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
});

export const handler: Handler<S3ObjectCreatedEvent> = async (event: S3ObjectCreatedEvent): Promise<void> => {
  console.log(`Received event: ${JSON.stringify(event)}`);

  const bucket = event.detail.bucket.name;
  const key = event.detail.object.key;

  // Key format expected: assets/{asset_id}
  const parts = key.split('/');
  if (parts.length < 2 || parts[0] !== 'assets') {
    console.warn(`Skipping key ${key}: Does not contain an assets prefix`);
    return;
  }

  const assetId = parts[1];

  try {
    // Use UpdateItem so we preserve the name and metadata pre-written by the API
    // when the presigned URL was generated. If the record doesn't exist for any
    // reason, if_not_exists ensures a sensible fallback name.
    const command = new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE || '3d-hub-assets',
      Key: marshall({ PK: `ASSET#${assetId}`, SK: `ASSET#${assetId}` }),
      UpdateExpression:
        'SET #bucket = :bucket, #key = :key, #uploadedAt = :uploadedAt, ' +
        '#name = if_not_exists(#name, :name), #status = :status',
      ExpressionAttributeNames: {
        '#bucket': 'bucket',
        '#key': 'key',
        '#uploadedAt': 'uploadedAt',
        '#name': 'name',
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':bucket': bucket,
        ':key': key,
        ':uploadedAt': new Date().toISOString(),
        ':name': assetId,
        ':status': 'uploaded',
      }),
    });
    await dynamoClient.send(command);
    console.log(`Successfully recorded asset upload for asset ${assetId}`);
  } catch (error) {
    console.error(`Failed to record asset upload for key ${key}:`, error);
    throw error;
  }
};
