import { GeodeticSystem } from "@spacexr/geodesy";
import type { IGridTopology } from "@spacexr/grid";
import type { ITileAddress, ITileSurface } from "@spacexr/tiles";

/** Unique Cartesian geometry produced for one geographic tile. */
export interface IEllipsoidTileGeometry {
    readonly positions: number[];
    readonly uvs: Float32Array;
    readonly indices: Uint32Array;
}

/** Options of {@link projectGridTopologyToEllipsoid}. */
export interface IProjectGridOptions {
    /**
     * Ellipsoidal height in metres at normalized tile coordinates. `NaN` falls
     * back to the region minimum height. Defaults to the region minimum height.
     */
    heightAt?: (u: number, v: number) => number;
    /**
     * Distribution of rows between the north and south edges. `geodetic`
     * interpolates latitude linearly; `mercator` interpolates the Web Mercator
     * ordinate, so rows line up with the pixel rows of a Web Mercator tile.
     * Defaults to `geodetic`.
     */
    latitudeInterpolation?: "geodetic" | "mercator";
}

/** Web Mercator ordinate of a latitude in radians. */
function mercatorOrdinate(latitude: number): number {
    return Math.log(Math.tan(Math.PI / 4 + latitude / 2));
}

/** Texture coordinates of a topology: `u` eastward and `1 - v` northward. */
export function gridUvs(topology: IGridTopology): Float32Array {
    const uvs = new Float32Array(topology.coordinates.length);
    for (let offset = 0; offset < uvs.length; offset += 2) {
        uvs[offset] = topology.coordinates[offset]!;
        uvs[offset + 1] = 1 - topology.coordinates[offset + 1]!;
    }
    return uvs;
}

/**
 * Projects a shared topology onto one geographic region of an ellipsoid.
 *
 * The region follows the 3D Tiles order
 * `[west, south, east, north, minimumHeight, maximumHeight]`, in radians and
 * metres. Each call returns unique positions because curvature and east-west
 * pinching depend on the region's latitude and longitude.
 */
export function projectGridTopologyToEllipsoid(
    topology: IGridTopology,
    region: readonly number[],
    system: GeodeticSystem = GeodeticSystem.WGS84,
    options: IProjectGridOptions = {},
): IEllipsoidTileGeometry {
    if (region.length < 6) throw new RangeError("A 3D Tiles region must contain six values.");

    const [west, south, east, north, minimumHeight] = region;
    if (west === undefined || south === undefined || east === undefined || north === undefined || minimumHeight === undefined)
        throw new RangeError("The 3D Tiles region is incomplete.");

    const mercator = options.latitudeInterpolation === "mercator";
    const northOrdinate = mercator ? mercatorOrdinate(north) : 0;
    const southOrdinate = mercator ? mercatorOrdinate(south) : 0;
    const positions = new Array<number>((topology.coordinates.length / 2) * 3);
    const scratch = { x: 0, y: 0, z: 0 };
    let positionOffset = 0;

    for (let coordinateOffset = 0; coordinateOffset < topology.coordinates.length; coordinateOffset += 2) {
        const u = topology.coordinates[coordinateOffset]!;
        const v = topology.coordinates[coordinateOffset + 1]!;
        const longitude = west + (east - west) * u;
        const latitude = mercator
            ? 2 * Math.atan(Math.exp(northOrdinate + (southOrdinate - northOrdinate) * v)) - Math.PI / 2
            : north + (south - north) * v;
        const sampledHeight = options.heightAt?.(u, v);
        const height = sampledHeight === undefined || Number.isNaN(sampledHeight) ? minimumHeight : sampledHeight;
        system.geodeticRadiansToEcef(latitude, longitude, height, scratch);
        positions[positionOffset++] = scratch.x;
        positions[positionOffset++] = scratch.y;
        positions[positionOffset++] = scratch.z;
    }

    return {
        positions,
        uvs: gridUvs(topology),
        indices: topology.indices,
    };
}

/**
 * Grid whose vertical scale can change without resampling the DEM.
 *
 * For an ellipsoidal height `h`, the ECEF position is exactly
 * `base + h * up`, where `base` lies on the ellipsoid and `up` is the
 * ellipsoid surface normal.
 */
export interface IElevatedGridGeometry {
    /** ECEF positions on the ellipsoid, three components per vertex. */
    readonly base: Float64Array;
    /** Unit ellipsoid normals, three components per vertex. */
    readonly up: Float64Array;
    /** Unscaled heights in metres; `NaN` when the DEM has no value. */
    readonly heights: Float32Array;
    readonly uvs: Float32Array;
    readonly indices: Uint32Array;
}

/** The lattice value of a stored coordinate, in double precision, so that both sides of an edge compute one point. */
function latticeCoordinate(coordinate: number, segments: number): number {
    return Math.round(coordinate * 2 * segments) / (2 * segments);
}

/** Places a topology on a tile of any surface and records its unscaled heights. */
export function projectElevatedGrid(
    topology: IGridTopology,
    address: ITileAddress,
    surface: ITileSurface,
    heightAt: (u: number, v: number) => number,
): IElevatedGridGeometry {
    const vertexCount = topology.coordinates.length / 2;
    const base = new Float64Array(vertexCount * 3);
    const up = new Float64Array(vertexCount * 3);
    const heights = new Float32Array(vertexCount);
    const point = { x: 0, y: 0, z: 0 };
    const normal = { x: 0, y: 0, z: 0 };
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        const u = latticeCoordinate(topology.coordinates[vertex * 2]!, topology.columns);
        const v = latticeCoordinate(topology.coordinates[vertex * 2 + 1]!, topology.rows);
        surface.point(address, u, v, 0, point);
        surface.up(address, u, v, normal);
        base.set([point.x, point.y, point.z], vertex * 3);
        up.set([normal.x, normal.y, normal.z], vertex * 3);
        heights[vertex] = heightAt(u, v);
    }
    return {
        base,
        up,
        heights,
        uvs: gridUvs(topology),
        indices: topology.indices,
    };
}

/**
 * Composes ECEF positions for a vertical scale. Missing heights use
 * `fallbackHeight`, which is not scaled.
 */
export function composeElevatedPositions(
    geometry: IElevatedGridGeometry,
    scale: number,
    fallbackHeight = 0,
    target: number[] = new Array<number>(geometry.base.length),
): number[] {
    for (let vertex = 0; vertex < geometry.heights.length; vertex++) {
        const height = geometry.heights[vertex]!;
        const offset = Number.isNaN(height) ? fallbackHeight : height * scale;
        for (let axis = 0; axis < 3; axis++) {
            const index = vertex * 3 + axis;
            target[index] = geometry.base[index]! + geometry.up[index]! * offset;
        }
    }
    return target;
}
