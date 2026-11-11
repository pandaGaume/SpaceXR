import { tileAddressKey as key, type ITileAddress } from "../addressing/tile-address";
import { tileAreaInAncestor, type ITileAreaInAncestor } from "./tile-pyramid";

/** Resident tile covering a requested tile, with the part of it the requested tile covers. */
export interface IResidentTileCover<T> extends ITileAreaInAncestor {
    /** Value stored for `ancestor`, the resident tile. */
    value: T;
}

interface IResidentEntry<T> {
    readonly address: ITileAddress;
    value: T;
}

/**
 * Tiles currently available to a renderer, such as texture pages or elevation pages, indexed for coverage lookups.
 *
 * A renderer binds the data of one pyramid to the tiles of another: imagery pages to terrain tiles, or elevation
 * pages to imagery tiles. `cover` returns the deepest resident tile containing a requested tile, so that a binding
 * always falls back to coarser data while finer data loads.
 */
export class ResidentTiles<T> {
    private readonly entries = new Map<string, IResidentEntry<T>>();

    public get size(): number {
        return this.entries.size;
    }

    public get(address: ITileAddress): T | undefined {
        return this.entries.get(key(address))?.value;
    }

    public has(address: ITileAddress): boolean {
        return this.entries.has(key(address));
    }

    public set(address: ITileAddress, value: T): void {
        const entry = this.entries.get(key(address));
        if (entry) entry.value = value;
        else this.entries.set(key(address), { address: { ...address }, value });
    }

    public delete(address: ITileAddress): boolean {
        return this.entries.delete(key(address));
    }

    /** Addresses of the resident tiles. */
    public *addresses(): IterableIterator<ITileAddress> {
        for (const entry of this.entries.values()) yield entry.address;
    }

    /**
     * Deepest resident tile containing a tile, the tile itself included, and the part of it the tile covers.
     *
     * @param minLOD - Coarsest level searched. Defaults to 0.
     * @returns `undefined` when no resident tile contains the tile.
     */
    public cover(address: ITileAddress, minLOD = 0): IResidentTileCover<T> | undefined {
        for (let levels = 0; address.lod - levels >= minLOD; levels++) {
            const area = tileAreaInAncestor(address, levels);
            const entry = this.entries.get(key(area.ancestor));
            if (entry !== undefined) return { ...area, value: entry.value };
        }
        return undefined;
    }

    /**
     * Levels between a tile and the deepest resident tile inside it, at most `maxLevels` below: `0` when only the
     * tile itself is resident, `undefined` when no resident tile lies inside it.
     */
    public depthWithin(address: ITileAddress, maxLevels = Number.POSITIVE_INFINITY): number | undefined {
        let depth: number | undefined;
        for (const { address: resident } of this.entries.values()) {
            const levels = resident.lod - address.lod;
            if ((resident.face ?? 0) !== (address.face ?? 0) || levels < 0 || levels > maxLevels || (depth !== undefined && levels <= depth)) continue;
            const scale = 2 ** levels;
            if (Math.floor(resident.x / scale) === address.x && Math.floor(resident.y / scale) === address.y) depth = levels;
        }
        return depth;
    }
}
