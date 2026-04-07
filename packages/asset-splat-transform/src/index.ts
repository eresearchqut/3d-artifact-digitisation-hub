import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import * as mime from 'mime-types';
import { S3Event, S3Handler } from 'aws-lambda';
import {
    readFile,
    getInputFormat,
    writeHtml,
    FileSystem,
    Writer,
    MemoryReadFileSystem,
    WebPCodec
} from '@playcanvas/splat-transform';

// webp.wasm is co-located with this bundle; override the default path resolution
// which breaks when the dist bundle is not in the original package's dist/ directory
WebPCodec.wasmUrl = new URL('webp.wasm', import.meta.url).href;

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT
});

export const handler: S3Handler = async (event: S3Event): Promise<void> => {
    console.log(`Received S3 event for transform: ${JSON.stringify(event)}`);

    for (const record of event.Records) {
        const { s3: { bucket: { name: bucketName }, object: {key: objectKey}} } = record;
        const key = decodeURIComponent(objectKey.replace(/\+/g, ' '));
        
        const parts = key.split('/');
        if (parts.length < 2 || parts[0] !== 'assets') {
            console.warn(`Skipping key ${key}: Does not contain an assets prefix`);
            continue;
        }

        const assetId = parts[1];
        let originalFilename = assetId;

        try {
            const headObj = await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
            if (headObj.Metadata && headObj.Metadata['name']) {
                originalFilename = headObj.Metadata['name'];
            }
        } catch {
            console.warn(`Could not retrieve metadata for ${key} to determine original filename, using assetId as filename fallback`);
        }

        try {
            await processAssetToViewer(s3Client, bucketName, key, assetId, originalFilename);
        } catch (error) {
            console.error(`Failed to transform asset ${assetId}:`, error);
        }
    }
};

export async function processAssetToViewer(
    s3Client: S3Client,
    bucket: string,
    key: string,
    assetId: string,
    originalFilename: string
): Promise<void> {
    // Determine file extension for splat-transform input guessing
    let ext = path.extname(originalFilename).toLowerCase();
    if (!ext || !['.ply', '.splat', '.spz'].includes(ext)) {
        ext = '.ply'; // fallback
    }

    const inputFileName = path.resolve(`${assetId}${ext}`);

    try {
        console.log(`Downloading s3://${bucket}/${key} to memory...`);
        const getObj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bodyBuffer = await getObj.Body?.transformToByteArray();
        if (!bodyBuffer) throw new Error('Empty S3 object body');

        console.log(`Parsing ${inputFileName} in memory...`);
        const fsRead = new MemoryReadFileSystem();
        fsRead.set(inputFileName, bodyBuffer);

        const tables = await readFile({
            filename: inputFileName,
            inputFormat: getInputFormat(inputFileName),
            options: {
                iterations: 3,
                lodSelect: [],
                unbundled: true,
                lodChunkCount: 0,
                lodChunkExtent: 0
            },
            params: [],
            fileSystem: fsRead
        });

        if (!tables || tables.length === 0) {
            throw new Error('No data table returned from readFile');
        }

        console.log(`Converting to HTML viewer on disk...`);
        const outDir = path.resolve(`/tmp/viewer/${assetId}`);
        await fsPromises.mkdir(outDir, { recursive: true });
        
        const fsWrite = new NodeFileSystem();
        const htmlFileName = path.resolve(outDir, 'index.html');
        await writeHtml({
            filename: htmlFileName,
            dataTable: tables[0],
            bundle: false,
            iterations: 3
        }, fsWrite);

        console.log(`Uploading generated files to s3://${bucket}/viewer/${assetId}/`);

        for (const file of fsWrite.results) {
            let contentType = mime.lookup(file);
            if (!contentType) {
                if (file.endsWith('.sog')) contentType = 'application/octet-stream';
                else contentType = 'application/octet-stream';
            }

            const relativePath = path.relative(outDir, file);
            const uploadKey = `viewer/${assetId}/${relativePath}`;
            const fileData = await fsPromises.readFile(file);

            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: uploadKey,
                Body: fileData,
                ContentType: contentType
            }));
            console.log(`Uploaded ${uploadKey} (${contentType})`);
        }

        console.log(`Successfully converted and uploaded viewer for asset ${assetId}`);
    } catch (error) {
        console.error(`Failed to process asset ${assetId}:`, error);
        throw error;
    }
}

import * as fsSync from 'fs';
import * as fsPromises from 'fs/promises';

class NodeFileSystem implements FileSystem {
    public results = new Set<string>();

    createWriter(filename: string): Writer {
        const fullPath = path.resolve(filename);
        const fd = fsSync.openSync(fullPath, 'w');
        this.results.add(fullPath);

        return {
            write: (data: Uint8Array) => {
                fsSync.writeSync(fd, data);
            },
            close: () => {
                fsSync.closeSync(fd);
            }
        };
    }

    async mkdir(dir: string): Promise<void> {
        await fsPromises.mkdir(path.resolve(dir), { recursive: true });
    }
}