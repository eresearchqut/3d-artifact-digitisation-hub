import { S3Event, Context, S3Handler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
});

export const handler: S3Handler = async (event: S3Event, context: Context): Promise<void> => {
  console.log(`Received event: ${JSON.stringify(event)}`);

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const eTag = record.s3.object.eTag;
    
    // Key format expected: assets/{asset_id}.ext
    const parts = key.split('/');
    if (parts.length < 2 || parts[0] !== 'assets') {
      console.warn(`Skipping key ${key}: Does not contain an assets prefix`);
      continue;
    }

    const filename = parts[1];
    const assetId = filename.split('.')[0];

    const item = {
      PK: `ASSET#${assetId}`,
      SK: `ASSET#${assetId}`,
      bucket,
      key,
      name: filename,
      uploadedAt: new Date().toISOString(),
    };

    try {
      const command = new PutItemCommand({
        TableName: process.env.DYNAMODB_TABLE || '3d-hub-assets',
        Item: marshall(item, { removeUndefinedValues: true }),
      });
      await dynamoClient.send(command);
      console.log(`Successfully recorded asset upload for asset ${assetId}`);
    } catch (error) {
      console.error(`Failed to record asset upload for key ${key}:`, error);
      throw error;
    }
  }
};
