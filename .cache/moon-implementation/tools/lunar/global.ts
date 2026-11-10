import { open, stat } from "node:fs/promises";
import { endianness, availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import sharp from "sharp";
import type { ICelestialDataset } from "@spacexr/tiles/cube";
import { configuration } from "./pilot";
import { hashFile, initializeStorage, sha256, storagePath, withImportLock, writeJson } from "./storage";
import { prepareGlobalSources, type IGlobalSourceReceipt } from "./global-sources";
import { globalFileKey, verifyGlobalBorders, type IGlobalFile } from "./global-kernel";

/** Shared immutable source memory prevents a full copy of multi-gigabyte inputs per worker. */
export interface IGlobalWorkerData {
    root: string;
    prefix: string;
    revision: string;
    radii: [number, number, number];
    dems: { ppd: number; width: number; height: number; north: number; south: number; buffer: SharedArrayBuffer }[];
    colours: { width: number; height: number; buffer: SharedArrayBuffer }[];
}
/** Scheduling unit and resumable checkpoint: all x columns at one face, level and row. */
export interface IGlobalRow {
    face: number;
    lod: number;
    y: number;
}
/** Full output inventory. Only a completed, verified inventory can be published locally. */
export interface IGlobalManifest {
    schema: "lunar-global/1";
    revision: string;
    status: "verified";
    maxLOD: number;
    tileSize: 256;
    frame: string;
    referenceRadii: [number, number, number];
    createdAt: string;
    sources: IGlobalSourceReceipt[];
    files: IGlobalFile[];
    sharedBordersVerified: number;
    bytes: number;
    refinements?: Array<{
        id: string;
        revision: string;
        minLOD: number;
        maxLOD: number;
        tileCount: number;
        bytes: number;
    }>;
}

/** Six complete quadtrees, including every parent level. */
export function globalTileCount(maxLOD: number): number {
    if (!Number.isInteger(maxLOD) || maxLOD < 0 || maxLOD > 6) throw new Error("Global maximum level must be 0..6");
    return 2 * (4 ** (maxLOD + 1) - 1);
}

/** Read source bytes straight into shared storage, without a second giant Buffer allocation. */
async function readShared(file: string): Promise<SharedArrayBuffer> {
    const size = (await stat(file)).size,
        shared = new SharedArrayBuffer(size),
        view = new Uint8Array(shared);
    const handle = await open(file, "r");
    try {
        let offset = 0;
        while (offset < size) {
            const result = await handle.read(view, offset, Math.min(16 * 1024 ** 2, size - offset), offset);
            if (!result.bytesRead) throw new Error("Unexpected end of source file");
            offset += result.bytesRead;
        }
    } finally {
        await handle.close();
    }
    return shared;
}

async function sharedSources(
    root: string,
    sources: IGlobalSourceReceipt[],
): Promise<Pick<IGlobalWorkerData, "dems" | "colours">> {
    if (endianness() !== "LE") throw new Error("The PDS shared-memory loader requires a little-endian host");
    const dems: IGlobalWorkerData["dems"] = [];
    for (const receipt of sources.filter((s) => s.grid)) {
        const grid = receipt.grid!,
            buffer = await readShared(storagePath(root, receipt.file)),
            pixels = new Int16Array(buffer);
        let north = 0,
            south = 0;
        for (let x = 0; x < grid.width; x++) {
            north += pixels[x]! * grid.scale;
            south += pixels[(grid.height - 1) * grid.width + x]! * grid.scale;
        }
        dems.push({
            ppd: grid.ppd,
            width: grid.width,
            height: grid.height,
            north: north / grid.width,
            south: south / grid.width,
            buffer,
        });
    }
    const colour = sources.find((s) => !s.grid)!;
    const file = storagePath(root, colour.file),
        metadata = await sharp(file).metadata();
    if (metadata.width !== 16384 || metadata.height !== 8192 || metadata.channels !== 3 || metadata.depth !== "uchar")
        throw new Error("Unexpected NASA 16K colour atlas");
    const colours: IGlobalWorkerData["colours"] = [];
    for (const width of [1024, 2048, 4096, 8192, 16384]) {
        const bytes = await sharp(file)
            .resize(width, width / 2, { kernel: "lanczos3" })
            .removeAlpha()
            .raw()
            .toBuffer();
        const buffer = new SharedArrayBuffer(bytes.length);
        new Uint8Array(buffer).set(bytes);
        colours.push({ width, height: width / 2, buffer });
    }
    return { dems, colours };
}

/** Bounded worker pool. Source memory is shared, generated files are committed by row. */
async function generateRows(
    input: IGlobalWorkerData,
    maxLOD: number,
    workerCount: number,
    progress: (completed: number, files: number) => void,
): Promise<IGlobalFile[]> {
    const rows: IGlobalRow[] = [];
    for (let lod = 0; lod <= maxLOD; lod++)
        for (let face = 0; face < 6; face++) for (let y = 0; y < 2 ** lod; y++) rows.push({ face, lod, y });
    const workers: Worker[] = [],
        files: IGlobalFile[] = [];
    let next = 0,
        completed = 0;
    try {
        return await new Promise<IGlobalFile[]>((accept, reject) => {
            for (let i = 0; i < Math.min(workerCount, rows.length); i++) {
                const worker = new Worker(new URL("./global-worker.mjs", import.meta.url), {
                    workerData: input,
                    execArgv: [],
                });
                workers.push(worker);
                worker.on("error", reject);
                worker.on("exit", (code) => {
                    if (code && completed < rows.length) reject(new Error(`Global worker exited with ${code}`));
                });
                worker.on("message", (message: { type: string; files?: IGlobalFile[]; message?: string }) => {
                    if (message.type === "failure") {
                        reject(new Error(message.message));
                        return;
                    }
                    if (message.type === "row") {
                        files.push(...message.files!);
                        completed++;
                        progress(completed, files.length);
                        if (completed === rows.length) {
                            accept(files);
                            return;
                        }
                    }
                    if (next < rows.length) worker.postMessage(rows[next++]);
                });
            }
        });
    } finally {
        await Promise.all(workers.map((worker) => worker.terminate()));
    }
}

/** Check exact expected coverage and every file's bytes before making it available to a client. */
export async function verifyGlobalFiles(
    root: string,
    prefix: string,
    files: readonly IGlobalFile[],
    maxLOD: number,
    log: (s: string) => void = console.log,
): Promise<number> {
    const baseFiles = files.filter((file) => file.address.lod <= maxLOD);
    if (baseFiles.length !== globalTileCount(maxLOD) * 2) throw new Error("Incomplete global file count");
    const map = new Map(baseFiles.map((file) => [globalFileKey(file.kind, file.address), file]));
    for (let lod = 0; lod <= maxLOD; lod++)
        for (let face = 0; face < 6; face++)
            for (let y = 0; y < 2 ** lod; y++)
                for (let x = 0; x < 2 ** lod; x++)
                    for (const kind of ["elevation", "imagery"] as const)
                        if (!map.has(globalFileKey(kind, { face, lod, x, y })))
                            throw new Error("Global inventory has a coverage hole");
    const borders = verifyGlobalBorders(baseFiles);
    let verified = 0;
    for (const file of files) {
        const path = storagePath(root, `${prefix}/${file.path}`);
        if ((await stat(path)).size !== file.bytes || (await hashFile(path)) !== file.sha256)
            throw new Error(`Invalid generated global file: ${file.path}`);
        if (++verified % 4096 === 0) log(`Verify ${verified}/${files.length} files`);
    }
    return borders;
}

/** Generate complete imagery and DEM pyramids on disk. No public cloud resources are touched. */
export async function buildGlobalMoon(
    root: string,
    maxLOD = 6,
    workerCount = Math.min(8, availableParallelism()),
    log: (s: string) => void = console.log,
): Promise<IGlobalManifest> {
    const tileCount = globalTileCount(maxLOD);
    if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 16)
        throw new Error("Worker count must be 1..16");
    await initializeStorage(root, 25 * 1024 ** 3);
    return withImportLock(root, async () => {
        const statusFile = storagePath(root, "reports/global-progress.json");
        const startedAt = new Date().toISOString();
        await writeJson(statusFile, { phase: "import", startedAt, targetFiles: tileCount * 2 });
        try {
            const sources = await prepareGlobalSources(root, log),
                config = await configuration(root);
            const revision = sha256(
                Buffer.from(
                    JSON.stringify({ algorithm: "global-moon-v1", sources, radii: config.referenceRadii, maxLOD }),
                ),
            ).slice(0, 20);
            const prefix = `datasets/moon/global-${revision}`;
            log(`Global revision ${revision}: ${tileCount} DEM + ${tileCount} WebP, ${workerCount} workers`);
            await writeJson(statusFile, { phase: "load-sources", startedAt, revision, targetFiles: tileCount * 2 });
            const shared = await sharedSources(root, sources);
            let lastProgress = 0,
                pending = Promise.resolve();
            const files = await generateRows(
                { root, prefix, revision, radii: config.referenceRadii, ...shared },
                maxLOD,
                workerCount,
                (rows, count) => {
                    if (Date.now() - lastProgress > 3000 || count === tileCount * 2) {
                        lastProgress = Date.now();
                        log(
                            `Generate ${count}/${tileCount * 2} files (${((100 * count) / (tileCount * 2)).toFixed(1)}%)`,
                        );
                        pending = pending.then(() =>
                            writeJson(statusFile, {
                                phase: "generate",
                                startedAt,
                                revision,
                                rows,
                                completedFiles: count,
                                targetFiles: tileCount * 2,
                            }),
                        );
                    }
                },
            );
            await pending;
            await writeJson(statusFile, {
                phase: "verify",
                startedAt,
                revision,
                completedFiles: files.length,
                targetFiles: tileCount * 2,
            });
            const sharedBordersVerified = await verifyGlobalFiles(root, prefix, files, maxLOD, log);
            files.sort((a, b) => a.path.localeCompare(b.path));
            const manifest: IGlobalManifest = {
                schema: "lunar-global/1",
                revision,
                status: "verified",
                maxLOD,
                tileSize: 256,
                frame: "MOON_ME_DE421",
                referenceRadii: config.referenceRadii,
                createdAt: new Date().toISOString(),
                sources,
                files,
                sharedBordersVerified,
                bytes: files.reduce((sum, file) => sum + file.bytes, 0),
            };
            for (const content of ["elevation", "imagery"] as const) {
                const descriptor: ICelestialDataset = {
                    scheme: "spacexr-cube-equiangular/1",
                    body: "Moon",
                    frame: manifest.frame,
                    referenceRadii: manifest.referenceRadii,
                    content,
                    encoding: content === "elevation" ? "terrarium" : "webp",
                    tileSize: 256,
                    minLOD: 0,
                    maxLOD,
                    subtrees: [],
                    tiles: `./${content}/{face}/{z}/{x}/{y}.${content === "elevation" ? "png" : "webp"}`,
                };
                await writeJson(storagePath(root, `${prefix}/${content}.json`), descriptor);
            }
            await writeJson(storagePath(root, `${prefix}/manifest.json`), manifest);
            await writeJson(storagePath(root, "catalog/latest-global.json"), { directory: prefix, revision });
            await writeJson(statusFile, {
                phase: "complete",
                startedAt,
                completedAt: new Date().toISOString(),
                revision,
                completedFiles: files.length,
                targetFiles: files.length,
                bytes: manifest.bytes,
                sharedBordersVerified,
            });
            log(
                `Global Moon complete: ${files.length} files, ${(manifest.bytes / 1e9).toFixed(3)} GB, ${sharedBordersVerified} shared borders`,
            );
            return manifest;
        } catch (error) {
            await writeJson(statusFile, {
                phase: "failed",
                startedAt,
                message: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    });
}
