import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { processAssetToViewer } from './index';

import * as path from 'path';

jest.mock('fs', () => ({
    openSync: jest.fn().mockReturnValue(1),
    writeSync: jest.fn(),
    closeSync: jest.fn()
}));

jest.mock('fs/promises', () => ({
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock file data'))
}));

// Mock the playcanvas splat-transform ES module completely
jest.mock('@playcanvas/splat-transform', () => {
    class MockMemoryReadFileSystem {
        set = jest.fn();
    }
    return {
        readFile: jest.fn().mockResolvedValue([{}]),
        getInputFormat: jest.fn().mockReturnValue('mock-format'),
        writeHtml: jest.fn().mockImplementation(async (opts, fsWrite) => {
            // simulate writing files via the provided FileSystem interface
            fsWrite.createWriter(path.resolve(path.dirname(opts.filename), 'index.html')).close();
            fsWrite.createWriter(path.resolve(path.dirname(opts.filename), 'model.sog')).close();
        }),
        MemoryReadFileSystem: MockMemoryReadFileSystem
    };
}, { virtual: true });

const s3Mock = mockClient(S3Client);

describe('processAssetToViewer', () => {
    beforeEach(() => {
        s3Mock.reset();
        jest.clearAllMocks();
    });

    it('should process asset successfully in memory', async () => {
        const bucket = 'test-bucket';
        const key = 'uploads/test.ply';
        const assetId = '12345';
        const originalFilename = 'test.ply';

        // Mock S3 GetObject to return a body with transformToByteArray
        s3Mock.on(GetObjectCommand).resolves({
            Body: {
                transformToByteArray: async () => new Uint8Array(Buffer.from('mock-splat-data'))
            } as any,
        });

        const s3Client = new S3Client({});
        await processAssetToViewer(s3Client, bucket, key, assetId, originalFilename);

        // Verify uploads
        const putCalls = s3Mock.commandCalls(PutObjectCommand);
        expect(putCalls.length).toBe(2);
        
        const uploadedKeys = putCalls.map(c => c.args[0].input.Key);
        expect(uploadedKeys).toContain(`viewer/${assetId}/index.html`);
        expect(uploadedKeys).toContain(`viewer/${assetId}/model.sog`);
    });

    it('should handle missing extension gracefully by defaulting to .ply', async () => {
        const bucket = 'test-bucket';
        const key = 'uploads/test_file';
        const assetId = '67890';
        const originalFilename = 'test_file';

        s3Mock.on(GetObjectCommand).resolves({
            Body: {
                transformToByteArray: async () => new Uint8Array(Buffer.from('mock-splat-data'))
            } as any,
        });

        const s3Client = new S3Client({});
        await processAssetToViewer(s3Client, bucket, key, assetId, originalFilename);

        const putCalls = s3Mock.commandCalls(PutObjectCommand);
        expect(putCalls.length).toBe(2);
    });

    it('should throw if S3 body is empty', async () => {
        const bucket = 'test-bucket';
        const key = 'uploads/test.splat';
        const assetId = 'abc';
        const originalFilename = 'test.splat';

        s3Mock.on(GetObjectCommand).resolves({
            Body: {
                transformToByteArray: async () => undefined // Simulate empty body
            } as any,
        });

        const s3Client = new S3Client({});
        
        await expect(processAssetToViewer(s3Client, bucket, key, assetId, originalFilename))
            .rejects.toThrow('Empty S3 object body');
    });
});
