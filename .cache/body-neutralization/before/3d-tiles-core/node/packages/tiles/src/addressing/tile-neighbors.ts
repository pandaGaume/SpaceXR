import { tileCount, type ITileAddress } from "./tile-address";

/**
 * Position around a tile, as the SpaceXR `NeighborsIndex`. The values follow the 3 x 3 layout row-major from the
 * north-west, with the tile itself at the centre:
 *
 * ```text
 * NW N NE      0 1 2
 * W  C  E      3 4 5
 * SW S SE      6 7 8
 * ```
 */
export enum TileNeighbor {
    NW = 0,
    N = 1,
    NE = 2,
    W = 3,
    C = 4,
    E = 5,
    SW = 6,
    S = 7,
    SE = 8,
}

/** Neighbours sharing an edge with the tile. */
export type TileEdgeNeighbor = TileNeighbor.N | TileNeighbor.E | TileNeighbor.S | TileNeighbor.W;

/** Neighbours sharing only a corner with the tile. */
export type TileCornerNeighbor = TileNeighbor.NW | TileNeighbor.NE | TileNeighbor.SE | TileNeighbor.SW;

/** Edge neighbours, clockwise from the north. */
export const TILE_EDGE_NEIGHBORS: readonly TileEdgeNeighbor[] = [TileNeighbor.N, TileNeighbor.E, TileNeighbor.S, TileNeighbor.W];

/** Corner neighbours, clockwise from the north-west. */
export const TILE_CORNER_NEIGHBORS: readonly TileCornerNeighbor[] = [TileNeighbor.NW, TileNeighbor.NE, TileNeighbor.SE, TileNeighbor.SW];

/** The two edges meeting at each corner, north or south first. */
export const TILE_CORNER_EDGES: Readonly<Record<TileCornerNeighbor, readonly [TileEdgeNeighbor, TileEdgeNeighbor]>> = {
    [TileNeighbor.NW]: [TileNeighbor.N, TileNeighbor.W],
    [TileNeighbor.NE]: [TileNeighbor.N, TileNeighbor.E],
    [TileNeighbor.SE]: [TileNeighbor.S, TileNeighbor.E],
    [TileNeighbor.SW]: [TileNeighbor.S, TileNeighbor.W],
};

/** Column and row offsets of each neighbour, in XYZ axes: `x` eastward, `y` southward. */
export function tileNeighborOffset(neighbor: TileNeighbor): readonly [number, number] {
    return [(neighbor % 3) - 1, Math.floor(neighbor / 3) - 1];
}

export interface ITileNeighborOptions {
    /** Wraps columns around the antimeridian, for pyramids covering every longitude. Defaults to false. */
    wrapX?: boolean;
}

/**
 * Returns the neighbour at the same level of detail, or `undefined` beyond the pyramid. Rows never wrap: there is no
 * tile north of the first row or south of the last one. The face is kept; neighbours across the faces of the cube
 * index are given by `cubeTileNeighbor`.
 */
export function tileNeighborAddress(address: ITileAddress, neighbor: TileNeighbor, options: ITileNeighborOptions = {}): ITileAddress | undefined {
    const [dx, dy] = tileNeighborOffset(neighbor);
    const count = tileCount(address.lod);
    let x = address.x + dx;
    const y = address.y + dy;
    if (y < 0 || y >= count) return undefined;
    if (options.wrapX) x = ((x % count) + count) % count;
    else if (x < 0 || x >= count) return undefined;
    return address.face === undefined ? { lod: address.lod, x, y } : { face: address.face, lod: address.lod, x, y };
}

/** Returns the nine addresses of {@link TileNeighbor} order, the tile itself at `TileNeighbor.C`. */
export function tileNeighborAddresses(address: ITileAddress, options: ITileNeighborOptions = {}): Array<ITileAddress | undefined> {
    return Array.from({ length: 9 }, (_, neighbor) => tileNeighborAddress(address, neighbor, options));
}
