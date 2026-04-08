import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import * as mime from 'mime-types';
import { Context, EventBridgeEvent, Handler } from 'aws-lambda';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { Logger } from '@aws-lambda-powertools/logger';
import {
    readFile,
    getInputFormat,
    writeHtml,
    processDataTable,
    FileSystem,
    Writer,
    MemoryReadFileSystem,
    WebPCodec,
    logger as splatLogger
} from '@playcanvas/splat-transform';
import type { ProcessAction } from '@playcanvas/splat-transform';

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

const logger = new Logger({ serviceName: 'asset-splat-transform' });

// Bridge splat-transform's internal logger to the powertools logger so all
// library progress messages (e.g. "Writing positions", "Generating morton order")
// appear as structured JSON in CloudWatch under the same invocation context.
splatLogger.setLogger({
    log: (...args: any[]) => logger.info(args.join(' ')),
    warn: (...args: any[]) => logger.warn(args.join(' ')),
    error: (...args: any[]) => logger.error(args.join(' ')),
    debug: (...args: any[]) => logger.debug(args.join(' ')),
    output: (text: string) => logger.info(text),
    onProgress: (node) => {
        const name = node.stepName ? ` [${node.stepName}]` : '';
        logger.debug(`Progress${name}`, {
            step: node.step,
            totalSteps: node.totalSteps,
            depth: node.depth,
        });
    },
});

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
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

export const handler: Handler<S3ObjectCreatedEvent> = async (event: S3ObjectCreatedEvent, context: Context): Promise<void> => {
    logger.addContext(context);
    logger.info('Received S3 event for transform', { event });

    const bucketName = event.detail.bucket.name;
    const key = event.detail.object.key;

    const parts = key.split('/');
    if (parts.length < 2 || parts[0] !== 'assets') {
        logger.warn('Skipping key: does not contain an assets prefix', { key });
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
        logger.warn('Could not retrieve object metadata; falling back to assetId as filename', { key, assetId });
    }

    try {
        await processAssetToViewer(s3Client, bucketName, key, assetId, originalFilename);
    } catch (error) {
        logger.error('Failed to transform asset', { assetId, error });
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
        logger.info('Downloading asset from S3 to memory', { bucket, key });
        const getObj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bodyBuffer = await getObj.Body?.transformToByteArray();
        if (!bodyBuffer) throw new Error('Empty S3 object body');

        logger.info('Parsing splat file in memory', { inputFileName });
        const fsRead = new MemoryReadFileSystem();
        fsRead.set(inputFileName, bodyBuffer);

        const tables = await readFile({
            filename: inputFileName,
            inputFormat: getInputFormat(inputFileName),
            options: {
                iterations: 0,
                lodSelect: [],
                unbundled: false,
                lodChunkCount: 0,
                lodChunkExtent: 0
            },
            params: [],
            fileSystem: fsRead
        });

        if (!tables || tables.length === 0) {
            throw new Error('No data table returned from readFile');
        }

        // Optimise for speed over quality.
        // filterBands:0 is the biggest win — it removes all SH coefficient columns,
        // cutting the number of WebP texture writes from ~8 down to 2-3.
        const actions: ProcessAction[] = [
            { kind: 'filterNaN' },
            { kind: 'filterBands', value: 0 },
        ];

        const maxGaussians = process.env.SPLAT_MAX_GAUSSIANS
            ? parseInt(process.env.SPLAT_MAX_GAUSSIANS, 10)
            : null;
        if (maxGaussians !== null && tables[0].numRows > maxGaussians) {
            logger.info('Decimating Gaussians', { from: tables[0].numRows, to: maxGaussians });
            actions.push({ kind: 'decimate', count: maxGaussians, percent: null });
        }

        const dataTable = processDataTable(tables[0], actions);
        logger.info('Processing Gaussians', { count: dataTable.numRows });

        const s3Prefix = `viewer/${assetId}`;
        // outDir is a virtual base path used only for computing relative S3 keys —
        // nothing is written to disk with S3FileSystem.
        const outDir = `/tmp/viewer/${assetId}`;
        const fsWrite = new S3FileSystem(s3Client, bucket, s3Prefix, outDir);

        logger.info('Converting to HTML viewer and streaming to S3', { bucket, prefix: s3Prefix });
        const htmlFileName = path.resolve(outDir, 'index.html');
        await writeHtml({
            filename: htmlFileName,
            dataTable,
            bundle: false,
            iterations: 0
        }, fsWrite);

        // Writer.close() is synchronous so S3 uploads are kicked off during writeHtml.
        // Wait for all of them to complete before returning.
        await fsWrite.flush();

        logger.info('Successfully converted and uploaded viewer', { assetId });
    } catch (error) {
        logger.error('Failed to process asset', { assetId, error });
        throw error;
    }
}

/**
 * S3-backed FileSystem implementation for @playcanvas/splat-transform.
 *
 * Writer.write() and Writer.close() are synchronous, so we buffer each file's
 * chunks in memory and kick off an async S3 PutObject from close(). Call
 * flush() after writeHtml() to await all in-flight uploads.
 *
 * This avoids writing to Lambda's /tmp entirely, removing the 512 MB disk
 * limit for large splat files.
 */
class S3FileSystem implements FileSystem {
    private readonly s3Client: S3Client;
    private readonly bucket: string;
    private readonly prefix: string;
    private readonly baseDir: string;
    private readonly pendingUploads: Promise<void>[] = [];

    constructor(
        s3Client: S3Client,
        bucket: string,
        prefix: string,
        baseDir: string,
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
        this.prefix = prefix;
        this.baseDir = baseDir;
    }

    createWriter(filename: string): Writer {
        const fullPath = path.resolve(filename);
        const relativePath = path.relative(path.resolve(this.baseDir), fullPath);
        const s3Key = `${this.prefix}/${relativePath}`;
        const contentType =
            (mime.lookup(filename) as string | false) || 'application/octet-stream';
        const chunks: Uint8Array[] = [];

        return {
            write: (data: Uint8Array) => {
                // Copy the slice — the caller may reuse the underlying buffer
                chunks.push(new Uint8Array(data));
            },
            close: () => {
                const upload = (async () => {
                    const totalLength = chunks.reduce((n, c) => n + c.length, 0);
                    const body = Buffer.allocUnsafe(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        body.set(chunk, offset);
                        offset += chunk.length;
                    }
                    await this.s3Client.send(
                        new PutObjectCommand({
                            Bucket: this.bucket,
                            Key: s3Key,
                            Body: body,
                            ContentType: contentType,
                        }),
                    );
                    logger.info('Uploaded viewer file to S3', { s3Key, contentType, bytes: totalLength });
                })();
                this.pendingUploads.push(upload);
            },
        };
    }

    // S3 uses key prefixes — no real directories to create.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async mkdir(_dir: string): Promise<void> {}

    /** Resolves once all S3 uploads kicked off by close() have completed. */
    async flush(): Promise<void> {
        await Promise.all(this.pendingUploads);
    }
}