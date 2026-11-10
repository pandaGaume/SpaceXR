import {
    childTileAddresses,
    flatTileTopology,
    oppositeTileEdge,
    parentTileAddress,
    TILE_CORNER_EDGES,
    TILE_CORNER_NEIGHBORS,
    tileAddressKey as key,
    TileNeighbor,
    turnTileEdge,
    type ITileAddress,
    type ITileTopology,
    type TileCornerNeighbor,
    type TileEdgeNeighbor,
} from "@spacexr/tiles";

/** Edges of a drape instance, as bits of {@link IDrapeInstance.coarserEdges} and {@link IDrapeInstance.finerEdges}. */
export const DrapeInstanceEdge = {
    N: 1,
    E: 2,
    S: 4,
    W: 8,
} as const;

/** Four terrain tiles, one per edge or per corner of an instance. */
export type DrapeInstanceTerrains = readonly [ITileAddress, ITileAddress, ITileAddress, ITileAddress];

/** One instance of the shared grid: a tile of the instance cut. */
export interface IDrapeInstance {
    /** Tile drawn by the instance. */
    address: ITileAddress;
    /** Presented terrain tile containing it, whose DEM tile gives its elevation. */
    terrain: ITileAddress;
    /** Level of the data of its terrain tile; see {@link IDrapeInstanceCutOptions.terrainDataLevel}. */
    terrainLevel: number;
    /** Edges whose neighbour instance is one level coarser, a combination of {@link DrapeInstanceEdge} bits. */
    coarserEdges: number;
    /** Edges whose neighbour instances are one level finer, a combination of {@link DrapeInstanceEdge} bits. */
    finerEdges: number;
    /**
     * Terrain tile whose DEM gives the heights along each edge, in N, E, S, W order: the coarsest terrain tile among
     * the instance and the instances across the edge, the instance's own on ties. Both sides of an edge then read the
     * same heights.
     */
    edgeTerrain: DrapeInstanceTerrains;
    /** Terrain tile whose DEM gives the height of each corner, in NW, NE, SE, SW order, chosen like `edgeTerrain`. */
    cornerTerrain: DrapeInstanceTerrains;
}

export interface IDrapeInstanceCutOptions {
    /** Deepest instance, in levels below its terrain tile. Defaults to 6. */
    maxDepth?: number;
    /**
     * Time a level below a terrain tile stays in the cut after the imagery cut stopped reaching it, in milliseconds,
     * so that the transient cuts of a replacement, or a cut coarsening for a moment while the camera turns, do not
     * flash coarser imagery. Defaults to 500.
     */
    holdMilliseconds?: number;
    /** Wraps columns around the antimeridian, when no `topology` is given. Defaults to true. */
    wrapX?: boolean;
    /** How the tiles connect, for example across the faces of the cube index. Defaults to a pyramid with one root. */
    topology?: ITileTopology;
    /**
     * Level of the data of a terrain tile, for elevation whose depth varies from place to place: both sides of an edge then
     * read the coarsest data, not only the coarsest tile. Defaults to the level of the tile.
     */
    terrainDataLevel?: (terrain: ITileAddress) => number;
}

/** Children of a neighbour that touch the tile, in `childTileAddresses` order NW, NE, SW, SE. */
const CHILDREN_FACING: Readonly<Record<TileEdgeNeighbor, readonly [number, number]>> = {
    [TileNeighbor.N]: [2, 3],
    [TileNeighbor.E]: [0, 2],
    [TileNeighbor.S]: [0, 1],
    [TileNeighbor.W]: [1, 3],
};

const EDGES: readonly [TileEdgeNeighbor, number][] = [
    [TileNeighbor.N, DrapeInstanceEdge.N],
    [TileNeighbor.E, DrapeInstanceEdge.E],
    [TileNeighbor.S, DrapeInstanceEdge.S],
    [TileNeighbor.W, DrapeInstanceEdge.W],
];

/** Child of a tile in the direction of two edges, one north or south and one east or west, in any order. */
function childToward(first: TileEdgeNeighbor, second: TileEdgeNeighbor): number {
    const east = first === TileNeighbor.E || second === TileNeighbor.E;
    const south = first === TileNeighbor.S || second === TileNeighbor.S;
    return (east ? 1 : 0) + (south ? 2 : 0);
}

function createInstance(address: ITileAddress, terrain: ITileAddress, terrainLevel: number): IDrapeInstance {
    return {
        address,
        terrain,
        terrainLevel,
        coarserEdges: 0,
        finerEdges: 0,
        edgeTerrain: [terrain, terrain, terrain, terrain],
        cornerTerrain: [terrain, terrain, terrain, terrain],
    };
}

/**
 * Tiles completing a cut into a cover of its roots: the root of an area no tile of the cut reaches, or the child of a
 * tile above the cut no tile of the cut reaches. They do not overlap the cut or each other. A renderer draws them where
 * the selection, computed for a camera that has since moved, left no tile: coarse terrain instead of a hole.
 *
 * @param cut - Tiles of the cut, which do not overlap.
 * @param roots - Roots of the pyramid, such as the six faces of the cube index.
 * @param isAvailable - Whether a tile can be drawn; an area without an available tile stays uncovered.
 */
export function completeTileCover(cut: Iterable<ITileAddress>, roots: readonly ITileAddress[], isAvailable: (address: ITileAddress) => boolean): ITileAddress[] {
    const leaves = new Set<string>();
    const inner = new Map<string, ITileAddress>();
    for (const tile of cut) {
        leaves.add(key(tile));
        for (let ancestor = parentTileAddress(tile); ancestor; ancestor = parentTileAddress(ancestor)) {
            const ancestorKey = key(ancestor);
            if (inner.has(ancestorKey)) break;
            inner.set(ancestorKey, ancestor);
        }
    }
    const fill: ITileAddress[] = [];
    const add = (tile: ITileAddress): void => {
        const tileKey = key(tile);
        if (!leaves.has(tileKey) && !inner.has(tileKey) && isAvailable(tile)) fill.push(tile);
    };
    for (const root of roots) add(root);
    for (const tile of inner.values()) for (const child of childTileAddresses(tile)) add(child);
    return fill;
}

/**
 * The instance cut of GPU draping: the leaves of the union of the terrain cut and the imagery cut, balanced so that
 * every edge joins instances at most one level apart.
 *
 * Inside each presented terrain tile, the imagery tiles of the cut below it become instances, completed with the
 * tiles needed to cover the terrain tile without overlap; a terrain tile without finer imagery is one instance. A
 * level below a terrain tile stays for `holdMilliseconds` after the imagery cut stopped reaching it. Leaves whose edge
 * neighbour is subdivided two levels deeper or more are split until the cut is balanced. Each instance then knows
 * the level of its neighbours across each edge and the terrain tile whose DEM gives the heights of each edge and
 * corner, so that neighbouring instances join without cracks.
 */
export class DrapeInstanceCut {
    public readonly maxDepth: number;
    public readonly holdMilliseconds: number;
    private readonly topology: ITileTopology;
    private readonly terrainDataLevel: (terrain: ITileAddress) => number;
    /** Tiles with imagery below them, by the last time the imagery cut reached below them. */
    private readonly subdivided = new Map<string, number>();
    private expiry: number | undefined;

    public constructor(options: IDrapeInstanceCutOptions = {}) {
        this.maxDepth = options.maxDepth ?? 6;
        if (!Number.isInteger(this.maxDepth) || this.maxDepth < 0) throw new RangeError("The maximum instance depth must be a non-negative integer.");
        this.holdMilliseconds = Math.max(0, options.holdMilliseconds ?? 500);
        this.topology = options.topology ?? flatTileTopology({ wrapX: options.wrapX ?? true });
        this.terrainDataLevel = options.terrainDataLevel ?? ((terrain) => terrain.lod);
    }

    /** Time at which a held level leaves the cut, so that the cut must be computed again; `undefined` when none is held. */
    public get expiresAt(): number | undefined {
        return this.expiry;
    }

    /**
     * Computes the instances of the current cuts.
     *
     * @param terrainCut - Presented terrain tiles, which do not overlap.
     * @param imageryCut - Presented imagery tiles.
     * @param now - Current time in milliseconds, for the hold of coarsened levels.
     */
    public update(terrainCut: Iterable<ITileAddress>, imageryCut: Iterable<ITileAddress>, now: number): IDrapeInstance[] {
        this.recordImagery(imageryCut, now);
        const leaves = new Map<string, IDrapeInstance>();
        const split = (address: ITileAddress, terrain: ITileAddress, level: number): void => {
            if (address.lod - terrain.lod < this.maxDepth && this.subdivided.has(key(address))) {
                for (const child of childTileAddresses(address)) split(child, terrain, level);
                return;
            }
            leaves.set(key(address), createInstance(address, terrain, level));
        };
        for (const terrain of terrainCut) split({ ...terrain }, { ...terrain }, this.terrainDataLevel(terrain));
        const inner = this.balance(leaves);
        for (const leaf of leaves.values()) this.connect(leaf, leaves, inner);
        return [...leaves.values()];
    }

    /**
     * Connects a runtime-selected terrain cut without adding, splitting or balancing its tiles. Geometry selection
     * belongs to the runtime; imagery is sampled through page tables and cannot change this cut.
     */
    public connectTerrain(terrainCut: Iterable<ITileAddress>): IDrapeInstance[] {
        const leaves = new Map<string, IDrapeInstance>();
        const inner = new Set<string>();
        for (const terrain of terrainCut) {
            const address = { ...terrain };
            leaves.set(key(address), createInstance(address, address, this.terrainDataLevel(address)));
            for (let ancestor = parentTileAddress(address); ancestor; ancestor = parentTileAddress(ancestor)) {
                const ancestorKey = key(ancestor);
                if (inner.has(ancestorKey)) break;
                inner.add(ancestorKey);
            }
        }
        for (const leaf of leaves.values()) this.connect(leaf, leaves, inner);
        return [...leaves.values()];
    }

    /** Records the tiles the imagery cut reaches below, and forgets those whose hold elapsed. */
    private recordImagery(imageryCut: Iterable<ITileAddress>, now: number): void {
        for (const tile of imageryCut) {
            for (let ancestor = parentTileAddress(tile); ancestor; ancestor = parentTileAddress(ancestor)) {
                const ancestorKey = key(ancestor);
                // Ancestors already refreshed by another tile of this cut are refreshed up to the root.
                if (this.subdivided.get(ancestorKey) === now) break;
                this.subdivided.set(ancestorKey, now);
            }
        }
        this.expiry = undefined;
        for (const [tileKey, seen] of this.subdivided) {
            if (seen === now) continue;
            const expires = seen + this.holdMilliseconds;
            if (expires <= now) this.subdivided.delete(tileKey);
            else this.expiry = Math.min(this.expiry ?? expires, expires);
        }
    }

    /**
     * Splits the leaves whose edge neighbour is subdivided two levels deeper or more, until none is.
     *
     * @returns The strict ancestors of the leaves.
     */
    private balance(leaves: Map<string, IDrapeInstance>): Set<string> {
        const inner = new Set<string>();
        const addAncestors = (address: ITileAddress): void => {
            for (let ancestor = parentTileAddress(address); ancestor; ancestor = parentTileAddress(ancestor)) {
                const ancestorKey = key(ancestor);
                if (inner.has(ancestorKey)) return;
                inner.add(ancestorKey);
            }
        };
        for (const leaf of leaves.values()) addAncestors(leaf.address);

        const queue = [...leaves.values()];
        while (queue.length > 0) {
            const leaf = queue.pop()!;
            if (leaves.get(key(leaf.address)) !== leaf) continue;
            const deeper = EDGES.some(([edge]) => {
                const neighbor = this.topology.neighbor(leaf.address, edge);
                if (!neighbor) return false;
                const children = childTileAddresses(neighbor.address);
                return CHILDREN_FACING[turnTileEdge(edge, neighbor.turns)].some((index) => inner.has(key(children[index]!)));
            });
            if (!deeper) continue;
            leaves.delete(key(leaf.address));
            inner.add(key(leaf.address));
            for (const child of childTileAddresses(leaf.address)) {
                const instance = createInstance(child, leaf.terrain, leaf.terrainLevel);
                leaves.set(key(child), instance);
                queue.push(instance);
            }
            // Coarser neighbours may now be two levels from the new children.
            for (const [edge] of EDGES) {
                const neighbor = this.topology.neighbor(leaf.address, edge);
                const coarser = neighbor && this.leafContaining(neighbor.address, leaves);
                if (coarser) queue.push(coarser);
            }
        }
        return inner;
    }

    /** Records the levels of the neighbours of a leaf and the terrain tiles giving the heights of its edges and corners. */
    private connect(leaf: IDrapeInstance, leaves: ReadonlyMap<string, IDrapeInstance>, inner: ReadonlySet<string>): void {
        const { address } = leaf;
        const coarsest = (touching: readonly IDrapeInstance[]): ITileAddress =>
            touching.reduce((coarsestSoFar, other) => (other.terrainLevel < coarsestSoFar.terrainLevel ? other : coarsestSoFar), leaf).terrain;
        const edgeTerrain: ITileAddress[] = [];
        for (const [edge, bit] of EDGES) {
            const touching = this.acrossEdge(address, edge, leaves, inner);
            if (touching.some((other) => other.address.lod < address.lod)) leaf.coarserEdges |= bit;
            if (touching.some((other) => other.address.lod > address.lod)) leaf.finerEdges |= bit;
            edgeTerrain.push(coarsest(touching));
        }
        leaf.edgeTerrain = edgeTerrain as unknown as DrapeInstanceTerrains;
        leaf.cornerTerrain = TILE_CORNER_NEIGHBORS.map((corner) => coarsest(this.atCorner(address, corner, leaves, inner))) as unknown as DrapeInstanceTerrains;
    }

    /** Leaves across an edge of a tile: the neighbour, a coarser leaf containing it, or the finer leaves along the edge. */
    private acrossEdge(address: ITileAddress, edge: TileEdgeNeighbor, leaves: ReadonlyMap<string, IDrapeInstance>, inner: ReadonlySet<string>): IDrapeInstance[] {
        const neighbor = this.topology.neighbor(address, edge);
        if (!neighbor) return [];
        const coarser = this.leafContaining(neighbor.address, leaves);
        if (coarser) return [coarser];
        // The direction of the edge, seen from the neighbour.
        const facing = CHILDREN_FACING[turnTileEdge(edge, neighbor.turns)];
        const found: IDrapeInstance[] = [];
        const descend = (tile: ITileAddress): void => {
            const leaf = leaves.get(key(tile));
            if (leaf) found.push(leaf);
            else if (inner.has(key(tile))) for (const index of facing) descend(childTileAddresses(tile)[index]!);
        };
        descend(neighbor.address);
        return found;
    }

    /** Leaves touching a corner point of a tile, the tile itself included, at any level: 3 at the vertices of the cube. */
    private atCorner(address: ITileAddress, corner: TileCornerNeighbor, leaves: ReadonlyMap<string, IDrapeInstance>, inner: ReadonlySet<string>): IDrapeInstance[] {
        const [vertical, horizontal] = TILE_CORNER_EDGES[corner];
        // Each tile at the point, with the directions of the point seen from the tile, before the turns of the tile.
        const around: ReadonlyArray<readonly [TileNeighbor, TileEdgeNeighbor, TileEdgeNeighbor]> = [
            [TileNeighbor.C, vertical, horizontal],
            [vertical, oppositeTileEdge(vertical), horizontal],
            [horizontal, vertical, oppositeTileEdge(horizontal)],
            [corner, oppositeTileEdge(vertical), oppositeTileEdge(horizontal)],
        ];
        const found: IDrapeInstance[] = [];
        for (const [position, first, second] of around) {
            const neighbor = this.topology.neighbor(address, position);
            if (!neighbor) continue;
            let tile = neighbor.address;
            const coarser = this.leafContaining(tile, leaves);
            if (coarser) {
                found.push(coarser);
                continue;
            }
            // Descend towards the point: the child of each tile that has the point as a corner.
            const child = childToward(turnTileEdge(first, neighbor.turns), turnTileEdge(second, neighbor.turns));
            while (inner.has(key(tile))) tile = childTileAddresses(tile)[child]!;
            const leaf = leaves.get(key(tile));
            if (leaf) found.push(leaf);
        }
        return found;
    }

    /** The leaf equal to a tile or containing it, if any. */
    private leafContaining(address: ITileAddress, leaves: ReadonlyMap<string, IDrapeInstance>): IDrapeInstance | undefined {
        for (let tile: ITileAddress | undefined = address; tile; tile = parentTileAddress(tile)) {
            const leaf = leaves.get(key(tile));
            if (leaf) return leaf;
        }
        return undefined;
    }
}
