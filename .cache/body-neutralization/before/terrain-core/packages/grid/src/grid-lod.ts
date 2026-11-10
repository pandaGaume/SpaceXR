import { TILE_EDGE_NEIGHBORS, TileNeighbor, type ITileAddress, type TileEdgeNeighbor } from "@spacexr/tiles";

/** Level of detail of an edge neighbour, relative to the tile. Quadtree neighbours differ by at most one level. */
export enum NeighborLod {
    /** The neighbour is one level coarser: it has half as many segments along the shared edge. */
    Coarser = -1,
    Same = 0,
    /** The neighbour is one level finer: two neighbour tiles share the edge, with twice as many segments. */
    Finer = 1,
}

export const NEIGHBOR_LODS: readonly NeighborLod[] = [NeighborLod.Coarser, NeighborLod.Same, NeighborLod.Finer];

/** Neighbour level of detail on each edge of a tile, indexed by {@link TileNeighbor}. */
export type GridEdgeLods = Readonly<Record<TileEdgeNeighbor, NeighborLod>>;

export const SAME_EDGE_LODS: GridEdgeLods = {
    [TileNeighbor.N]: NeighborLod.Same,
    [TileNeighbor.E]: NeighborLod.Same,
    [TileNeighbor.S]: NeighborLod.Same,
    [TileNeighbor.W]: NeighborLod.Same,
};

/** Dense key in `[0, 80]` identifying one of the 81 combinations of edge levels, from the north clockwise. */
export function edgeLodsKey(lods: GridEdgeLods): number {
    return TILE_EDGE_NEIGHBORS.reduce((key, edge, index) => key + 3 ** index * (lods[edge] + 1), 0);
}

/**
 * Level of a neighbour relative to the tile, from their levels of detail.
 *
 * @throws RangeError When the levels differ by more than one: the tile selection must keep neighbours balanced.
 */
export function relativeNeighborLod(tileLod: number, neighborLod: number): NeighborLod {
    const difference = neighborLod - tileLod;
    if (difference < -1 || difference > 1 || !Number.isInteger(difference)) {
        throw new RangeError(`Neighbouring tiles at levels ${tileLod} and ${neighborLod} differ by more than one level.`);
    }
    return difference as NeighborLod;
}

/**
 * Edge levels of a tile from the level of the tiles displayed along each edge.
 *
 * @param tile - Address of the tile.
 * @param neighborLod - Level of detail displayed along an edge, or `undefined` beyond the pyramid or when nothing is
 *     displayed there, which keeps the edge unchanged.
 */
export function gridEdgeLods(tile: ITileAddress, neighborLod: (edge: TileEdgeNeighbor) => number | undefined): GridEdgeLods {
    const level = (edge: TileEdgeNeighbor): NeighborLod => {
        const lod = neighborLod(edge);
        return lod === undefined ? NeighborLod.Same : relativeNeighborLod(tile.lod, lod);
    };
    return {
        [TileNeighbor.N]: level(TileNeighbor.N),
        [TileNeighbor.E]: level(TileNeighbor.E),
        [TileNeighbor.S]: level(TileNeighbor.S),
        [TileNeighbor.W]: level(TileNeighbor.W),
    };
}
