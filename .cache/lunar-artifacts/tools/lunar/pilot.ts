import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fromArrayBuffer } from "geotiff";
import { SolarSystemBodies } from "@spacexr/celestial-core/catalog";
import { createHeightGrid, encodeTerrariumGrid } from "@spacexr/dem";
import { cubeTileDirection, ReferenceSurface, type ICelestialDataset } from "@spacexr/tiles/cube";
import type { ITileAddress } from "@spacexr/tiles/addressing";
import {
    cubeTileSourceTiles,
    GeographicProjection,
    rebaseRadialHeight,
    resampleCubeTile,
    type ICubeSourceLevel,
} from "@spacexr/tiles/reprojection";
import { sampleElevationMetres, validateElevationRaster } from "../r2/lunar-dem";
import { atomicWrite, download, initializeStorage, sha256, storagePath, withImportLock, writeJson } from "./storage";
import { inspectPolarSource, loadPolarBlock, LOLA_RADIUS, POLAR_DEM, type IHeightBlock } from "./trek";
import { assertSourceCoverage, loadSite04, SITE04_PILOT, SITE04_SHA256, SITE04_URL } from "./pgda";

/** Native polar product used by the HD diagnostic window. */
export type PolarProduct = "pgda-site04" | "trek";

/** Explicit target surface, independent of the map projection of each source. */
export interface ILunarConfiguration {
    schema: "lunar-pilot/1";
    referenceRadii: [number, number, number];
    frame: "MOON_ME";
    /** Upstream frame realization and vertical label still require scientific verification. */
    scientificStatus: "preview";
}

/** One exact produced tile. This inventory does not imply a complete HD pyramid. */
export interface IPilotTile {
    kind: "global-elevation" | "global-imagery" | "polar-elevation";
    address: ITileAddress;
    path: string;
    bytes: number;
    sha256: string;
    minHeight?: number;
    maxHeight?: number;
}

/** Immutable local pilot inventory and source provenance. HD coverage is four tiles only. */
export interface IPilotManifest {
    schema: "lunar-pilot-result/1";
    revision: string;
    createdAt: string;
    configuration: ILunarConfiguration;
    sources: { url: string; sha256?: string; sourceRadius: number; status: string }[];
    tiles: IPilotTile[];
    sharedBordersVerified: number;
    polarProduct?: PolarProduct;
}

/** Four adjacent 1.33 km-wide tiles surrounding the lunar south pole, on Shackleton's rim. */
export const POLAR_PILOT: readonly ITileAddress[] = [
    { face: 5, lod: 11, x: 1023, y: 1023 },
    { face: 5, lod: 11, x: 1024, y: 1023 },
    { face: 5, lod: 11, x: 1023, y: 1024 },
    { face: 5, lod: 11, x: 1024, y: 1024 },
];

const GLOBAL_SOURCES = [
    { file: "lroc_color_2k.jpg", hash: "f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170" },
    { file: "ldem_4.tif", hash: "330afa2556a86fd05ac6ba2f912f246600fdade35de2a0d90593d50d07b01b65" },
] as const;
const SVS_BASE = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/";

/** Keep a user-selected ellipsoid on subsequent runs; defaults come from the body catalogue. */
export async function configuration(root: string): Promise<ILunarConfiguration> {
    const file = storagePath(root, "catalog/lunar-pilot.json");
    let config: ILunarConfiguration;
    try {
        config = JSON.parse(await readFile(file, "utf8")) as ILunarConfiguration;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const ellipsoid = SolarSystemBodies.Moon!.ellipsoid;
        config = {
            schema: "lunar-pilot/1",
            referenceRadii: [ellipsoid.semiMajorAxis, ellipsoid.semiMajorAxis, ellipsoid.semiMinorAxis],
            frame: "MOON_ME",
            scientificStatus: "preview",
        };
        await writeJson(file, config);
    }
    if (
        config.schema !== "lunar-pilot/1" ||
        config.frame !== "MOON_ME" ||
        config.scientificStatus !== "preview" ||
        !Array.isArray(config.referenceRadii) ||
        config.referenceRadii.length !== 3 ||
        config.referenceRadii.some((r) => !Number.isFinite(r) || r < 1600000 || r > 1900000)
    )
        throw new Error("Invalid lunar pilot configuration");
    return config;
}

/** Convert radial source heights to any declared biaxial or triaxial target surface. */
export function rebaseGrid(
    heights: Float32Array,
    address: ITileAddress,
    target: ReferenceSurface,
    cells = 256,
): Float32Array {
    const side = cells + 1;
    if (heights.length !== side ** 2) throw new Error("Unexpected height grid length");
    const values = new Float32Array(heights.length);
    for (let row = 0; row < side; row++)
        for (let col = 0; col < side; col++) {
            const index = row * side + col;
            values[index] = rebaseRadialHeight(
                heights[index]!,
                LOLA_RADIUS,
                target,
                cubeTileDirection(address, col / cells, row / cells),
            );
        }
    return values;
}

/** Encode numeric channels without palette, lossy compression or image colour transforms. */
export async function terrariumPng(heights: Float32Array, side = 257): Promise<Buffer> {
    const image = encodeTerrariumGrid(createHeightGrid(side, side, heights));
    return sharp(image.data, { raw: { width: side, height: side, channels: 4 } })
        .png()
        .toBuffer();
}

/** Require exact Float32 equality along each shared edge of the four-tile pilot. */
export function verifyPilotBorders(grids: readonly Float32Array[], cells = 256): number {
    if (grids.length !== 4 || grids.some((grid) => grid.length !== (cells + 1) ** 2))
        throw new Error("Expected four pilot grids");
    const side = cells + 1;
    for (let i = 0; i < side; i++) {
        const pairs = [
            [grids[0]![i * side + cells], grids[1]![i * side]],
            [grids[2]![i * side + cells], grids[3]![i * side]],
            [grids[0]![cells * side + i], grids[2]![i]],
            [grids[1]![cells * side + i], grids[3]![i]],
        ];
        for (const [a, b] of pairs)
            if (!Number.isFinite(a) || a !== b) throw new Error("Polar pilot edge mismatch or NoData");
    }
    return 4;
}

/** Read all requested blocks before resampling; a failed request cannot become a missing height. */
export function polarGrid(
    address: ITileAddress,
    source: ICubeSourceLevel,
    blocks: ReadonlyMap<string, IHeightBlock>,
    cells = 256,
): Float32Array {
    return resampleCubeTile(
        address,
        source,
        (column, row, x, y) => {
            const block = blocks.get(`${column}/${row}`);
            if (!block) throw new Error("Source block was not loaded");
            return x < block.width && y < block.height ? block.values[y * block.width + x]! : NaN;
        },
        { tileSize: cells },
    );
}

/** Build a small inspectable result; no cloud upload or publication is performed. */
export async function buildPilot(root: string, log: (message: string) => void = console.log, polarProduct: PolarProduct = "trek"): Promise<IPilotManifest> {
    await initializeStorage(root);
    return withImportLock(root, () => generatePilot(root, log, polarProduct));
}

/** Assemble the complete pilot while its storage root is exclusively leased. */
async function generatePilot(root: string, log: (message: string) => void, polarProduct: PolarProduct): Promise<IPilotManifest> {
    const config = await configuration(root);
    const target = new ReferenceSurface(...config.referenceRadii);
    const sources: IPilotManifest["sources"] = [];
    for (const input of GLOBAL_SOURCES) {
        log(`Import ${input.file}`);
        const receipt = await download(
            SVS_BASE + input.file,
            storagePath(root, `sources/moon/svs/${input.file}`),
            8 * 1024 ** 2,
            input.hash,
        );
        sources.push({
            url: receipt.url,
            sha256: receipt.sha256,
            sourceRadius: LOLA_RADIUS,
            status: "SVS visualization product",
        });
    }
    const addresses = polarProduct === "pgda-site04" ? SITE04_PILOT : POLAR_PILOT;
    let source: ICubeSourceLevel;
    const blocks = new Map<string, IHeightBlock>();
    if (polarProduct === "pgda-site04") {
        log("Import adjusted LOLA PGDA Site04 (5 m grid)");
        const regional = await loadSite04(root);
        source = regional.source;
        assertSourceCoverage(addresses, source);
        blocks.set("0/0", regional.block);
        sources.push({
            url: SITE04_URL, sha256: SITE04_SHA256, sourceRadius: LOLA_RADIUS,
            status: "PGDA track-adjusted LOLA; MOON_ME / DE421; vertical compatibility awaits verification",
        });
    } else {
        source = (await inspectPolarSource(root)).source;
        const needed = new Map<string, { column: number; row: number }>();
        for (const address of addresses)
            for (const block of cubeTileSourceTiles(address, source)) needed.set(`${block.column}/${block.row}`, block);
        for (const [key, block] of needed) {
            log(`Import LOLA 5 m block ${key} (${blocks.size + 1}/${needed.size})`);
            blocks.set(key, await loadPolarBlock(root, source, block.column, block.row));
            const bytes = await readFile(storagePath(root, `cache/lola-south-5m/${key}.tif`));
            sources.push({ url: `${POLAR_DEM}#block=${key}`, sha256: sha256(bytes), sourceRadius: LOLA_RADIUS,
                status: "Numeric F32 export; source vertical label and frame realization await verification" });
        }
    }
    const revision = sha256(Buffer.from(JSON.stringify({ algorithm: "lunar-pilot-v2", config, sources, addresses }))).slice(0, 20);
    const prefix = `datasets/moon/pilot-${revision}`;
    const tiles: IPilotTile[] = [];
    async function save(
        kind: IPilotTile["kind"],
        address: ITileAddress,
        bytes: Buffer,
        heights?: Float32Array,
    ): Promise<void> {
        const extension = kind === "global-imagery" ? "webp" : "png";
        const path = `${kind}/${address.face}/${address.lod}/${address.x}/${address.y}.${extension}`;
        await atomicWrite(storagePath(root, `${prefix}/${path}`), bytes);
        let minHeight = Infinity,
            maxHeight = -Infinity;
        if (heights)
            for (const h of heights) {
                if (!Number.isFinite(h)) throw new Error("Pilot must not contain unexpected NoData");
                minHeight = Math.min(minHeight, h);
                maxHeight = Math.max(maxHeight, h);
            }
        tiles.push({
            kind,
            address,
            path,
            bytes: bytes.length,
            sha256: sha256(bytes),
            ...(heights ? { minHeight, maxHeight } : {}),
        });
    }
    const demBytes = await readFile(storagePath(root, "sources/moon/svs/ldem_4.tif"));
    const tiff = await fromArrayBuffer(Uint8Array.from(demBytes).buffer);
    const image = await tiff.getImage();
    const values = await image.readRasters({ interleave: true });
    if (!(values instanceof Float32Array)) throw new Error("Expected SVS Float32 kilometre DEM");
    const globalDem = { width: image.getWidth(), height: image.getHeight(), kilometres: values };
    validateElevationRaster(globalDem);
    const colour = await sharp(await readFile(storagePath(root, "sources/moon/svs/lroc_color_2k.jpg")))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = colour.info;
    if (width !== 2048 || height !== 1024 || channels !== 3) throw new Error("Unexpected SVS colour atlas");
    const colourSource: ICubeSourceLevel = {
        projection: new GeographicProjection({ semiMajorAxis: LOLA_RADIUS }),
        matrix: {
            identifier: "svs-2k",
            registration: "area",
            originX: -180,
            originY: 90,
            pixelSize: 360 / width,
            tileWidth: width,
            tileHeight: height,
            matrixWidth: 1,
            matrixHeight: 1,
        },
    };
    for (let face = 0; face < 6; face++) {
        log(`Generate global face ${face}`);
        const address = { face, lod: 0, x: 0, y: 0 };
        const heights = new Float32Array(257 ** 2);
        for (let row = 0; row <= 256; row++)
            for (let col = 0; col <= 256; col++) {
                const d = cubeTileDirection(address, col / 256, row / 256);
                heights[row * 257 + col] = sampleElevationMetres(
                    globalDem,
                    (Math.atan2(d.z, Math.hypot(d.x, d.y)) * 180) / Math.PI,
                    (Math.atan2(d.y, d.x) * 180) / Math.PI,
                );
            }
        const rebased = rebaseGrid(heights, address, target);
        await save("global-elevation", address, await terrariumPng(rebased), rebased);
        const rgb = resampleCubeTile(
            address,
            colourSource,
            (_column, _row, x, y, c) => colour.data[(y * width + x) * 3 + c]!,
            { channels: 3 },
        );
        const pixels = Uint8Array.from(rgb, (value) => Math.round(value));
        await save(
            "global-imagery",
            address,
            await sharp(pixels, { raw: { width: 257, height: 257, channels: 3 } })
                .webp({ lossless: true })
                .toBuffer(),
        );
    }
    const grids = addresses.map((address) => rebaseGrid(polarGrid(address, source, blocks), address, target));
    const sharedBordersVerified = verifyPilotBorders(grids);
    for (let i = 0; i < grids.length; i++)
        await save("polar-elevation", addresses[i]!, await terrariumPng(grids[i]!), grids[i]);
    // Only the six global roots form a complete declared pyramid. HD tiles remain an exact diagnostic inventory.
    for (const [content, kind, encoding] of [
        ["elevation", "global-elevation", "terrarium"],
        ["imagery", "global-imagery", "webp"],
    ] as const) {
        const descriptor: ICelestialDataset = {
            scheme: "spacexr-cube-equiangular/1",
            body: "Moon",
            frame: config.frame,
            referenceRadii: config.referenceRadii,
            content,
            encoding,
            tileSize: 256,
            minLOD: 0,
            maxLOD: 0,
            subtrees: [],
            tiles: `./${kind}/{face}/{z}/{x}/{y}.${content === "elevation" ? "png" : "webp"}`,
        };
        await writeJson(storagePath(root, `${prefix}/${content}.json`), descriptor);
    }
    const manifest: IPilotManifest = {
        schema: "lunar-pilot-result/1",
        revision,
        createdAt: new Date().toISOString(),
        configuration: config,
        sources,
        tiles,
        sharedBordersVerified,
        polarProduct,
    };
    await writeJson(storagePath(root, `${prefix}/pilot.json`), manifest);
    await writeJson(storagePath(root, "catalog/latest-pilot.json"), { directory: prefix, revision });
    log(`Pilot ready: ${tiles.length} tiles; ${sharedBordersVerified} shared HD borders verified`);
    return manifest;
}
