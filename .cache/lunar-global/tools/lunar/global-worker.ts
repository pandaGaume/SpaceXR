import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createHeightGrid, encodeTerrariumGrid } from "@spacexr/dem";
import { atomicWrite, sha256, storagePath, writeJson } from "./storage";
import { borderHashes, globalTilePixels, type IGlobalFile, type ILolaPixels, type ILunarColourPixels } from "./global-kernel";
import type { IGlobalWorkerData, IGlobalRow } from "./global";

/** A worker shares read-only source arrays, generates one row, then commits a resumable receipt. */
const input = workerData as IGlobalWorkerData;
const rasters = new Map<number, ILolaPixels>(input.dems.map(dem => [dem.ppd, { ...dem, values: new Int16Array(dem.buffer) }]));
const colours = new Map<number, ILunarColourPixels>(input.colours.map(image => [image.width, { ...image, values: new Uint8Array(image.buffer) }]));
sharp.concurrency(1);

async function buildRow(row: IGlobalRow): Promise<IGlobalFile[]> {
    const receiptPath = storagePath(input.root, `${input.prefix}/.rows/${row.lod}/${row.face}/${row.y}.json`);
    try {
        const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as { revision: string; files: IGlobalFile[] };
        if (receipt.revision === input.revision && receipt.files.length === 2 * 2 ** row.lod) {
            let valid = true;
            for (const file of receipt.files) {
                const bytes = await readFile(storagePath(input.root, `${input.prefix}/${file.path}`));
                if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) { valid = false; break; }
            }
            if (valid) return receipt.files;
        }
    } catch (error) {
        if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const files: IGlobalFile[] = [];
    for (let x = 0; x < 2 ** row.lod; x++) {
        const address = { face: row.face, lod: row.lod, x, y: row.y };
        const { heights, rgb } = globalTilePixels(address, rasters, colours, input.radii);
        const rgba = encodeTerrariumGrid(createHeightGrid(257, 257, heights));
        let minHeight = Infinity, maxHeight = -Infinity;
        for (const h of heights) { minHeight = Math.min(minHeight, h); maxHeight = Math.max(maxHeight, h); }
        const outputs = [
            { kind: "elevation" as const, extension: "png", pixels: rgba.data, channels: 4 as const,
                bytes: await sharp(rgba.data, { raw: { width: 257, height: 257, channels: 4 } }).png({ compressionLevel: 4 }).toBuffer() },
            { kind: "imagery" as const, extension: "webp", pixels: rgb, channels: 3 as const,
                bytes: await sharp(rgb, { raw: { width: 257, height: 257, channels: 3 } }).webp({ lossless: true, effort: 0 }).toBuffer() },
        ];
        for (const output of outputs) {
            const path = `${output.kind}/${row.face}/${row.lod}/${x}/${row.y}.${output.extension}`;
            await atomicWrite(storagePath(input.root, `${input.prefix}/${path}`), output.bytes);
            files.push({ kind: output.kind, address, path, bytes: output.bytes.length, sha256: sha256(output.bytes),
                borders: borderHashes(output.pixels, output.channels),
                ...(output.kind === "elevation" ? { minHeight, maxHeight } : {}) });
        }
    }
    await writeJson(receiptPath, { revision: input.revision, files });
    return files;
}

parentPort!.on("message", (row: IGlobalRow) => {
    buildRow(row).then(files => parentPort!.postMessage({ type: "row", files }), error => {
        parentPort!.postMessage({ type: "failure", message: error instanceof Error ? error.stack : String(error) });
    });
});
parentPort!.postMessage({ type: "ready" });
