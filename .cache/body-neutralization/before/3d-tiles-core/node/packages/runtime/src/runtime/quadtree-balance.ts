import {
    TILE_CORNER_NEIGHBORS,
    TILE_EDGE_NEIGHBORS,
    ancestorTileAddress,
    tileAddressKey,
    tileNeighborAddress,
    type ITileTopology,
    type TileEdgeNeighbor,
} from "@spacexr/tiles";

import type { ITileAddress } from "../implicit/tile-data-source";

/** Address of a quadtree tile within a namespace: one implicit tileset, or a pyramid shared by several. */
export interface IQuadtreeTileLocation {
    /** Prefix shared by the tiles that can be neighbours. */
    namespace: string;
    address: ITileAddress;
    /** Wraps columns around the antimeridian, for pyramids covering every longitude. */
    wrapX: boolean;
    /** How the tiles connect, for example across the faces of the cube index, in place of `wrapX`. */
    topology?: ITileTopology;
}

/** Neighbour of a located tile across an edge. */
function edgeNeighbor(location: IQuadtreeTileLocation, edge: TileEdgeNeighbor): ITileAddress | undefined {
    const { address, topology, wrapX } = location;
    return topology ? topology.neighbor(address, edge)?.address : tileNeighborAddress(address, edge, { wrapX });
}

export function quadtreeTileKey(namespace: string, address: ITileAddress): string {
    return `${namespace}${tileAddressKey(address)}`;
}

/**
 * Whether a tile is the neighbour of one of some tiles: it touches one of them, by an edge or a corner, that is at its
 * level or coarser. A tile coarser than the one it touches is not its neighbour.
 *
 * @param location - The tile.
 * @param tiles - Keys built with {@link quadtreeTileKey}.
 */
export function quadtreeTouches(location: IQuadtreeTileLocation, tiles: ReadonlySet<string>): boolean {
    if (tiles.size === 0) return false;
    const { address, namespace, topology, wrapX } = location;
    for (const position of [...TILE_EDGE_NEIGHBORS, ...TILE_CORNER_NEIGHBORS]) {
        const neighbor = topology ? topology.neighbor(address, position)?.address : tileNeighborAddress(address, position, { wrapX });
        if (!neighbor) continue;
        if (tiles.has(quadtreeTileKey(namespace, neighbor))) return true;
        for (let levels = 1; levels <= neighbor.lod; levels++) {
            if (tiles.has(quadtreeTileKey(namespace, ancestorTileAddress(neighbor, levels)))) return true;
        }
    }
    return false;
}

/** A displayed tile next to a displayed tile two or more levels coarser. */
export interface IQuadtreeImbalance<T> {
    fine: T;
    /** Level of the coarser neighbour. */
    coarseLod: number;
}

/**
 * Pairs of displayed tiles sharing an edge whose levels differ by two or more, reported from the finer tile.
 *
 * @param displayed - Displayed tiles with their location and a value returned in the result.
 */
export function quadtreeImbalances<T>(displayed: Iterable<{ location: IQuadtreeTileLocation; value: T }>): IQuadtreeImbalance<T>[] {
    const entries = [...displayed];
    const keys = new Set(entries.map(({ location }) => quadtreeTileKey(location.namespace, location.address)));
    const imbalances: IQuadtreeImbalance<T>[] = [];
    for (const { location, value } of entries) {
        const { namespace } = location;
        let coarseLod: number | undefined;
        for (const edge of TILE_EDGE_NEIGHBORS) {
            const neighbor = edgeNeighbor(location, edge);
            if (!neighbor) continue;
            for (let levels = 2; levels <= neighbor.lod; levels++) {
                const ancestor = ancestorTileAddress(neighbor, levels);
                if (!keys.has(quadtreeTileKey(namespace, ancestor))) continue;
                coarseLod = Math.min(coarseLod ?? ancestor.lod, ancestor.lod);
                break;
            }
        }
        if (coarseLod !== undefined) imbalances.push({ fine: value, coarseLod });
    }
    return imbalances;
}

/**
 * Tiles that must refine so that every displayed tile has its edge neighbours within one level of detail (2:1
 * balance). For each displayed tile of level `L` and each edge neighbour at level `L`, every ancestor of that
 * neighbour at level `L - 2` or coarser must refine: such an ancestor would otherwise be displayed next to the tile,
 * two or more levels apart. Diagonal neighbours do not matter, because tile corners exist at every level.
 *
 * @returns Keys built with {@link quadtreeTileKey}.
 */
export function quadtreeBalanceRefinements(displayed: Iterable<IQuadtreeTileLocation>): Set<string> {
    const refinements = new Set<string>();
    for (const location of displayed) {
        const { namespace, address } = location;
        if (address.lod < 2) continue;
        for (const edge of TILE_EDGE_NEIGHBORS) {
            const neighbor = edgeNeighbor(location, edge);
            if (!neighbor) continue;
            for (let levels = 2; levels <= neighbor.lod; levels++) {
                const key = quadtreeTileKey(namespace, ancestorTileAddress(neighbor, levels));
                // Coarser ancestors were added together with this one by an earlier tile.
                if (refinements.has(key)) break;
                refinements.add(key);
            }
        }
    }
    return refinements;
}

/** A leaf of a ready quadtree cut. */
export interface IQuadtreeCutTile<T> {
    location: IQuadtreeTileLocation;
    value: T;
}

/**
 * Admits a ready cut exclusively by refining incompatible coarse neighbours. Existing fine leaves never coarsen.
 * Each successful split strictly increases depth; only its front and the fine leaf return to the local queue.
 * A cold front is requested once, and makes the whole transaction inadmissible without publishing a partial cut.
 *
 * @param blocked - Receives, for each edge a cold front leaves two levels apart or more, the tiles of `displayed`
 * that led to it: the coarse tile, or the one it was split from, and the fine tile with every tile split for it.
 */
export function refineQuadtreeCut<T>(
    displayed: Iterable<IQuadtreeCutTile<T>>,
    refine: (coarse: IQuadtreeCutTile<T>) => readonly IQuadtreeCutTile<T>[] | undefined,
    blocked?: (involved: readonly IQuadtreeCutTile<T>[]) => void,
): IQuadtreeCutTile<T>[] | undefined {
    const leaves = new Map<string, IQuadtreeCutTile<T>>();
    const queue: IQuadtreeCutTile<T>[] = [];
    const unavailable = new Set<string>();
    // The tiles of the input each leaf comes from: itself, or the tiles whose splits produced it.
    const origins = new Map<IQuadtreeCutTile<T>, readonly IQuadtreeCutTile<T>[]>();
    const keyOf = ({ location }: IQuadtreeCutTile<T>): string => quadtreeTileKey(location.namespace, location.address);
    for (const tile of displayed) {
        leaves.set(keyOf(tile), tile);
        queue.push(tile);
        origins.set(tile, [tile]);
    }
    const involved = (fine: IQuadtreeCutTile<T>, coarse: IQuadtreeCutTile<T>): IQuadtreeCutTile<T>[] => [
        ...new Set([...origins.get(fine)!, ...origins.get(coarse)!]),
    ];
    const covering = (namespace: string, address: ITileAddress): IQuadtreeCutTile<T> | undefined => {
        for (let levels = 0; levels <= address.lod; levels++) {
            const tile = leaves.get(quadtreeTileKey(namespace, levels === 0 ? address : ancestorTileAddress(address, levels)));
            if (tile) return tile;
        }
        return undefined;
    };
    while (queue.length > 0) {
        const fine = queue.pop()!;
        if (leaves.get(keyOf(fine)) !== fine) continue;
        let coarse: IQuadtreeCutTile<T> | undefined;
        for (const edge of TILE_EDGE_NEIGHBORS) {
            const neighbor = edgeNeighbor(fine.location, edge);
            if (!neighbor) continue;
            const other = covering(fine.location.namespace, neighbor);
            if (other && other.location.address.lod < fine.location.address.lod - 1) {
                coarse = other;
                break;
            }
        }
        if (!coarse) continue;
        if (unavailable.has(keyOf(coarse))) {
            blocked?.(involved(fine, coarse));
            continue;
        }
        const front = refine(coarse);
        if (!front) {
            unavailable.add(keyOf(coarse));
            blocked?.(involved(fine, coarse));
            continue;
        }
        const keys = new Set(front.map(keyOf));
        if (keys.size !== front.length) throw new Error("A quadtree refinement front cannot contain duplicate leaves.");
        for (const child of front) {
            const { namespace, address } = child.location;
            const difference = address.lod - coarse.location.address.lod;
            if (
                difference <= 0 ||
                namespace !== coarse.location.namespace ||
                quadtreeTileKey(namespace, ancestorTileAddress(address, difference)) !== keyOf(coarse)
            )
                throw new Error("A quadtree refinement must return strict descendants of the coarse leaf in its namespace.");
            for (let levels = 1; levels < difference; levels++) {
                if (keys.has(quadtreeTileKey(namespace, ancestorTileAddress(address, levels))))
                    throw new Error("A quadtree refinement front cannot overlap itself.");
            }
        }
        leaves.delete(keyOf(coarse));
        const origin = involved(fine, coarse);
        for (const child of front) {
            leaves.set(keyOf(child), child);
            queue.push(child);
            origins.set(child, origin);
        }
        queue.push(fine);
    }
    return unavailable.size === 0 ? [...leaves.values()] : undefined;
}
