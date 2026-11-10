import type { IGridTopology } from "./grid-topology";

/**
 * Vertex passed to the initializers, as the `column, row, w, h` arguments of the SpaceXR initializers. `column` and
 * `row` are half-integers on the edge midpoints added for finer neighbours.
 */
export interface IGridVertex {
    /** Normalized coordinate, west to east. */
    readonly u: number;
    /** Normalized coordinate, north to south. */
    readonly v: number;
    /** `u * columns`. */
    readonly column: number;
    /** `v * rows`. */
    readonly row: number;
    readonly columns: number;
    readonly rows: number;
}

/** Options of {@link buildGridVertices}, ported from the SpaceXR `TerrainNormalizedGridBuilder`. */
export interface IGridVertexOptions {
    /** Width of the grid along X. Defaults to 1. A negative scale mirrors the grid, for example for a left-handed scene. */
    scaleX?: number;
    /** Height of the grid along Y. Defaults to `scaleX`. */
    scaleY?: number;
    /** Shift of the grid along X, in columns. Defaults to 0. */
    offsetColumns?: number;
    /** Shift of the grid along Y, in rows. Defaults to 0. */
    offsetRows?: number;
    /** Z of each vertex, for example its elevation. Defaults to 0. */
    zInitializer?: (vertex: IGridVertex) => number;
    /** Texture coordinates of each vertex. Defaults to `u, v`, with `v` growing southward. */
    uvInitializer?: (vertex: IGridVertex) => readonly [number, number];
    /** Emits texture coordinates. Defaults to false. */
    uvs?: boolean;
    /** Emits flat normals along the height axis. Defaults to false. */
    normals?: boolean;
    /** Puts heights on Y and the grid in the XZ plane, as in Y-up engines. Defaults to false. */
    invertYZ?: boolean;
    /** Reverses the winding of every triangle, for example after mirroring or swapping axes. Defaults to false. */
    invertIndices?: boolean;
}

/** Vertex buffers of a grid, ready for an engine mesh. */
export interface IGridVertexData {
    /** `x, y, z` triples. */
    positions: Float32Array;
    /** `x, y, z` triples, present when requested. */
    normals?: Float32Array;
    /** `u, v` pairs, present when requested. */
    uvs?: Float32Array;
    indices: Uint32Array;
}

/**
 * Places a normalized topology in a local Cartesian frame centred on the grid: X grows eastward from `-scaleX / 2`,
 * Y grows northward from `-scaleY / 2` and Z carries the height.
 */
export function buildGridVertices(topology: IGridTopology, options: IGridVertexOptions = {}): IGridVertexData {
    const scaleX = options.scaleX ?? 1;
    const scaleY = options.scaleY ?? scaleX;
    const originX = -0.5 + (options.offsetColumns ?? 0) / topology.columns;
    const originY = 0.5 + (options.offsetRows ?? 0) / topology.rows;
    const vertexCount = topology.coordinates.length / 2;

    const positions = new Float32Array(vertexCount * 3);
    const uvs = options.uvs ? new Float32Array(vertexCount * 2) : undefined;
    const normals = options.normals ? new Float32Array(vertexCount * 3) : undefined;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        const u = topology.coordinates[vertex * 2]!;
        const v = topology.coordinates[vertex * 2 + 1]!;
        const location: IGridVertex = { u, v, column: u * topology.columns, row: v * topology.rows, columns: topology.columns, rows: topology.rows };
        const x = (originX + u) * scaleX;
        const y = (originY - v) * scaleY;
        const z = options.zInitializer ? options.zInitializer(location) : 0;
        positions.set(options.invertYZ ? [x, z, y] : [x, y, z], vertex * 3);
        if (uvs) uvs.set(options.uvInitializer ? options.uvInitializer(location) : [u, v], vertex * 2);
        if (normals) normals.set(options.invertYZ ? [0, 1, 0] : [0, 0, 1], vertex * 3);
    }

    const indices = Uint32Array.from(topology.indices);
    if (options.invertIndices) {
        for (let offset = 0; offset < indices.length; offset += 3) {
            const second = indices[offset + 1]!;
            indices[offset + 1] = indices[offset + 2]!;
            indices[offset + 2] = second;
        }
    }

    const data: IGridVertexData = { positions, indices };
    if (normals) data.normals = normals;
    if (uvs) data.uvs = uvs;
    return data;
}
