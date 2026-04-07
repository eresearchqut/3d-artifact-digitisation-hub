import { S3Client, CreateBucketCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

// Minimal valid PLY file for splat-transform
const MINIMAL_PLY = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
property float nx
property float ny
property float nz
property float f_dc_0
property float f_dc_1
property float f_dc_2
property float opacity
property float scale_0
property float scale_1
property float scale_2
property float rot_0
property float rot_1
property float rot_2
property float rot_3
end_header
0 0 0 0 0 0 0 0 0 1 1 1 1 1 0 0 0
`;

describe('asset-splat-transform integration test', () => {
    let container: StartedLocalStackContainer;
    let s3Client: S3Client;
    let handler: any;
    const bucketName = 'test-bucket';

    beforeAll(async () => {
        // Start LocalStack container with S3 service
        container = await new LocalstackContainer('localstack/localstack:4.14')
            .withEnvironment({ SERVICES: 's3' })
            .start();

        const endpoint = container.getConnectionUri();
        
        // Setup S3 Client pointing to LocalStack
        s3Client = new S3Client({
            endpoint,
            region: 'us-east-1',
            credentials: {
                accessKeyId: 'test',
                secretAccessKey: 'test',
            },
            forcePathStyle: true,
        });

        // Set env vars used by handler
        process.env.S3_ENDPOINT = endpoint;
        process.env.AWS_REGION = 'us-east-1';
        process.env.AWS_ACCESS_KEY_ID = 'test';
        process.env.AWS_SECRET_ACCESS_KEY = 'test';

        // Create the test bucket
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));

        // Dynamically import handler AFTER env vars are set
        handler = (await import('./index')).handler;
    }, 60000);

    afterAll(async () => {
        if (container) {
            await container.stop();
        }
        delete process.env.S3_ENDPOINT;
        delete process.env.AWS_REGION;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
    });

    it('should process a valid PLY file and output splat/html files', async () => {
        const assetId = 'test-asset-123';
        const testKey = `assets/${assetId}/model.ply`;

        // Upload a dummy PLY file
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: testKey,
            Body: Buffer.from(MINIMAL_PLY),
            Metadata: {
                name: 'model.ply'
            }
        }));

        // Construct mock S3 Event
        const event = {
            Records: [
                {
                    s3: {
                        bucket: { name: bucketName },
                        object: { key: encodeURIComponent(testKey) }
                    }
                }
            ]
        } as any;

        // Run the handler
        await handler(event, {} as any, () => {});

        // Check the generated outputs
        const listResponse = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: `viewer/${assetId}/`
        }));

        const uploadedKeys = listResponse.Contents?.map(c => c.Key) || [];
        
        // At least index.html should be created and uploaded
        expect(uploadedKeys.length).toBeGreaterThan(0);
        expect(uploadedKeys.some(k => k?.endsWith('index.html'))).toBe(true);
    }, 30000);
});
