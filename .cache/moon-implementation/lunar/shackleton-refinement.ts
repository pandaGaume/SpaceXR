import { copyFile, mkdir, link, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { createHeightGrid, encodeTerrariumGrid } from "@spacexr/dem";
import { cubeTileDirection, cubeTileNeighbor, CubeFace, ReferenceSurface } from "@spacexr/tiles/cube";
import { TileNeighbor, type ITileAddress } from "@spacexr/tiles/addressing";
import { PolarStereographicProjection, rebaseRadialHeight } from "@spacexr/tiles/reprojection";
import { configuration } from "./pilot";
import { atomicWrite, hashFile, sha256, storagePath, withImportLock, writeJson } from "./storage";
import { sampleLolaMetres, borderHashes, globalFileKey, type IGlobalFile, type ILolaPixels } from "./global-kernel";
import type { IGlobalManifest } from "./global";
import { inspectShackletonRaster, SHACKLETON_DEM_KEY, SHACKLETON_LDEC_KEY } from "./shackleton-source";

const TILE_SIZE = 256;
const SOURCE_RADIUS = 1737400;
const CAP_LATITUDE = 87;
const BLEND_WIDTH_DEGREES = 0.25;
const EDGES = [TileNeighbor.N, TileNeighbor.E, TileNeighbor.S, TileNeighbor.W] as const;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
});

interface IPolarRaster {
    width: number;
    height: number;
    originX: number;
    originY: number;
    pixelSize: number;
    noData: number;
    values: Float32Array;
    sourceSha256: string;
    metadata: Awaited<ReturnType<typeof inspectShackletonRaster>>;
}

export interface IShackletonRefinement {
    id: "pgda81-south-polar-87s";
    revision: string;
    sourceFrame: "MOON_ME_DE421";
    sourceRadius: number;
    coverageLatitude: number;
    blendEndLatitude: number;
    minLOD: number;
    maxLOD: number;
    tileCount: number;
    bytes: number;
    sourceFiles: Array<{ file: string; bytes: number; sha256: string }>;
    borderPairsVerified: number;
    files: IGlobalFile[];
}

/** Enumerate only south-polar cube tiles whose footprint intersects the stated latitude cap. */
export function shackletonCapAddresses(minLOD = 7, maxLOD = 11): ITileAddress[] {
    if (!Number.isInteger(minLOD) || !Number.isInteger(maxLOD) || minLOD < 1 || maxLOD < minLOD || maxLOD > 11)
        throw new RangeError("The Shackleton refinement must use levels 1 through 11.");
    const result: ITileAddress[] = [];
    const radius = Math.tan(((90 - CAP_LATITUDE) * Math.PI) / 180);
    const plane = (i: number, n: number): number => Math.tan((Math.PI / 4) * ((2 * i) / n - 1));
    const nearestZero = (a: number, b: number): number => (a <= 0 && b >= 0 ? 0 : Math.min(Math.abs(a), Math.abs(b)));
    for (let lod = minLOD; lod <= maxLOD; lod++) {
        const count = 2 ** lod;
        for (let y = 0; y < count; y++) {
            const v0 = plane(y, count),
                v1 = plane(y + 1, count),
                vNear = nearestZero(v0, v1);
            for (let x = 0; x < count; x++) {
                const uNear = nearestZero(plane(x, count), plane(x + 1, count));
                if (Math.hypot(uNear, vNear) <= radius + 1e-12)
                    result.push({ face: CubeFace.South, lod, x, y });
            }
        }
    }
    return result;
}

async function loadPolarRaster(root: string, key: string): Promise<IPolarRaster> {
    const metadata = await inspectShackletonRaster(root, key);
    if (metadata.bitsPerSample !== 32 || metadata.sampleFormat !== 3 || metadata.samplesPerPixel !== 1)
        throw new Error(`Expected one Float32 band in ${key}.`);
    const imageOrigin = metadata.origin,
        pixelSize = Math.abs(metadata.resolution[0] ?? 0);
    if (
        metadata.geoKeys?.GTRasterTypeGeoKey !== 2 ||
        !(pixelSize > 0) ||
        Math.abs(Math.abs(metadata.resolution[1] ?? 0) - pixelSize) > 1e-8 ||
        !Number.isFinite(imageOrigin[0]) ||
        !Number.isFinite(imageOrigin[1])
    )
        throw new Error(`Unexpected georeferencing or pixel registration in ${key}.`);

    const tiff = await fromFile(storagePath(root, key));
    let values: Float32Array;
    try {
        const image = await tiff.getImage();
        values = (await image.readRasters({ interleave: true })) as Float32Array;
    } finally {
        await tiff.close();
    }
    if (values.length !== metadata.width * metadata.height)
        throw new Error(`Unexpected raster sample count in ${key}.`);
    const noData = metadata.noData ?? Number.NaN;
    return {
        width: metadata.width,
        height: metadata.height,
        originX: imageOrigin[0]!,
        originY: imageOrigin[1]!,
        pixelSize,
        noData,
        values,
        sourceSha256: await hashFile(storagePath(root, key)),
        metadata,
    };
}

function sampleRaster(raster: IPolarRaster, x: number, y: number): number {
    const px = (x - raster.originX) / raster.pixelSize,
        py = (raster.originY - y) / raster.pixelSize,
        left = Math.floor(px),
        top = Math.floor(py),
        fx = px - left,
        fy = py - top;
    let sum = 0,
        weightSum = 0;
    for (const [dx, dy, weight] of [
        [0, 0, (1 - fx) * (1 - fy)],
        [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],
        [1, 1, fx * fy],
    ] as const) {
        const column = left + dx,
            row = top + dy;
        if (weight === 0 || column < 0 || row < 0 || column >= raster.width || row >= raster.height) continue;
        const value = raster.values[row * raster.width + column]!;
        if (!Number.isFinite(value) || (Number.isFinite(raster.noData) && value === raster.noData)) continue;
        sum += value * weight;
        weightSum += weight;
    }
    return weightSum > 0 ? sum / weightSum : Number.NaN;
}

function smoothstep(value: number): number {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
}

/** Add a standards-compliant PNG iTXt chunk while leaving all pixel chunks byte-for-byte intact. */
function withPngText(png: Buffer, keyword: string, text: string): Buffer {
    if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG encoder returned an invalid signature.");
    const type = Buffer.from("iTXt", "ascii"),
        payload = Buffer.concat([
            Buffer.from(keyword, "latin1"),
            Buffer.from([0, 0, 0, 0, 0]),
            Buffer.from(text, "utf8"),
        ]),
        crcInput = Buffer.concat([type, payload]);
    let crc = 0xffffffff;
    for (const byte of crcInput) crc = PNG_CRC_TABLE[(crc ^ byte) & 255]! ^ (crc >>> 8);
    const chunk = Buffer.allocUnsafe(12 + payload.length);
    chunk.writeUInt32BE(payload.length, 0);
    type.copy(chunk, 4);
    payload.copy(chunk, 8);
    chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + payload.length);

    let offset = 8;
    while (offset + 12 <= png.length) {
        const length = png.readUInt32BE(offset),
            name = png.toString("ascii", offset + 4, offset + 8);
        if (name === "IDAT") return Buffer.concat([png.subarray(0, offset), chunk, png.subarray(offset)]);
        offset += 12 + length;
    }
    throw new Error("PNG encoder returned no image data chunk.");
}

async function loadGlobalFallback(root: string): Promise<ILolaPixels> {
    const label = await readFile(storagePath(root, "sources/moon/pds/LDEM_128.LBL"), "utf8");
    const { parsePdsLunarLabel } = await import("./global-sources");
    const grid = parsePdsLunarLabel(label, 128),
        buffer = await readFile(storagePath(root, "sources/moon/pds/LDEM_128.IMG"));
    if (buffer.byteLength !== grid.width * grid.height * 2) throw new Error("Invalid global LOLA fallback grid.");
    const values = new Int16Array(buffer.buffer, buffer.byteOffset, grid.width * grid.height);
    let north = 0,
        south = 0;
    for (let x = 0; x < grid.width; x++) {
        north += values[x]! * grid.scale;
        south += values[(grid.height - 1) * grid.width + x]! * grid.scale;
    }
    return { width: grid.width, height: grid.height, values, north: north / grid.width, south: south / grid.width };
}

function tileHeights(
    address: ITileAddress,
    raster: IPolarRaster,
    fallback: ILolaPixels,
    projection: PolarStereographicProjection,
    reference: ReferenceSurface,
): Float32Array {
    const data = new Float32Array((TILE_SIZE + 1) ** 2),
        direction = { x: 0, y: 0, z: 0 },
        map = { x: 0, y: 0 },
        latitudeRadians = Math.PI / 180;
    for (let row = 0; row <= TILE_SIZE; row++) {
        for (let column = 0; column <= TILE_SIZE; column++) {
            cubeTileDirection(address, column / TILE_SIZE, row / TILE_SIZE, direction);
            const index = row * (TILE_SIZE + 1) + column,
                base = sampleLolaMetres(fallback, (Math.atan2(direction.y, direction.x) * 180) / Math.PI, (Math.atan2(direction.z, Math.hypot(direction.x, direction.y)) * 180) / Math.PI),
                fallbackHeight = rebaseRadialHeight(base, SOURCE_RADIUS, reference, direction),
                polarPosition = projection.forward(direction, map),
                polarHeight = sampleRaster(raster, polarPosition.x, polarPosition.y),
                latitude = (Math.atan2(-direction.z, Math.hypot(direction.x, direction.y)) / latitudeRadians);
            if (!Number.isFinite(polarHeight)) {
                data[index] = fallbackHeight;
                continue;
            }
            const polarReference = rebaseRadialHeight(polarHeight, SOURCE_RADIUS, reference, direction),
                blend = smoothstep((latitude - CAP_LATITUDE) / BLEND_WIDTH_DEGREES);
            data[index] = fallbackHeight * (1 - blend) + polarReference * blend;
        }
    }
    return data;
}

function availableNeighborBorders(files: readonly IGlobalFile[]): number {
    const map = new Map(files.map((file) => [globalFileKey(file.kind, file.address), file]));
    let checked = 0;
    for (const file of files) {
        for (let edge = 0; edge < EDGES.length; edge++) {
            const neighbor = cubeTileNeighbor(file.address, EDGES[edge]!);
            if (!neighbor) continue;
            const key = globalFileKey(file.kind, neighbor.address),
                ownKey = globalFileKey(file.kind, file.address),
                other = map.get(key);
            if (!other || ownKey >= key) continue;
            if (file.borders[edge * 2] !== other.borders[((edge + 2) % 4) * 2])
                throw new Error(`Shackleton border mismatch between ${ownKey} and ${key}.`);
            checked++;
        }
    }
    return checked;
}

/** Build an immutable global revision with a sparse PGDA81 south polar subtree through level 11. */
export async function buildShackletonRefinement(
    root: string,
    log: (message: string) => void = console.log,
    maxLOD = 11,
): Promise<{ directory: string; manifest: IGlobalManifest }> {
    if (!Number.isInteger(maxLOD) || maxLOD < 7 || maxLOD > 11) throw new RangeError("Shackleton max LOD must be 7..11.");
    return withImportLock(root, async () => {
        const pointer = JSON.parse(await readFile(storagePath(root, "catalog/latest-global.json"), "utf8")) as {
                directory: string;
                revision: string;
            },
            base = JSON.parse(await readFile(storagePath(root, `${pointer.directory}/manifest.json`), "utf8")) as IGlobalManifest;
        if (base.revision !== pointer.revision || base.status !== "verified") throw new Error("The base Moon pyramid is not verified.");
        if (base.refinements?.some((refinement) => refinement.id === "pgda81-south-polar-87s"))
            throw new Error("The latest Moon revision already includes the PGDA81 south polar refinement.");
        const sourceCatalog = JSON.parse(
            await readFile(storagePath(root, "catalog/shackleton-sources.json"), "utf8"),
        ) as { receipts: Array<{ file: string; bytes: number; sha256: string }> };
        const sourceDem = sourceCatalog.receipts.find((source) => source.file === SHACKLETON_DEM_KEY);
        if (!sourceDem || !sourceCatalog.receipts.some((source) => source.file === SHACKLETON_LDEC_KEY))
            throw new Error("Import both PGDA81 DEM and LDEC sources before refinement.");
        const config = await configuration(root),
            addresses = shackletonCapAddresses(7, maxLOD),
            revision = sha256(
                Buffer.from(
                    JSON.stringify({
                        algorithm: "shackleton-pgda81-cap-v1",
                        baseRevision: base.revision,
                        sourceSha256: sourceDem.sha256,
                        referenceRadii: config.referenceRadii,
                        capLatitude: CAP_LATITUDE,
                        blendEndLatitude: CAP_LATITUDE + BLEND_WIDTH_DEGREES,
                        maxLOD,
                    }),
                ),
            ).slice(0, 20),
            combinedRevision = sha256(Buffer.from(JSON.stringify({ base: base.revision, polar: revision }))).slice(0, 20),
            prefix = `datasets/moon/global-${combinedRevision}`,
            polar = await loadPolarRaster(root, SHACKLETON_DEM_KEY),
            fallback = await loadGlobalFallback(root),
            geoKeys = polar.metadata.geoKeys ?? {},
            projection = new PolarStereographicProjection({
                pole: "south",
                radius: SOURCE_RADIUS,
                centralMeridianDegrees: Number(
                    geoKeys.ProjStraightVertPoleLongGeoKey ?? geoKeys.ProjCenterLongGeoKey ?? 0,
                ),
                falseEasting: Number(geoKeys.ProjFalseEastingGeoKey ?? 0),
                falseNorthing: Number(geoKeys.ProjFalseNorthingGeoKey ?? 0),
            }),
            reference = new ReferenceSurface(...config.referenceRadii),
            globalCatalog = JSON.parse(
                await readFile(storagePath(root, "catalog/global-sources.json"), "utf8"),
            ) as { receipts: Array<{ file: string; sha256: string }> },
            fallbackReceipt = globalCatalog.receipts.find((source) => source.file === "sources/moon/pds/LDEM_128.IMG"),
            generated: IGlobalFile[] = [];
        if (!fallbackReceipt) throw new Error("The 128 ppd global LOLA source has no verified receipt.");
        log(
            `Shackleton revision ${combinedRevision}: ${addresses.length} polar tiles, levels 7-${maxLOD}, ` +
                `${polar.width} x ${polar.height} Float32 samples`,
        );
        const total = addresses.length;
        let completed = 0,
            lastLog = 0;
        for (const address of addresses) {
            const rowFile = storagePath(root, `${prefix}/.rows/polar/${address.lod}/${address.x}/${address.y}.json`);
            try {
                const receipt = JSON.parse(await readFile(rowFile, "utf8")) as {
                    revision: string;
                    file: IGlobalFile;
                };
                const output = storagePath(root, `${prefix}/${receipt.file.path}`);
                if (
                    receipt.revision === revision &&
                    (await stat(output)).size === receipt.file.bytes &&
                    (await hashFile(output)) === receipt.file.sha256
                ) {
                    generated.push(receipt.file);
                    completed++;
                    continue;
                }
            } catch (error) {
                if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            }
            const heights = tileHeights(address, polar, fallback, projection, reference),
                rgba = encodeTerrariumGrid(createHeightGrid(TILE_SIZE + 1, TILE_SIZE + 1, heights));
            let minHeight = Infinity,
                maxHeight = -Infinity;
            for (const value of heights) {
                minHeight = Math.min(minHeight, value);
                maxHeight = Math.max(maxHeight, value);
            }
            const bytes = await sharp(rgba.data, {
                raw: { width: TILE_SIZE + 1, height: TILE_SIZE + 1, channels: 4 },
            })
                .png({ compressionLevel: 4 })
                .toBuffer();
            const describedBytes = withPngText(
                bytes,
                "celestial-dem",
                JSON.stringify({
                    schema: "spacexr-dem-tile/1",
                    body: "Moon",
                    frame: "MOON_ME_DE421",
                    tileMatrixSet: "spacexr-cube-equiangular/1",
                    tile: { face: address.face, level: address.lod, x: address.x, y: address.y },
                    raster: { width: TILE_SIZE + 1, height: TILE_SIZE + 1, cellsPerSide: TILE_SIZE, registration: "shared-vertex-grid" },
                    heightReference: "radial-height-over-reference-surface",
                    referenceRadii: config.referenceRadii,
                    heightEncoding: {
                        type: "terrarium",
                        unit: "m",
                        formula: "R*256+G+B/256-32768",
                        noData: "alpha=0",
                    },
                    sources: [
                        { id: "PGDA81_LOLA_87S_5MPP", sha256: sourceDem.sha256 },
                        { id: "LOLA_GDR_LDEM_128", sha256: fallbackReceipt.sha256 },
                    ],
                    resampling: "bilinear",
                    edgeBlend: { fromLatitudeSouth: CAP_LATITUDE, toLatitudeSouth: CAP_LATITUDE + BLEND_WIDTH_DEGREES },
                }),
            );
            const path = `elevation/${address.face}/${address.lod}/${address.x}/${address.y}.png`;
            await atomicWrite(storagePath(root, `${prefix}/${path}`), describedBytes);
            const file: IGlobalFile = {
                kind: "elevation",
                address,
                path,
                bytes: describedBytes.length,
                sha256: sha256(describedBytes),
                borders: borderHashes(rgba.data, 4),
                minHeight,
                maxHeight,
            };
            await writeJson(rowFile, { revision, file });
            generated.push(file);
            completed++;
            if (Date.now() - lastLog > 10000 || completed === total) {
                lastLog = Date.now();
                log(`Shackleton tiles ${completed}/${total} (${((100 * completed) / total).toFixed(1)}%)`);
                await writeJson(storagePath(root, "reports/shackleton-progress.json"), {
                    phase: "generate",
                    baseRevision: base.revision,
                    revision: combinedRevision,
                    completed,
                    target: total,
                    maxLOD,
                });
            }
        }

        const expected = addresses.map((address) => `${address.face}/${address.lod}/${address.x}/${address.y}`).sort(),
            actual = generated.map((file) => `${file.address.face}/${file.address.lod}/${file.address.x}/${file.address.y}`).sort();
        if (expected.length !== actual.length || expected.some((address, index) => address !== actual[index]))
            throw new Error("Shackleton tile inventory differs from its planned cap coverage.");
        const borderPairsVerified = availableNeighborBorders(generated);
        let bytesWritten = 0;
        for (const file of generated) {
            const path = storagePath(root, `${prefix}/${file.path}`);
            if ((await stat(path)).size !== file.bytes || (await hashFile(path)) !== file.sha256)
                throw new Error(`Invalid Shackleton tile: ${file.path}`);
            bytesWritten += file.bytes;
        }

        const baseFiles = base.files,
            baseDirectory = pointer.directory;
        for (let index = 0; index < baseFiles.length; index++) {
            const file = baseFiles[index]!,
                source = storagePath(root, `${baseDirectory}/${file.path}`),
                destination = storagePath(root, `${prefix}/${file.path}`);
            await mkdir(dirname(destination), { recursive: true });
            try {
                await link(source, destination);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
                if ((error as NodeJS.ErrnoException).code !== "EXDEV" && (error as NodeJS.ErrnoException).code !== "EPERM")
                    throw error;
                await copyFile(source, destination);
            }
            if (index % 8192 === 8191) log(`Link base pyramid ${index + 1}/${baseFiles.length}`);
        }

        const subtrees = addresses.map(({ face, lod, x, y }) => ({ face: face ?? 0, lod, x, y, maxLOD: lod })),
            elevation = JSON.parse(await readFile(storagePath(root, `${baseDirectory}/elevation.json`), "utf8")) as {
                subtrees: unknown[];
            };
        elevation.subtrees = subtrees;
        await writeJson(storagePath(root, `${prefix}/elevation.json`), elevation);
        await writeJson(
            storagePath(root, `${prefix}/imagery.json`),
            JSON.parse(await readFile(storagePath(root, `${baseDirectory}/imagery.json`), "utf8")),
        );
        const refinement: IShackletonRefinement = {
            id: "pgda81-south-polar-87s",
            revision,
            sourceFrame: "MOON_ME_DE421",
            sourceRadius: SOURCE_RADIUS,
            coverageLatitude: CAP_LATITUDE,
            blendEndLatitude: CAP_LATITUDE + BLEND_WIDTH_DEGREES,
            minLOD: 7,
            maxLOD,
            tileCount: generated.length,
            bytes: bytesWritten,
            sourceFiles: sourceCatalog.receipts.map(({ file, bytes, sha256: checksum }) => ({ file, bytes, sha256: checksum })),
            borderPairsVerified,
            files: generated,
        };
        await writeJson(storagePath(root, `${prefix}/shackleton.json`), refinement);
        const manifest: IGlobalManifest = {
            ...base,
            revision: combinedRevision,
            createdAt: new Date().toISOString(),
            sources: base.sources,
            files: [...baseFiles, ...generated].sort((a, b) => a.path.localeCompare(b.path)),
            bytes: base.bytes + bytesWritten,
            sharedBordersVerified: base.sharedBordersVerified + borderPairsVerified,
            refinements: [{ id: refinement.id, revision, minLOD: 7, maxLOD, tileCount: generated.length, bytes: bytesWritten }],
        };
        await writeJson(storagePath(root, `${prefix}/manifest.json`), manifest);
        await writeJson(storagePath(root, "reports/shackleton-progress.json"), {
            phase: "complete",
            revision: combinedRevision,
            completed: generated.length,
            target: generated.length,
            bytes: bytesWritten,
            borderPairsVerified,
        });
        await writeJson(storagePath(root, "catalog/latest-global.json"), { directory: prefix, revision: combinedRevision });
        log(
            `Shackleton complete: ${generated.length} tiles, ${(bytesWritten / 1e9).toFixed(3)} GB, ` +
                `${borderPairsVerified} adjacent borders verified; revision ${combinedRevision}`,
        );
        return { directory: prefix, manifest };
    });
}
