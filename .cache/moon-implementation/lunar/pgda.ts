import { readFile } from "node:fs/promises";
import { fromArrayBuffer } from "geotiff";
import { cubeTileDirection } from "@spacexr/tiles/cube";
import type { ITileAddress } from "@spacexr/tiles/addressing";
import { PolarStereographicProjection, type ICubeSourceLevel } from "@spacexr/tiles/reprojection";
import { download, storagePath } from "./storage";
import { LOLA_RADIUS, type IHeightBlock } from "./trek";

/** Track-adjusted regional LOLA product, identified by exact input bytes. */
export const SITE04_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif";
export const SITE04_SHA256 = "38ff70dbdf2f066c2cfa94a646c3a59d653ce7f6b4528b15fc1b43ee397ce758";

/** A fixed 2 x 2 window fully inside Site04, near the south pole on Shackleton's rim. */
export const SITE04_PILOT: readonly ITileAddress[] = [
    { face: 5, lod: 11, x: 1023, y: 1024 },
    { face: 5, lod: 11, x: 1024, y: 1024 },
    { face: 5, lod: 11, x: 1023, y: 1025 },
    { face: 5, lod: 11, x: 1024, y: 1025 },
];

/** Pinned native area-registered grid, in south-polar map metres. */
export function site04Source(): ICubeSourceLevel {
    return {
        projection: new PolarStereographicProjection({ pole: "south", radius: LOLA_RADIUS }),
        matrix: {
            identifier: "pgda-site04-adjusted-5m",
            registration: "area",
            originX: -9000,
            originY: 1000,
            pixelSize: 5,
            tileWidth: 3200,
            tileHeight: 3200,
            matrixWidth: 1,
            matrixHeight: 1,
        },
    };
}

/**
 * Refuse any target sample whose bilinear footprint leaves the regional product.
 * Missing coverage cannot silently become an extrapolated height or an undocumented source blend.
 */
export function assertSourceCoverage(addresses: readonly ITileAddress[], source: ICubeSourceLevel, cells = 256): void {
    const m = source.matrix;
    const width = m.tileWidth * m.matrixWidth,
        height = m.tileHeight * m.matrixHeight;
    for (const address of addresses)
        for (let row = 0; row <= cells; row++)
            for (let column = 0; column <= cells; column++) {
                const p = source.projection.forward(cubeTileDirection(address, column / cells, row / cells));
                const offset = m.registration === "area" ? 0.5 : 0;
                const x = (p.x - m.originX) / m.pixelSize - offset,
                    y = (m.originY - p.y) / m.pixelSize - offset;
                if (
                    !Number.isFinite(x + y) ||
                    Math.floor(x) < 0 ||
                    Math.floor(y) < 0 ||
                    Math.ceil(x) >= width ||
                    Math.ceil(y) >= height
                )
                    throw new Error("Pilot sample leaves the regional DEM coverage");
            }
}

/**
 * Import and decode the 41 MB adjusted product without filtering its heights.
 * Its README identifies the horizontal frame as MOON_ME / DE421. Vertical semantics
 * and compatibility with the global visualization product still require validation.
 */
export async function loadSite04(root: string): Promise<{ source: ICubeSourceLevel; block: IHeightBlock }> {
    const file = storagePath(root, "sources/moon/pgda/Site04_final_adj_5mpp_surf.tif");
    await download(SITE04_URL, file, 64 * 1024 ** 2, SITE04_SHA256);
    const image = await (await fromArrayBuffer(Uint8Array.from(await readFile(file)).buffer)).getImage();
    const keys = image.getGeoKeys(),
        origin = image.getOrigin(),
        resolution = image.getResolution();
    if (
        image.getWidth() !== 3200 ||
        image.getHeight() !== 3200 ||
        image.getSamplesPerPixel() !== 1 ||
        keys?.GTRasterTypeGeoKey !== 1 ||
        keys.GeogSemiMajorAxisGeoKey !== LOLA_RADIUS ||
        keys.GeogSemiMinorAxisGeoKey !== LOLA_RADIUS ||
        keys.ProjCoordTransGeoKey !== 15 ||
        keys.ProjNatOriginLatGeoKey !== -90 ||
        keys.ProjStraightVertPoleLongGeoKey !== 0 ||
        keys.ProjFalseEastingGeoKey !== 0 ||
        keys.ProjFalseNorthingGeoKey !== 0 ||
        keys.ProjLinearUnitsGeoKey !== 9001 ||
        origin[0] !== -9000 ||
        origin[1] !== 1000 ||
        resolution[0] !== 5 ||
        resolution[1] !== -5
    )
        throw new Error("Unexpected PGDA Site04 grid or projection");
    const values = await image.readRasters({ interleave: true });
    if (!(values instanceof Float32Array)) throw new Error("Expected PGDA Float32 heights");
    const noData = image.getGDALNoData();
    for (let i = 0; i < values.length; i++) {
        const h = values[i]!;
        if (h === noData || Number.isNaN(h)) values[i] = NaN;
        else if (!Number.isFinite(h) || Math.abs(h) > 20000) throw new Error("Invalid PGDA lunar height");
    }
    return { source: site04Source(), block: { width: 3200, height: 3200, values, noData } };
}
