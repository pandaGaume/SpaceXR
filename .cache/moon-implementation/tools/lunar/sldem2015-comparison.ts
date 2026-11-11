import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";
import { createHeightGrid, encodeTerrariumGrid } from "@spacexr/dem";
import { cubeTileDirection, ReferenceSurface } from "@spacexr/tiles/cube";
import { assertValidTileAddress, type ITileAddress } from "@spacexr/tiles/addressing";
import { rebaseRadialHeight } from "@spacexr/tiles/reprojection";
import { configuration } from "./pilot";
import { atomicWrite, sha256, storagePath, writeJson } from "./storage";
import { parsePdsLunarLabel } from "./global-sources";
import { sampleLolaMetres, type ILolaPixels } from "./global-kernel";
import { findSLDEMRegion, loadSLDEMRegion, type ISLDEMReceipt } from "./sldem2015";

const TILE_SIZE = 256;
const SOURCE_RADIUS = 1737400;
const EDGE_BLEND_DEGREES = 0.5;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
});

export type MoonHeightVariant = "lola" | "sldem2015" | "fused" | "delta";

interface ISLDEMCatalog {
    schema: "lunar-sldem2015-source/1";
    receipts: ISLDEMReceipt[];
}

interface ILolaSourceCatalog {
    receipts: Array<{ file: string; sha256: string }>;
}

let lolaPromise: Promise<ILolaPixels> | undefined;
type ILoadedSLDEMRaster = { values: Buffer; sha256: string };
const rasterCache = new Map<string, Promise<ILoadedSLDEMRaster>>();
let comparisonQueue: Promise<void> = Promise.resolve();

function smoothstep(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
}

async function loadLola(root: string): Promise<ILolaPixels> {
    if (!lolaPromise) {
        lolaPromise = (async () => {
            const label = await readFile(storagePath(root, "sources/moon/pds/LDEM_128.LBL"), "utf8");
            const grid = parsePdsLunarLabel(label, 128);
            const path = storagePath(root, "sources/moon/pds/LDEM_128.IMG");
            const buffer = await readFile(path);
            if (buffer.length !== grid.width * grid.height * 2) throw new Error("Invalid global LOLA source size.");
            const values = new Int16Array(buffer.buffer, buffer.byteOffset, grid.width * grid.height);
            let north = 0;
            let south = 0;
            for (let x = 0; x < grid.width; x++) {
                north += values[x]! * grid.scale;
                south += values[(grid.height - 1) * grid.width + x]! * grid.scale;
            }
            return {
                width: grid.width,
                height: grid.height,
                values,
                north: north / grid.width,
                south: south / grid.width,
            };
        })().catch((error) => {
            lolaPromise = undefined;
            throw error;
        });
    }
    return lolaPromise;
}

async function readRaster(root: string, receipt: ISLDEMReceipt): Promise<ILoadedSLDEMRaster> {
    const cached = rasterCache.get(receipt.id);
    if (cached) {
        rasterCache.delete(receipt.id);
        rasterCache.set(receipt.id, cached);
        return cached;
    }
    while (rasterCache.size >= 2) {
        const oldest = rasterCache.keys().next().value as string | undefined;
        if (!oldest) break;
        await rasterCache.get(oldest)?.catch(() => undefined);
        rasterCache.delete(oldest);
    }
    {
        const task = (async () => {
            const raster = await loadSLDEMRegion(root, receipt);
            if (raster.values.byteLength !== receipt.region.width * receipt.region.height * 4)
                throw new Error(`Invalid SLDEM2015 Float IMG size: ${receipt.id}`);
            return raster;
        })();
        rasterCache.set(receipt.id, task);
    }
    return rasterCache.get(receipt.id)!;
}

async function sampleSLDEM(
    root: string,
    receipts: readonly ISLDEMReceipt[],
    loaded: Map<string, { receipt: ISLDEMReceipt } & ILoadedSLDEMRaster>,
    longitude: number,
    latitude: number,
): Promise<number> {
    const ppd = 512;
    const lon = ((longitude % 360) + 360) % 360;
    const x = lon * ppd - 0.5;
    const y = (60 - latitude) * ppd - 0.5;
    const left = Math.floor(x);
    const top = Math.floor(y);
    const fx = x - left;
    const fy = y - top;
    let sum = 0;
    let weights = 0;
    for (const [dx, dy, weight] of [
        [0, 0, (1 - fx) * (1 - fy)],
        [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],
        [1, 1, fx * fy],
    ] as const) {
        if (weight === 0) continue;
        const sampleX = ((left + dx) % (360 * ppd) + 360 * ppd) % (360 * ppd);
        const sampleY = Math.max(0, Math.min(120 * ppd - 1, top + dy));
        const sampleLongitude = (sampleX + 0.5) / ppd;
        const sampleLatitude = 60 - (sampleY + 0.5) / ppd;
        const receipt = findSLDEMRegion(receipts, sampleLongitude, sampleLatitude);
        let raster = loaded.get(receipt.id);
        if (!raster) {
            raster = { receipt, ...(await readRaster(root, receipt)) };
            loaded.set(receipt.id, raster);
        }
        const region = receipt.region;
        const column = sampleX - region.longitudeStart * ppd;
        const row = sampleY - (60 - region.north) * ppd;
        const offset = (row * region.width + column) * 4;
        const sample = region.byteOrder === "BE" ? raster.values.readFloatBE(offset) : raster.values.readFloatLE(offset);
        if (!Number.isFinite(sample) || sample === region.missingValue) continue;
        const value = sample * region.scalingFactor + region.offset;
        sum += value * weight;
        weights += weight;
    }
    return weights > 0 ? sum / weights : Number.NaN;
}

function withPngText(png: Buffer, keyword: string, value: string): Buffer {
    if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Invalid PNG signature from the encoder.");
    const type = Buffer.from("iTXt", "ascii");
    const payload = Buffer.concat([
        Buffer.from(keyword, "latin1"),
        Buffer.from([0, 0, 0, 0, 0]),
        Buffer.from(value, "utf8"),
    ]);
    const crcInput = Buffer.concat([type, payload]);
    let crc = 0xffffffff;
    for (const byte of crcInput) crc = CRC_TABLE[(crc ^ byte) & 255]! ^ (crc >>> 8);
    const chunk = Buffer.allocUnsafe(12 + payload.length);
    chunk.writeUInt32BE(payload.length, 0);
    type.copy(chunk, 4);
    payload.copy(chunk, 8);
    chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + payload.length);
    let offset = 8;
    while (offset + 12 <= png.length) {
        const length = png.readUInt32BE(offset);
        if (png.toString("ascii", offset + 4, offset + 8) === "IDAT")
            return Buffer.concat([png.subarray(0, offset), chunk, png.subarray(offset)]);
        offset += 12 + length;
    }
    throw new Error("PNG encoder returned no image data chunk.");
}

/** Generate and cache a source-identified comparison DEM tile on its first request. */
async function generateComparisonTile(
    root: string,
    variant: MoonHeightVariant,
    address: ITileAddress,
): Promise<{ bytes: Buffer; minHeight: number; maxHeight: number; sha256: string }> {
    assertValidTileAddress(address);
    if (!Number.isInteger(address.lod) || address.lod < 0 || address.lod > 11) throw new RangeError("Comparison LOD must be 0..11.");
    const source = JSON.parse(await readFile(storagePath(root, "catalog/sldem2015-sources.json"), "utf8")) as ISLDEMCatalog;
    if (source.schema !== "lunar-sldem2015-source/1") throw new Error("SLDEM2015 source catalog is unavailable.");
    const lolaCatalog = JSON.parse(await readFile(storagePath(root, "catalog/global-sources.json"), "utf8")) as ILolaSourceCatalog;
    const lolaReceipt = lolaCatalog.receipts.find((item) => item.file === "sources/moon/pds/LDEM_128.IMG");
    if (!lolaReceipt) throw new Error("The native global LOLA comparison source is unavailable.");
    const revision = sha256(Buffer.from(JSON.stringify({
        algorithm: "sldem2015-comparison-v1",
        variant,
        lola: lolaReceipt.sha256,
        sourceLabels: source.receipts.map(({ id, floatLabelSha256, auxiliarySha256 }) => [id, floatLabelSha256, auxiliarySha256]),
    }))).slice(0, 20);
    const key = `cache/comparison/${revision}/${variant}/${address.face}/${address.lod}/${address.x}/${address.y}.png`;
    const file = storagePath(root, key);
    try {
        const bytes = await readFile(file);
        const receipt = JSON.parse(await readFile(`${file}.json`, "utf8")) as { bytes: number; sha256: string; minHeight: number; maxHeight: number };
        if (bytes.byteLength === receipt.bytes && sha256(bytes) === receipt.sha256)
            return { bytes, minHeight: receipt.minHeight, maxHeight: receipt.maxHeight, sha256: receipt.sha256 };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const config = await configuration(root);
    const reference = new ReferenceSurface(...config.referenceRadii);
    const fallback = await loadLola(root);
    const heights = new Float32Array((TILE_SIZE + 1) ** 2);
    const direction = { x: 0, y: 0, z: 0 };
    const regions = new Map<string, { receipt: ISLDEMReceipt } & ILoadedSLDEMRaster>();
    const usedSources = new Map<string, string>();
    for (let row = 0; row <= TILE_SIZE; row++) {
        for (let column = 0; column <= TILE_SIZE; column++) {
            cubeTileDirection(address, column / TILE_SIZE, row / TILE_SIZE, direction);
            const longitude = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
            const latitude = (Math.atan2(direction.z, Math.hypot(direction.x, direction.y)) * 180) / Math.PI;
            const fallbackHeight = rebaseRadialHeight(sampleLolaMetres(fallback, longitude, latitude), SOURCE_RADIUS, reference, direction);
            const index = row * (TILE_SIZE + 1) + column;
            if (variant === "lola" || (variant === "fused" && Math.abs(latitude) >= 60)) {
                heights[index] = fallbackHeight;
                continue;
            }
            if (Math.abs(latitude) > 60 && (variant === "sldem2015" || variant === "delta"))
                throw new RangeError(`${variant} is available only between 60°S and 60°N.`);
            const receipt = findSLDEMRegion(source.receipts, longitude, latitude);
            const sampledHeight = await sampleSLDEM(root, source.receipts, regions, longitude, latitude);
            if (!Number.isFinite(sampledHeight)) {
                if (variant === "fused") {
                    heights[index] = fallbackHeight;
                    continue;
                }
                throw new Error(`SLDEM2015 has no valid height near ${longitude.toFixed(4)}°, ${latitude.toFixed(4)}°.`);
            }
            const slDemHeight = rebaseRadialHeight(
                sampledHeight,
                SOURCE_RADIUS,
                reference,
                direction,
            );
            if (variant === "sldem2015") heights[index] = slDemHeight;
            else if (variant === "delta") heights[index] = slDemHeight - fallbackHeight;
            else {
                const blend = smoothstep((60 - Math.abs(latitude)) / EDGE_BLEND_DEGREES);
                heights[index] = fallbackHeight * (1 - blend) + slDemHeight * blend;
            }
        }
    }
    for (const [id, raster] of regions) usedSources.set(id, raster.sha256);
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    for (const height of heights) {
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
    }
    const rgba = encodeTerrariumGrid(createHeightGrid(TILE_SIZE + 1, TILE_SIZE + 1, heights));
    const png = await sharp(rgba.data, { raw: { width: TILE_SIZE + 1, height: TILE_SIZE + 1, channels: 4 } })
        .png({ compressionLevel: 4 })
        .toBuffer();
    const bytes = withPngText(
        png,
        "celestial-dem",
        JSON.stringify({
            schema: "spacexr-dem-tile/1",
            body: "Moon",
            frame: "MOON_ME_DE421",
            tileMatrixSet: "spacexr-cube-equiangular/1",
            tile: address,
            variant,
            sourceFrame: "MOON_ME_DE421",
            heightReference: "radial-height-over-reference-surface",
            referenceRadii: config.referenceRadii,
            heightEncoding: { type: "terrarium", unit: "m", formula: "R*256+G+B/256-32768", noData: "alpha=0" },
            sources: [
                { id: "LOLA_GDR_LDEM_128", resolutionPixelsPerDegree: 128, sha256: lolaReceipt.sha256 },
                ...Array.from(usedSources, ([id, hash]) => {
                    const region = source.receipts.find((item) => item.id === id)!.region;
                    return {
                        id,
                        resolutionPixelsPerDegree: 512,
                        sha256: hash,
                        sourceUnit: region.sourceUnit,
                        sourceScaleToMetres: region.scalingFactor,
                    };
                }),
            ],
            comparison: variant === "delta" ? { formula: "SLDEM2015 - LOLA", unit: "m" } : undefined,
            coverageBlend: variant === "fused" ? { fromLatitude: 59.5, toLatitude: 60, method: "smoothstep" } : undefined,
        }),
    );
    await mkdir(dirname(file), { recursive: true });
    await atomicWrite(file, bytes);
    const result = { bytes: bytes.byteLength, sha256: sha256(bytes), minHeight, maxHeight };
    await writeJson(`${file}.json`, result);
    return { ...result, bytes };
}

/** Serialize large raster reads so concurrent camera requests stay within a small memory budget. */
export function comparisonTile(
    root: string,
    variant: MoonHeightVariant,
    address: ITileAddress,
): Promise<{ bytes: Buffer; minHeight: number; maxHeight: number; sha256: string }> {
    const result = comparisonQueue.then(() => generateComparisonTile(root, variant, address));
    comparisonQueue = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}
