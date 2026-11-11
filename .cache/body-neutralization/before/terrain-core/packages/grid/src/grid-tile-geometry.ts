import type { ICartesian3, ITileAddress, ITileSurface } from "@spacexr/tiles";

import type { IGridTopology } from "./grid-topology";
import type { IGridVertex } from "./grid-vertices";

/** Options of {@link buildGridTileGeometry}. */
export interface IGridTileGeometryOptions {
    /** Height of each vertex in metres, along the up vector of the surface. Defaults to 0. */
    heightInitializer?: (vertex: IGridVertex) => number;
}

/** A grid placed on a tile of a body. Distances within a tile keep 32-bit floats precise. */
export interface IGridTileGeometry {
    /** Centre of the tile on the reference surface, body-fixed, in double precision. */
    center: ICartesian3;
    /** `x, y, z` triples relative to {@link center}, along the body-fixed axes, in metres. */
    positions: Float32Array;
    /** `x, y, z` unit vectors along which heights move each vertex, along the body-fixed axes. */
    ups: Float32Array;
    indices: Uint32Array;
}

/**
 * The lattice value of a stored coordinate, in double precision. Vertices of a shared edge are then computed from the
 * same parameter on both sides, whatever the number of segments.
 */
function latticeCoordinate(coordinate: number, segments: number): number {
    return Math.round(coordinate * 2 * segments) / (2 * segments);
}

/**
 * Places a normalized topology on a tile of a body, on the CPU. Triangles keep their winding: counter-clockwise seen
 * from outside the body.
 *
 * @param topology - Grid of the tile, `u` along the tile `x` axis and `v` along its `y` axis.
 * @param address - Tile to cover.
 * @param surface - Surface of the tiles, which holds the projection.
 * @throws RangeError When the address does not belong to the surface.
 */
export function buildGridTileGeometry(topology: IGridTopology, address: ITileAddress, surface: ITileSurface, options: IGridTileGeometryOptions = {}): IGridTileGeometry {
    const center = surface.point(address, 0.5, 0.5);
    const vertexCount = topology.coordinates.length / 2;
    const positions = new Float32Array(vertexCount * 3);
    const ups = new Float32Array(vertexCount * 3);
    const point: ICartesian3 = { x: 0, y: 0, z: 0 };
    const up: ICartesian3 = { x: 0, y: 0, z: 0 };
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        const u = latticeCoordinate(topology.coordinates[vertex * 2]!, topology.columns);
        const v = latticeCoordinate(topology.coordinates[vertex * 2 + 1]!, topology.rows);
        const height = options.heightInitializer?.({ u, v, column: u * topology.columns, row: v * topology.rows, columns: topology.columns, rows: topology.rows }) ?? 0;
        surface.point(address, u, v, height, point);
        surface.up(address, u, v, up);
        positions[vertex * 3] = point.x - center.x;
        positions[vertex * 3 + 1] = point.y - center.y;
        positions[vertex * 3 + 2] = point.z - center.z;
        ups[vertex * 3] = up.x;
        ups[vertex * 3 + 1] = up.y;
        ups[vertex * 3 + 2] = up.z;
    }
    return { center, positions, ups, indices: topology.indices };
}

/**
 * Shape of a tile on the reference surface, in the frame shared by the tiles of the same {@link key}: a body-fixed
 * point of the tile is `center + Rz(rotation) * position`. A renderer uploads one shape per key and displaces it
 * with heights on the GPU.
 */
export interface IGridTileShape {
    /** Identifies the shape among the tiles of the surface. */
    key: string;
    /** Angle about the `Z` axis from the frame of the shape to the body-fixed frame of this tile, in radians. */
    rotation: number;
    /** Centre of this tile on the reference surface, body-fixed, in double precision. */
    center: ICartesian3;
    /** `x, y, z` triples relative to the centre, in the frame of the shape, in metres. `(cells + 1)^2` vertices, rows from north to south. */
    positions: Float32Array;
    /** `x, y, z` unit vectors along which heights move each vertex, in the frame of the shape. */
    ups: Float32Array;
}

/**
 * Builds the shape of a tile as a regular lattice of `cells x cells` cells.
 *
 * @param address - Tile whose shape is built.
 * @param surface - Surface of the tiles.
 * @param cells - Cells per side.
 * @throws RangeError When `cells` is not a positive integer or the address does not belong to the surface.
 */
export function buildGridTileShape(address: ITileAddress, surface: ITileSurface, cells: number): IGridTileShape {
    if (!Number.isInteger(cells) || cells < 1) throw new RangeError("Grid cells must be a positive integer.");
    const { key, rotation } = surface.shape(address);
    const center = surface.point(address, 0.5, 0.5);
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const side = cells + 1;
    const positions = new Float32Array(side * side * 3);
    const ups = new Float32Array(side * side * 3);
    const point: ICartesian3 = { x: 0, y: 0, z: 0 };
    const up: ICartesian3 = { x: 0, y: 0, z: 0 };
    for (let row = 0; row < side; row++) {
        for (let column = 0; column < side; column++) {
            const offset = (row * side + column) * 3;
            surface.point(address, column / cells, row / cells, 0, point);
            surface.up(address, column / cells, row / cells, up);
            const x = point.x - center.x;
            const y = point.y - center.y;
            positions[offset] = cosine * x + sine * y;
            positions[offset + 1] = cosine * y - sine * x;
            positions[offset + 2] = point.z - center.z;
            ups[offset] = cosine * up.x + sine * up.y;
            ups[offset + 1] = cosine * up.y - sine * up.x;
            ups[offset + 2] = up.z;
        }
    }
    return { key, rotation, center, positions, ups };
}
