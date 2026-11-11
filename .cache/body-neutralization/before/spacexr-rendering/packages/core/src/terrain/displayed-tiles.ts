import { NeighborLod, SAME_EDGE_LODS, gridEdgeLods, type GridEdgeLods } from "@spacexr/grid";
import {
    TILE_EDGE_NEIGHBORS,
    TileNeighbor,
    childTileAddresses,
    flatTileTopology,
    parentTileAddress,
    tileAddressKey as key,
    turnTileEdge,
    type ITileAddress,
    type ITileTopology,
    type TileEdgeNeighbor,
} from "@spacexr/tiles";

/**
 * Which tile of a junction between two levels adapts its edge.
 *
 * - `fine`: the finer tile removes every other edge vertex (`Coarser`).
 * - `coarse`: the coarser tile adds the edge midpoints (`Finer`).
 * - `none`: no junction, tiles keep their regular edges.
 */
export type JunctionPolicy = "fine" | "coarse" | "none";

/** Children of a neighbour that touch the tile, in `childTileAddresses` order NW, NE, SW, SE. */
const CHILDREN_FACING: Readonly<Record<TileEdgeNeighbor, readonly [number, number]>> = {
    // The northern neighbour touches the tile with its southern children, and so on.
    [TileNeighbor.N]: [2, 3],
    [TileNeighbor.E]: [0, 2],
    [TileNeighbor.S]: [0, 1],
    [TileNeighbor.W]: [1, 3],
};

/** Whether `outer` contains `inner`, itself included. */
function contains(outer: ITileAddress, inner: ITileAddress): boolean {
    if ((outer.face ?? 0) !== (inner.face ?? 0) || inner.lod < outer.lod) return false;
    const scale = 2 ** (inner.lod - outer.lod);
    return Math.floor(inner.x / scale) === outer.x && Math.floor(inner.y / scale) === outer.y;
}

/** Corners of a tile, with the edges they lie on. */
const CORNERS: ReadonlyArray<readonly [TileNeighbor, TileEdgeNeighbor, TileEdgeNeighbor]> = [
    [TileNeighbor.NW, TileNeighbor.N, TileNeighbor.W],
    [TileNeighbor.NE, TileNeighbor.N, TileNeighbor.E],
    [TileNeighbor.SE, TileNeighbor.S, TileNeighbor.E],
    [TileNeighbor.SW, TileNeighbor.S, TileNeighbor.W],
];

/**
 * Tracks the last known cut of a quadtree to find the level displayed across each tile edge.
 *
 * A tile hidden while no displayed tile overlaps it, typically because it left the view, stays known as a ghost: its
 * neighbours keep connecting to its level, so that turning the camera does not change their edges back and forth.
 * A ghost leaves when a tile overlapping it is presented, or when its resource is released.
 */
export interface IDisplayedTilesOptions {
    /** Called when a tile joins the known cut, to keep the data its edges are computed from. */
    onTrack?: (address: ITileAddress) => void;
    /** Called when a tile leaves the known cut, displayed or ghost. */
    onForget?: (address: ITileAddress) => void;
    /** How tiles connect, for example across the faces of the cube index. Defaults to one pyramid wrapping in longitude. */
    topology?: ITileTopology;
}

export class DisplayedTiles {
    private readonly topology: ITileTopology;

    public constructor(private readonly options: IDisplayedTilesOptions = {}) {
        this.topology = options.topology ?? flatTileTopology({ wrapX: true });
    }

    private readonly counts = new Map<string, number>();
    private readonly addresses = new Map<string, ITileAddress>();
    private readonly ghosts = new Set<string>();

    /** Records a presented tile; ghosts it overlaps leave. */
    public add(address: ITileAddress): void {
        const tileKey = key(address);
        if (this.ghosts.delete(tileKey)) return this.removeOverlappingGhosts(address);
        const tracked = this.counts.has(tileKey);
        this.counts.set(tileKey, (this.counts.get(tileKey) ?? 0) + 1);
        this.addresses.set(tileKey, { ...address });
        if (!tracked) this.options.onTrack?.(address);
        this.removeOverlappingGhosts(address);
    }

    /** Records a hidden tile: it leaves when a displayed tile overlaps it, and stays as a ghost otherwise. */
    public hide(address: ITileAddress): void {
        const tileKey = key(address);
        if (!this.counts.has(tileKey) || this.ghosts.has(tileKey)) return;
        if (this.counts.get(tileKey)! > 1 || this.overlapsDisplayed(address)) this.delete(address);
        else this.ghosts.add(tileKey);
    }

    /** Whether a tile is known only as a ghost, hidden while nothing displayed overlaps it. */
    public isGhost(address: ITileAddress): boolean {
        return this.ghosts.has(key(address));
    }

    /** Forgets a tile, displayed or ghost. */
    public delete(address: ITileAddress): void {
        const tileKey = key(address);
        if (!this.counts.has(tileKey)) return;
        const count = this.counts.get(tileKey)! - 1;
        if (count > 0) this.counts.set(tileKey, count);
        else {
            this.counts.delete(tileKey);
            this.addresses.delete(tileKey);
            this.ghosts.delete(tileKey);
        }
        if (count <= 0) this.options.onForget?.(address);
    }

    /** Whether a displayed tile, not a ghost, is an ancestor or a descendant of a tile. */
    private overlapsDisplayed(address: ITileAddress): boolean {
        for (const [tileKey, other] of this.addresses) {
            if (this.ghosts.has(tileKey) || tileKey === key(address)) continue;
            if (contains(other, address) || contains(address, other)) return true;
        }
        return false;
    }

    private removeOverlappingGhosts(address: ITileAddress): void {
        for (const ghost of [...this.ghosts]) {
            const other = this.addresses.get(ghost)!;
            if (contains(other, address) || contains(address, other)) this.delete(other);
        }
    }

    public has(address: ITileAddress): boolean {
        return this.counts.has(key(address));
    }

    /**
     * Levels of the known tiles touching a point of a tile, from the coarsest: the tile itself inside it, and on its
     * boundary the tiles across the edges and the corner the point lies on, across cube faces included.
     *
     * @param u - Coordinate of the point in the tile, west to east.
     * @param v - Coordinate of the point in the tile, north to south.
     */
    public levelsAt(address: ITileAddress, u: number, v: number): number[] {
        if (u !== 0 && u !== 1 && v !== 0 && v !== 1) return [address.lod];
        const levels = new Set([address.lod]);
        const add = (lod: number | undefined): void => {
            if (lod !== undefined) levels.add(lod);
        };
        const west = u === 0;
        const east = u === 1;
        const north = v === 0;
        const south = v === 1;
        if (north) add(this.lodAcross(address, TileNeighbor.N));
        if (east) add(this.lodAcross(address, TileNeighbor.E));
        if (south) add(this.lodAcross(address, TileNeighbor.S));
        if (west) add(this.lodAcross(address, TileNeighbor.W));
        const corner = CORNERS.find(
            ([, row, column]) => (row === TileNeighbor.N ? north : south) && (column === TileNeighbor.W ? west : east),
        );
        if (corner) add(this.lodAcross(address, corner[0]));
        return [...levels].sort((left, right) => left - right);
    }

    /**
     * Levels around a tile, which decide the heights of its edges: they change only when one of these does.
     */
    public boundarySignature(address: ITileAddress): string {
        const levels = TILE_EDGE_NEIGHBORS.map((edge) => this.lodAcross(address, edge));
        for (const [corner] of CORNERS) levels.push(this.lodAcross(address, corner));
        return levels.join(",");
    }

    /**
     * Level of detail displayed across an edge or a corner: the neighbour itself, one of its ancestors, or its children
     * facing the tile. `undefined` when nothing is displayed there, or at a corner where only 3 tiles meet.
     */
    public lodAcross(address: ITileAddress, position: TileNeighbor): number | undefined {
        const neighbor = this.topology.neighbor(address, position);
        if (!neighbor) return undefined;
        if (this.has(neighbor.address)) return neighbor.address.lod;
        for (let ancestor = parentTileAddress(neighbor.address); ancestor; ancestor = parentTileAddress(ancestor)) {
            if (this.has(ancestor)) return ancestor.lod;
        }
        const children = childTileAddresses(neighbor.address);
        const facing = (edge: TileEdgeNeighbor): readonly number[] => CHILDREN_FACING[turnTileEdge(edge, neighbor.turns)];
        const corner = CORNERS.find(([name]) => name === position);
        // At a corner, only the child in both directions touches the tile.
        const candidates = corner
            ? facing(corner[1]).filter((index) => facing(corner[2]).includes(index))
            : facing(position as TileEdgeNeighbor);
        return candidates.some((index) => this.has(children[index]!)) ? neighbor.address.lod + 1 : undefined;
    }

    /**
     * Edge levels of a tile under a junction policy. Levels further than one
     * apart are clamped: the runtime does not balance its quadtree, so such a
     * junction keeps a small crack.
     */
    public edgeLods(address: ITileAddress, policy: JunctionPolicy): GridEdgeLods {
        if (policy === "none") return SAME_EDGE_LODS;
        return gridEdgeLods(address, (edge) => {
            const lod = this.lodAcross(address, edge);
            if (lod === undefined) return undefined;
            const clamped = Math.min(Math.max(lod, address.lod - NeighborLod.Finer), address.lod + NeighborLod.Finer);
            if (policy === "fine" && clamped > address.lod) return address.lod;
            if (policy === "coarse" && clamped < address.lod) return address.lod;
            return clamped;
        });
    }
}
