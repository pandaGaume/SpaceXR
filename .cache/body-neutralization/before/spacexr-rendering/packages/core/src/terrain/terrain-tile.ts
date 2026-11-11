import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { IEcefSpatialState, ITileActivationContext, ITileAddress } from "@spacexr/3d-tiles-runtime";
import type { IHeightRange } from "@spacexr/dem";
import { GeodeticSystem } from "@spacexr/geodesy";

/** Activation context of a terrain tile, whatever the handle of the engine. */
type TerrainActivation<THandle> = ITileActivationContext<IEcefSpatialState, THandle, never>;

/** Region whose height interval is a measured range multiplied by a vertical scale. */
export function regionWithHeights(
    region: readonly number[],
    range: IHeightRange,
    scale: number,
): [number, number, number, number, number, number] {
    return [region[0]!, region[1]!, region[2]!, region[3]!, range.minimum * scale, range.maximum * scale];
}

/** Geodetic region of a terrain tile, `[west, south, east, north, minimumHeight, maximumHeight]`. */
export function tileRegion<THandle>(context: TerrainActivation<THandle>): readonly number[] {
    const region = context.tile.source.boundingVolume.region;
    if (!region) throw new Error(`Tile ${context.tile.id} does not expose a geodetic region.`);
    return region;
}

/** Address of a terrain tile, read from the metadata of the geodesic grid source. */
export function tileIdentity<THandle>(context: TerrainActivation<THandle>): ITileAddress {
    const properties = context.tile.source.metadata?.properties;
    const readCoordinate = (name: "lod" | "x" | "y"): number => {
        const value = properties?.[name];
        if (typeof value !== "number" || !Number.isSafeInteger(value))
            throw new Error(`Tile ${context.tile.id} has no valid ${name} metadata.`);
        return value;
    };
    const face = properties?.face;
    return {
        ...(typeof face === "number" ? { face } : {}),
        lod: readCoordinate("lod"),
        x: readCoordinate("x"),
        y: readCoordinate("y"),
    };
}

/** ECEF centre of a region, at the middle of its height interval. */
export function regionCenter(region: readonly number[]): Vector3 {
    const [west, south, east, north, minimumHeight, maximumHeight] = region;
    if (
        west === undefined ||
        south === undefined ||
        east === undefined ||
        north === undefined ||
        minimumHeight === undefined ||
        maximumHeight === undefined
    )
        throw new RangeError("The 3D Tiles region is incomplete.");

    const center = GeodeticSystem.WGS84.geodeticRadiansToEcef((south + north) / 2, (west + east) / 2, (minimumHeight + maximumHeight) / 2);
    return new Vector3(center.x, center.y, center.z);
}
