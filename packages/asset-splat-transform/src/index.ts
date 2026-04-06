import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { Readable } from 'stream';

const execAsync = promisify(exec);

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

    const tmpDir = await fsPromises.mkdtemp('/tmp/splat-transform-');
    const inputFilePath = path.join(tmpDir, `${assetId}${ext}`);
    const outputDir = path.join(tmpDir, 'viewer');
    await fsPromises.mkdir(outputDir, { recursive: true });
    const outputHtmlPath = path.join(outputDir, 'index.html');

    try {
        console.log(`Downloading s3://${bucket}/${key} to ${inputFilePath}`);
        const getObj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = getObj.Body as Readable;

        await new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(inputFilePath);
            body.pipe(fileStream);
            body.on('error', reject);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        console.log(`Converting ${inputFilePath} to HTML viewer at ${outputHtmlPath}`);
        const { stdout, stderr } = await execAsync(`npx splat-transform -U "${inputFilePath}" "${outputHtmlPath}"`);
        if (stdout) console.log(`splat-transform stdout: ${stdout}`);
        if (stderr) console.error(`splat-transform stderr: ${stderr}`);

        const files = await fsPromises.readdir(outputDir);
        console.log(`Uploading generated files to s3://${bucket}/viewer/${assetId}/`);

        for (const file of files) {
            const filePath = path.join(outputDir, file);
            let contentType = mime.lookup(filePath);
            if (!contentType) {
                if (file.endsWith('.sog')) contentType = 'application/octet-stream';
                else contentType = 'application/octet-stream';
            }

            const fileData = await fsPromises.readFile(filePath);
            const uploadKey = `viewer/${assetId}/${file}`;

            await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: uploadKey,
                Body: fileData,
                ContentType: contentType
            }));
            console.log(`Uploaded ${uploadKey} (${contentType})`);
        }

        console.log(`Successfully converted and uploaded viewer for asset ${assetId}`);
    } finally {
        try {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.error(`Failed to clean up temp directory ${tmpDir}`, cleanupErr);
        }
    }
}
