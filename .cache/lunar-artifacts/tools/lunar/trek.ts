import { readFile } from "node:fs/promises";
import { fromArrayBuffer } from "geotiff";
import {
    PolarStereographicProjection,
    type ICubeSourceLevel,
    type ISourceTileMatrix,
} from "@spacexr/tiles/reprojection";
import { download, storagePath, writeJson } from "./storage";

/** Native LOLA south-polar source used by this bounded pilot. */
export const POLAR_DEM =
    "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole875_5mp_v04/ImageServer";
export const LOLA_RADIUS = 1737400;
export const BLOCK_SIZE = 512;

/** Numeric service metadata required to interpret an export in its native map. */
export interface ITrekMetadata {
    pixelType: string;
    bandCount: number;
    pixelSizeX: number;
    pixelSizeY: number;
    maxImageWidth: number;
    maxImageHeight: number;
    extent: { xmin: number; ymin: number; xmax: number; ymax: number; spatialReference: { wkt: string } };
}

/** Validated scalar block. Samples remain native LOLA metres until target rebasing. */
export interface IHeightBlock {
    width: number;
    height: number;
    values: Float32Array;
    noData: number | null;
}

/**
 * Reject another service, a display raster, or a changed grid instead of guessing its meaning.
 * WKT checks intentionally accept only the pinned spherical south-polar product.
 */
export function polarSource(metadata: ITrekMetadata): ICubeSourceLevel {
    const e = metadata.extent;
    if (
        metadata.pixelType !== "F32" ||
        metadata.bandCount !== 1 ||
        metadata.pixelSizeX !== 5 ||
        metadata.pixelSizeY !== 5 ||
        !e ||
        e.xmin !== -75840 ||
        e.ymin !== -75840 ||
        e.xmax !== 75840 ||
        e.ymax !== 75840 ||
        !e.spatialReference?.wkt.includes('SPHEROID["Moon_2000_IAU_IAG",1737400.0,0.0]') ||
        !e.spatialReference.wkt.includes('PROJECTION["Stereographic_South_Pole"]') ||
        !e.spatialReference.wkt.includes('PARAMETER["central_meridian",0.0]') ||
        !e.spatialReference.wkt.includes('PARAMETER["false_easting",0.0]') ||
        !e.spatialReference.wkt.includes('PARAMETER["false_northing",0.0]') ||
        !e.spatialReference.wkt.includes('PARAMETER["standard_parallel_1",-90.0]') ||
        metadata.maxImageWidth < BLOCK_SIZE ||
        metadata.maxImageHeight < BLOCK_SIZE
    )
        throw new Error("Unexpected LOLA numeric polar grid or projection");
    const matrix: ISourceTileMatrix = {
        identifier: "native-5m",
        registration: "area",
        originX: e.xmin,
        originY: e.ymax,
        pixelSize: 5,
        tileWidth: BLOCK_SIZE,
        tileHeight: BLOCK_SIZE,
        matrixWidth: Math.ceil((e.xmax - e.xmin) / 5 / BLOCK_SIZE),
        matrixHeight: Math.ceil((e.ymax - e.ymin) / 5 / BLOCK_SIZE),
    };
    return { projection: new PolarStereographicProjection({ pole: "south", radius: LOLA_RADIUS }), matrix };
}

/** Obtain current metadata and retain the full upstream response for provenance. */
export async function inspectPolarSource(root: string): Promise<{ metadata: ITrekMetadata; source: ICubeSourceLevel }> {
    const response = await fetch(`${POLAR_DEM}?f=pjson`, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`NASA metadata failed: HTTP ${response.status}`);
    const metadata = (await response.json()) as ITrekMetadata;
    const source = polarSource(metadata);
    await writeJson(storagePath(root, "catalog/lola-south-5m.json"), {
        url: POLAR_DEM,
        retrievedAt: new Date().toISOString(),
        metadata,
    });
    return { metadata, source };
}

/** Fixed native-grid blocks let adjacent cube tiles reuse exactly the same source pixels. */
export function blockRequest(
    matrix: ISourceTileMatrix,
    column: number,
    row: number,
): {
    url: string;
    bbox: [number, number, number, number];
    width: number;
    height: number;
} {
    if (
        !Number.isInteger(column) ||
        !Number.isInteger(row) ||
        column < 0 ||
        row < 0 ||
        column >= matrix.matrixWidth ||
        row >= matrix.matrixHeight
    )
        throw new Error("Invalid source block");
    const left = matrix.originX + column * BLOCK_SIZE * 5;
    const top = matrix.originY - row * BLOCK_SIZE * 5;
    const width = Math.min(BLOCK_SIZE, Math.round((75840 - left) / 5));
    const height = Math.min(BLOCK_SIZE, Math.round((top + 75840) / 5));
    const bbox: [number, number, number, number] = [left, top - height * 5, left + width * 5, top];
    const query = new URLSearchParams({
        bbox: bbox.join(","),
        size: `${width},${height}`,
        format: "tiff",
        pixelType: "F32",
        interpolation: "RSP_NearestNeighbor",
        renderingRule: JSON.stringify({ rasterFunction: "None" }),
        f: "json",
    });
    return { url: `${POLAR_DEM}/exportImage?${query}`, bbox, width, height };
}

/** Check the exported TIFF grid and Float32 samples before any interpolation or encoding. */
export async function decodeHeightBlock(
    bytes: Uint8Array,
    expected: { bbox: readonly number[]; width: number; height: number },
): Promise<IHeightBlock> {
    const tiff = await fromArrayBuffer(Uint8Array.from(bytes).buffer);
    const image = await tiff.getImage();
    if (
        image.getWidth() !== expected.width ||
        image.getHeight() !== expected.height ||
        image.getSamplesPerPixel() !== 1
    )
        throw new Error("Unexpected numeric TIFF dimensions or channels");
    const box = image.getBoundingBox();
    if (box.some((value, i) => Math.abs(value - expected.bbox[i]!) > 1e-5))
        throw new Error("Exported TIFF extent changed");
    if (image.getGeoKeys()?.GTRasterTypeGeoKey === 2) throw new Error("Expected pixel-area export registration");
    const values = await image.readRasters({ interleave: true });
    if (!(values instanceof Float32Array)) throw new Error("Expected Float32 heights, not a display image");
    const noData = image.getGDALNoData();
    for (let i = 0; i < values.length; i++) {
        const h = values[i]!;
        if (h === noData || Number.isNaN(h)) values[i] = NaN;
        else if (!Number.isFinite(h) || Math.abs(h) > 20000) throw new Error("Unexpected lunar height value");
    }
    return { width: expected.width, height: expected.height, values, noData };
}

/** Load a checksum-verified cached export or request one bounded native block. */
export async function loadPolarBlock(
    root: string,
    source: ICubeSourceLevel,
    column: number,
    row: number,
): Promise<IHeightBlock> {
    const requested = blockRequest(source.matrix, column, row);
    const file = storagePath(root, `cache/lola-south-5m/${column}/${row}.tif`);
    const requestFile = `${file}.export.json`;
    let cached = false;
    try {
        const saved = JSON.parse(await readFile(requestFile, "utf8")) as { url: string; href: string };
        if (saved.url === requested.url) {
            await download(saved.href, file, 8 * 1024 ** 2);
            cached = true;
        }
    } catch (error) {
        if (
            !(error instanceof SyntaxError) &&
            (error as NodeJS.ErrnoException).code !== "ENOENT" &&
            !(error instanceof Error && /Source download failed: HTTP (404|410)/.test(error.message))
        )
            throw error;
    }
    if (!cached) {
        const response = await fetch(requested.url, { signal: AbortSignal.timeout(90000) });
        if (!response.ok) throw new Error(`NASA numeric export failed: HTTP ${response.status}`);
        const result = (await response.json()) as { href?: string; width?: number; height?: number; error?: unknown };
        if (result.error || !result.href || result.width !== requested.width || result.height !== requested.height)
            throw new Error("NASA did not return the requested numeric export");
        const href = new URL(result.href);
        if (
            !["https:", "http:"].includes(href.protocol) ||
            href.hostname !== "trek.nasa.gov" ||
            href.port ||
            href.username ||
            href.password ||
            !href.pathname.startsWith(
                "/arcgis/rest/directories/arcgisoutput/LRO_LOLA_DEM_SPole875_5mp_v04_ImageServer/",
            )
        )
            throw new Error("Unexpected NASA export download origin");
        // ArcGIS advertises its internal HTTP route. Use the public lunar HTTPS reverse proxy.
        href.protocol = "https:";
        href.pathname = href.pathname.replace(/^\/arcgis\//, "/moon/trekarcgis/");
        // Retain the export URL before transfer so an interrupted TIFF can resume on the next run.
        await writeJson(requestFile, { ...requested, href: href.href });
        await download(href.href, file, 8 * 1024 ** 2);
    }
    return decodeHeightBlock(await readFile(file), requested);
}
