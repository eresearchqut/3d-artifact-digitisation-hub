import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import * as mime from 'mime-types';
import { EventBridgeEvent, Handler } from 'aws-lambda';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import {
    readFile,
    getInputFormat,
    writeHtml,
    FileSystem,
    Writer,
    MemoryReadFileSystem,
    WebPCodec
} from '@playcanvas/splat-transform';

// Resolve webp.wasm correctly in both contexts:
// - Lambda bundle: webp.wasm is co-located with index.mjs (copied by the build script)
// - Test/dev: running from src/index.ts, so resolve from the installed package instead
const _require = createRequire(import.meta.url);
const colocatedWasm = new URL('webp.wasm', import.meta.url);
if (existsSync(fileURLToPath(colocatedWasm))) {
    WebPCodec.wasmUrl = colocatedWasm.href;
} else {
    WebPCodec.wasmUrl = pathToFileURL(_require.resolve('@playcanvas/splat-transform/lib/webp.wasm')).href;
}

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT
});

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

export const handler: Handler<S3ObjectCreatedEvent> = async (event: S3ObjectCreatedEvent): Promise<void> => {
    console.log(`Received S3 event for transform: ${JSON.stringify(event)}`);

    const bucketName = event.detail.bucket.name;
    const key = event.detail.object.key;

    const parts = key.split('/');
    if (parts.length < 2 || parts[0] !== 'assets') {
        console.warn(`Skipping key ${key}: Does not contain an assets prefix`);
        return;
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