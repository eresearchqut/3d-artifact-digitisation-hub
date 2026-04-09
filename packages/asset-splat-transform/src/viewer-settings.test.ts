import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { readFile, getInputFormat, computeSummary, processDataTable, MemoryReadFileSystem } from '@playcanvas/splat-transform';
import { computeViewerSettings } from './index.js';

describe('computeViewerSettings', () => {
    const testFilePath = path.resolve('../../frontend/public/splats/cluster_fly_S.ply');

    it('returns valid framing settings for cluster_fly_S.ply', async () => {
        const buf = fs.readFileSync(testFilePath);
        const filename = path.resolve(testFilePath);
        const fsRead = new MemoryReadFileSystem();
        fsRead.set(filename, new Uint8Array(buf));

        const tables = await readFile({
            filename,
            inputFormat: getInputFormat(filename),
            options: { iterations: 0, lodSelect: [], unbundled: false, lodChunkCount: 0, lodChunkExtent: 0 },
            params: [],
            fileSystem: fsRead,
        });
        const dataTable = processDataTable(tables[0], [{ kind: 'filterNaN' }, { kind: 'filterBands', value: 0 }]);

        const settings = computeViewerSettings(dataTable);

        expect(settings).toBeDefined();
        expect(settings).toHaveProperty('camera');
        expect(settings).toHaveProperty('background');
        expect(settings).toHaveProperty('animTracks');

        const cam = settings!.camera as { position: number[]; target: number[] };
        const { position, target } = cam;

        // Must be 3-element numeric arrays with all finite values
        expect(position).toHaveLength(3);
        expect(target).toHaveLength(3);
        for (const v of [...position, ...target]) {
            expect(typeof v).toBe('number');
            expect(isFinite(v)).toBe(true);
        }

        // Camera must be displaced from target (non-degenerate)
        const separation = Math.sqrt(
            (position[0]-target[0])**2 +
            (position[1]-target[1])**2 +
            (position[2]-target[2])**2,
        );
        expect(separation).toBeGreaterThan(0.01);

        // Target should equal the AABB centre (the exact formula the frame button uses)
        const summary = computeSummary(dataTable);
        const xs = summary.columns['x'];
        const ys = summary.columns['y'];
        const zs = summary.columns['z'];
        const expectedTarget = [
            (xs.min + xs.max) / 2,
            (ys.min + ys.max) / 2,
            (zs.min + zs.max) / 2,
        ];
        for (let i = 0; i < 3; i++) {
            expect(target[i]).toBeCloseTo(expectedTarget[i], 5);
        }

        // background.color must be a numeric array
        const bg = settings!.background as { color: unknown[] };
        expect(Array.isArray(bg.color)).toBe(true);
        for (const v of bg.color) {
            expect(typeof v).toBe('number');
        }
    });
});
