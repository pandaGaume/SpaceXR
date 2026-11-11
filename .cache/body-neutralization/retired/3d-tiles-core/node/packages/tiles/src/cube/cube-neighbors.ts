import { assertValidTileAddress, tileCount, type ITileAddress } from "../addressing/tile-address";
import { TILE_CORNER_EDGES, TileNeighbor, tileNeighborOffset, type TileCornerNeighbor, type TileEdgeNeighbor } from "../addressing/tile-neighbors";
import type { ITileAreaAcross, ITileTopology } from "../addressing/tile-topology";
import { CubeFace } from "./cube-face";

/** Edges in quarter-turn order, as used by {@link turnTileEdge}. */
const EDGE_ORDER: readonly TileEdgeNeighbor[] = [TileNeighbor.N, TileNeighbor.E, TileNeighbor.S, TileNeighbor.W];

/** Edge of the neighbouring face met by an edge of a face. */
export interface ICubeEdgeJunction {
    /** Neighbouring face. */
    readonly face: CubeFace;
    /** Edge of the neighbouring face. */
    readonly edge: TileEdgeNeighbor;
    /** `true` when the coordinate along the edge runs the other way on the neighbouring face. */
    readonly reversed: boolean;
    /**
     * Quarter turns from the frame of the face to the frame of its neighbour: a direction `d` of the face is
     * `turnTileEdge(d, turns)` on the neighbour. Equatorial faces join with 0.
     */
    readonly turns: number;
}

/**
 * Turns an edge, or the direction toward it, by quarter turns in the order `N`, `E`, `S`, `W`. With the `turns` of a
 * junction, it maps a direction of a tile to the same direction seen from its neighbour.
 */
export function turnTileEdge(edge: TileEdgeNeighbor, turns: number): TileEdgeNeighbor {
    const index = EDGE_ORDER.indexOf(edge);
    if (index < 0) throw new RangeError(`${TileNeighbor[edge] ?? edge} is not an edge.`);
    return EDGE_ORDER[(((index + turns) % 4) + 4) % 4]!;
}

/** Edge on the other side of a tile. */
export function oppositeTileEdge(edge: TileEdgeNeighbor): TileEdgeNeighbor {
    return turnTileEdge(edge, 2);
}

const { N, E, S, W } = TileNeighbor;
/** Neighbouring face, its edge and the reversal, for the edges N, E, S, W of each face; see `docs/celestial-tiling.md`. */
const EDGE_TABLE: ReadonlyArray<
    readonly [
        readonly [CubeFace, TileEdgeNeighbor, boolean],
        readonly [CubeFace, TileEdgeNeighbor, boolean],
        readonly [CubeFace, TileEdgeNeighbor, boolean],
        readonly [CubeFace, TileEdgeNeighbor, boolean],
    ]
> = [
    [
        [4, S, false],
        [1, W, false],
        [5, N, false],
        [3, E, false],
    ],
    [
        [4, E, true],
        [2, W, false],
        [5, E, false],
        [0, E, false],
    ],
    [
        [4, N, true],
        [3, W, false],
        [5, S, true],
        [1, E, false],
    ],
    [
        [4, W, false],
        [0, W, false],
        [5, W, true],
        [2, E, false],
    ],
    [
        [2, N, true],
        [1, N, true],
        [0, N, false],
        [3, N, false],
    ],
    [
        [0, S, false],
        [1, S, false],
        [2, S, true],
        [3, S, true],
    ],
];

/**
 * Junctions of the faces of the cube index, indexed by face then edge. The neighbour's edge is the opposite of the
 * face's edge turned by `turns`.
 */
export const CUBE_FACE_EDGES: ReadonlyArray<Readonly<Record<TileEdgeNeighbor, ICubeEdgeJunction>>> = Object.freeze(
    EDGE_TABLE.map((row) => {
        const junctions = {} as Record<TileEdgeNeighbor, ICubeEdgeJunction>;
        row.forEach(([face, edge, reversed], index) => {
            const own = EDGE_ORDER[index]!;
            const turns = (EDGE_ORDER.indexOf(oppositeTileEdge(edge)) - index + 4) % 4;
            junctions[own] = Object.freeze({ face, edge, reversed, turns });
        });
        return Object.freeze(junctions);
    })
);

/** Neighbour of a tile of the cube index, with the turns from the frame of the tile to the frame of the neighbour. */
export interface ICubeTileNeighbor {
    readonly address: ITileAddress;
    /** Quarter turns, as {@link ICubeEdgeJunction.turns}; 0 on the same face. */
    readonly turns: number;
}

/** Tile across an edge of the face at position `k` along that edge, at a level of `count` tiles per axis. */
function acrossFaceEdge(face: CubeFace, edge: TileEdgeNeighbor, k: number, lod: number, count: number): ICubeTileNeighbor {
    const junction = CUBE_FACE_EDGES[face]![edge];
    const along = junction.reversed ? count - 1 - k : k;
    let x = along;
    let y = along;
    if (junction.edge === TileNeighbor.N) y = 0;
    else if (junction.edge === TileNeighbor.S) y = count - 1;
    else if (junction.edge === TileNeighbor.W) x = 0;
    else x = count - 1;
    return { address: { face: junction.face, lod, x, y }, turns: junction.turns };
}

/**
 * Neighbour of a tile of the cube index at the same level, across the faces when needed.
 *
 * A corner neighbour is reached by crossing one of its two edges. At the 8 vertices of the cube only 3 tiles meet:
 * the corner neighbour there does not exist and the result is `undefined`.
 *
 * @param address - Tile of the cube index; a missing face means face 0.
 * @param neighbor - Position around the tile; `C` returns the tile itself.
 * @throws RangeError When the address is invalid.
 */
export function cubeTileNeighbor(address: ITileAddress, neighbor: TileNeighbor): ICubeTileNeighbor | undefined {
    assertValidTileAddress(address);
    const face: CubeFace = address.face ?? CubeFace.PositiveX;
    const { lod } = address;
    const count = tileCount(lod);
    const [dx, dy] = tileNeighborOffset(neighbor);
    const x = address.x + dx;
    const y = address.y + dy;
    const outX = x < 0 || x >= count;
    const outY = y < 0 || y >= count;
    if (outX && outY) return undefined;
    if (!outX && !outY) return { address: { face, lod, x, y }, turns: 0 };
    if (outY) return acrossFaceEdge(face, y < 0 ? TileNeighbor.N : TileNeighbor.S, x, lod, count);
    return acrossFaceEdge(face, x < 0 ? TileNeighbor.W : TileNeighbor.E, y, lod, count);
}

/** Returns the nine neighbours in {@link TileNeighbor} order, the tile itself at `TileNeighbor.C`. */
export function cubeTileNeighbors(address: ITileAddress): Array<ICubeTileNeighbor | undefined> {
    return Array.from({ length: 9 }, (_, neighbor) => cubeTileNeighbor(address, neighbor));
}

/**
 * Number of tiles meeting at a corner of a tile: 3 at the vertices of the cube, 4 elsewhere.
 *
 * @throws RangeError When the address is invalid.
 */
export function cubeCornerTileCount(address: ITileAddress, corner: TileCornerNeighbor): 3 | 4 {
    assertValidTileAddress(address);
    const count = tileCount(address.lod);
    const [vertical, horizontal] = TILE_CORNER_EDGES[corner];
    const onRow = vertical === TileNeighbor.N ? address.y === 0 : address.y === count - 1;
    const onColumn = horizontal === TileNeighbor.W ? address.x === 0 : address.x === count - 1;
    return onRow && onColumn ? 3 : 4;
}

/** Corner of a tile that `turnedTileCoordinates` sends to `(0, 0)`, per number of quarter turns. */
const TURNED_ORIGIN: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
];

/**
 * Area of a tile of the cube index in another tile, across at most one face edge; see {@link ITileAreaAcross}.
 *
 * The neighbouring face is unfolded around the edge the two faces share, a rigid motion, so the points of that edge
 * land exactly on the same directions.
 *
 * @throws RangeError When an address is invalid or the tiles lie on opposite faces.
 */
export function cubeTileAreaIn(address: ITileAddress, other: ITileAddress): ITileAreaAcross {
    assertValidTileAddress(address);
    assertValidTileAddress(other);
    const face: CubeFace = address.face ?? 0;
    const otherFace: CubeFace = other.face ?? 0;
    const scale = 2 ** (address.lod - other.lod);
    const size = 1 / scale;
    if (face === otherFace) return { west: address.x / scale - other.x, north: address.y / scale - other.y, size, turns: 0 };

    const edge = EDGE_ORDER.find((candidate) => CUBE_FACE_EDGES[face]![candidate].face === otherFace);
    if (edge === undefined) throw new RangeError(`Faces ${face} and ${otherFace} are opposite: their tiles cannot touch.`);
    const junction = CUBE_FACE_EDGES[face]![edge];
    // The corner of the tile at the origin of the turned frame.
    const [cornerU, cornerV] = TURNED_ORIGIN[junction.turns]!;
    const count = tileCount(address.lod);
    const u = (address.x + cornerU) / count;
    const v = (address.y + cornerV) / count;
    const along = edge === TileNeighbor.N || edge === TileNeighbor.S ? u : v;
    const beyond = edge === TileNeighbor.N ? -v : edge === TileNeighbor.S ? v - 1 : edge === TileNeighbor.W ? -u : u - 1;
    const alongOther = junction.reversed ? 1 - along : along;
    let otherU = alongOther;
    let otherV = alongOther;
    if (junction.edge === TileNeighbor.N) otherV = beyond;
    else if (junction.edge === TileNeighbor.S) otherV = 1 - beyond;
    else if (junction.edge === TileNeighbor.W) otherU = beyond;
    else otherU = 1 - beyond;
    const otherCount = tileCount(other.lod);
    return { west: otherU * otherCount - other.x, north: otherV * otherCount - other.y, size, turns: junction.turns };
}

/** Topology of the cube index: neighbours across faces, turned, and corners of 3 tiles. */
export const CUBE_TILE_TOPOLOGY: ITileTopology = Object.freeze({ neighbor: cubeTileNeighbor, areaIn: cubeTileAreaIn });
