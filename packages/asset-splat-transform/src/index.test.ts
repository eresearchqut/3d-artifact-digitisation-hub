import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { processAssetToViewer } from './index';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { PassThrough } from 'stream';

jest.mock('fs/promises');
jest.mock('fs');
jest.mock('child_process');

const s3Mock = mockClient(S3Client);

describe('processAssetToViewer', () => {
    beforeEach(() => {
        s3Mock.reset();
        jest.clearAllMocks();
    });

    it('should process asset successfully', async () => {
        const bucket = 'test-bucket';
        const key = 'uploads/test.ply';
        const assetId = '12345';
        const originalFilename = 'test.ply';

        const tmpDir = '/tmp/mock-dir';
        
        // Mock fsPromises
        (fsPromises.mkdtemp as jest.Mock).mockResolvedValue(tmpDir);
        (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fsPromises.readdir as jest.Mock).mockResolvedValue(['index.html', 'model.sog']);
        (fsPromises.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock-data'));
        (fsPromises.rm as jest.Mock).mockResolvedValue(undefined);

        // Mock S3 GetObject stream
        const mockStream = new PassThrough();
        s3Mock.on(GetObjectCommand).resolves({
            Body: mockStream as any,
        });

        // Mock write stream
        const mockWriteStream = new PassThrough();
        (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

        // Mock child_process exec
        (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
            if (cb) cb(null, { stdout: 'mock stdout', stderr: '' });
        });

        const s3Client = new S3Client({});

        // We need to simulate the stream finishing
        const processPromise = processAssetToViewer(s3Client, bucket, key, assetId, originalFilename);
        
        // Emit finish after a short tick
        setTimeout(() => {
            mockWriteStream.emit('finish');
        }, 10);

        await processPromise;

        // Verify temp dir created
        expect(fsPromises.mkdtemp).toHaveBeenCalledWith('/tmp/splat-transform-');
        
        // Verify exec called with correct fallback extension or exact extension
        expect(child_process.exec).toHaveBeenCalled();
        const execCallArg = (child_process.exec as unknown as jest.Mock).mock.calls[0][0];
        expect(execCallArg).toContain('npx splat-transform -U');
        expect(execCallArg).toContain(`${assetId}.ply`);

        // Verify uploads
        const putCalls = s3Mock.commandCalls(PutObjectCommand);
        expect(putCalls.length).toBe(2);
        
        const uploadedKeys = putCalls.map(c => c.args[0].input.Key);
        expect(uploadedKeys).toContain(`viewer/${assetId}/index.html`);
        expect(uploadedKeys).toContain(`viewer/${assetId}/model.sog`);
        
        // Cleanup
        expect(fsPromises.rm).toHaveBeenCalledWith(tmpDir, { recursive: true, force: true });
    });

    it('should handle missing extension gracefully by defaulting to .ply', async () => {
        const bucket = 'test-bucket';
        const key = 'uploads/test_file';
        const assetId = '67890';
        const originalFilename = 'test_file';

        const tmpDir = '/tmp/mock-dir';
        
        (fsPromises.mkdtemp as jest.Mock).mockResolvedValue(tmpDir);
        (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fsPromises.readdir as jest.Mock).mockResolvedValue([]);
        (fsPromises.rm as jest.Mock).mockResolvedValue(undefined);

        const mockStream = new PassThrough();
        s3Mock.on(GetObjectCommand).resolves({ Body: mockStream as any });

        const mockWriteStream = new PassThrough();
        (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

        (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
            if (cb) cb(null, { stdout: '', stderr: '' });
        });

        const s3Client = new S3Client({});
        const processPromise = processAssetToViewer(s3Client, bucket, key, assetId, originalFilename);
        
        setTimeout(() => mockWriteStream.emit('finish'), 10);
        await processPromise;

        const execCallArg = (child_process.exec as unknown as jest.Mock).mock.calls[0][0];
        expect(execCallArg).toContain(`${assetId}.ply`); // fallback
    });

    it('should catch cleanup errors without failing the process', async () => {
        const bucket = 'test-bucket';
        const key = 'uploads/test.splat';
        const assetId = 'abc';
        const originalFilename = 'test.splat';

        const tmpDir = '/tmp/mock-dir';
        
        (fsPromises.mkdtemp as jest.Mock).mockResolvedValue(tmpDir);
        (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fsPromises.readdir as jest.Mock).mockResolvedValue([]);
        // Force cleanup error
        (fsPromises.rm as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

        const mockStream = new PassThrough();
        s3Mock.on(GetObjectCommand).resolves({ Body: mockStream as any });

        const mockWriteStream = new PassThrough();
        (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

        (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
            if (cb) cb(null, { stdout: '', stderr: '' });
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const s3Client = new S3Client({});
        const processPromise = processAssetToViewer(s3Client, bucket, key, assetId, originalFilename);
        
        setTimeout(() => mockWriteStream.emit('finish'), 10);
        await processPromise; // Should not throw

        expect(consoleErrorSpy).toHaveBeenCalledWith(`Failed to clean up temp directory ${tmpDir}`, expect.any(Error));
        
        consoleErrorSpy.mockRestore();
    });
});
