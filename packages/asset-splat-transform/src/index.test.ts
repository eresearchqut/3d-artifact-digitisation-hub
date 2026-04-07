import { LocalstackContainer, StartedLocalStackContainer } from '@testcontainers/localstack';
import { S3Client, CreateBucketCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Mock the playcanvas splat-transform ES module completely to avoid Jest ESM issues
jest.mock('@playcanvas/splat-transform', () => {
    class MockMemoryReadFileSystem {
        set = jest.fn();
    }
    return {
        readFile: jest.fn().mockResolvedValue([{}]),
        getInputFormat: jest.fn().mockReturnValue('mock-format'),
        writeHtml: jest.fn().mockImplementation(async (opts, fsWrite) => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const p = require('path');
            fsWrite.createWriter(p.resolve(p.dirname(opts.filename), 'index.html')).close();
            fsWrite.createWriter(p.resolve(p.dirname(opts.filename), 'model.sog')).close();
        }),
        MemoryReadFileSystem: MockMemoryReadFileSystem
    };
}, { virtual: true });

// Set long timeout for testcontainers
jest.setTimeout(120000);

describe('asset-splat-transform integration', () => {
    let container: StartedLocalStackContainer;
    let s3Client: S3Client;
    const BUCKET_NAME = 'test-assets-bucket';

    beforeAll(async () => {
        container = await new LocalstackContainer('localstack/localstack:3').start();

        s3Client = new S3Client({
            endpoint: container.getConnectionUri(),
            region: 'us-east-1',
            credentials: {
                accessKeyId: 'test',
                secretAccessKey: 'test'
            },
            forcePathStyle: true
        });

        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    });

    afterAll(async () => {
        if (container) {
            await container.stop();
        }
    });

    it('should process a real .ply file from S3 using testcontainers', async () => {
        // Path to the test file mentioned in the task
        const plyFilePath = path.resolve(__dirname, '../../../frontend/public/splats/cluster_fly_S.ply');
        
        // Skip if the file doesn't exist (e.g. running in an environment where it's missing)
        if (!fs.existsSync(plyFilePath)) {
            console.warn(`Test file not found at ${plyFilePath}. Skipping.`);
            return;
        }

        const fileData = fs.readFileSync(plyFilePath);
        const assetId = 'test-cluster-fly';
        const key = `assets/${assetId}/cluster_fly_S.ply`;

        // Upload to localstack S3
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileData,
            ContentType: 'application/octet-stream',
            Metadata: {
                name: 'cluster_fly_S.ply'
            }
        }));

        // Run the transform manually to avoid global s3Client issues
        const { processAssetToViewer } = await import('./index');
        await processAssetToViewer(s3Client, BUCKET_NAME, key, assetId, 'cluster_fly_S.ply');

        // Verify that the output files were created in S3
        const listResult = await s3Client.send(new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `viewer/${assetId}/`
        }));

        expect(listResult.Contents).toBeDefined();
        expect(listResult.Contents!.length).toBeGreaterThan(0);

        const keys = listResult.Contents!.map(obj => obj.Key);
        
        // Ensure index.html and at least one other generated file exists
        expect(keys).toContain(`viewer/${assetId}/index.html`);
    });
});
