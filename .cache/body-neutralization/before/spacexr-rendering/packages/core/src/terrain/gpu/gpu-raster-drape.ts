import type { Observer } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { drapeCells, drapeDepth, pageAffectsDrape } from "@spacexr/raster";
import { tileAddressKey as key, type ITileAddress } from "@spacexr/tiles";

import type { BabylonRasterPages } from "../../raster/raster-pages";
import { TextureArrayPool } from "../../raster/texture-array-pool";

export interface IGpuRasterDrapeBinding {
    depth: number;
    tableLayer: number;
}

interface IDrapedTile extends IGpuRasterDrapeBinding {
    address: ITileAddress;
    dirty: boolean;
    coarserSince: number | undefined;
}

/** Imagery indirection tables for terrain instances; page changes never subdivide the geometry. */
export class GpuRasterDrape {
    public readonly tables: TextureArrayPool;
    private readonly tiles = new Map<string, IDrapedTile>();
    private readonly changed: Observer<ITileAddress>;
    private readonly grown: Observer<TextureArrayPool>;

    public constructor(
        scene: Scene,
        private readonly rasters: BabylonRasterPages,
        public readonly maxDepth = 4,
        public readonly depthHoldMilliseconds = 500,
    ) {
        if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 6)
            throw new RangeError("The maximum drape depth must be an integer from 0 to 6.");
        this.tables = new TextureArrayPool(scene, { size: 2 ** maxDepth, format: "rgba32f", initialLayers: 64 });
        this.changed = rasters.changed.add((page) => {
            for (const tile of this.tiles.values()) if (pageAffectsDrape(page, tile.address, maxDepth)) tile.dirty = true;
        });
        this.grown = this.tables.onGrowObservable.add((pool) => {
            if (!pool.layersKeptOnGrowth) for (const tile of this.tiles.values()) tile.dirty = true;
        });
    }

    /** Releases obsolete tables first, so two individually valid cuts do not exhaust the pool during replacement. */
    public sync(addresses: readonly ITileAddress[]): void {
        const selected = new Set(addresses.map(key));
        for (const [id, tile] of this.tiles) {
            if (selected.has(id)) continue;
            if (tile.tableLayer >= 0) this.tables.release(tile.tableLayer);
            this.tiles.delete(id);
        }
        for (const address of addresses) {
            const id = key(address);
            if (!this.tiles.has(id))
                this.tiles.set(id, { address: { ...address }, depth: 0, tableLayer: -1, dirty: true, coarserSince: undefined });
        }
        this.update();
    }

    /** Updates changed imagery bindings only. A missing table is retried after the next resource change. */
    public update(): boolean {
        let changed = false;
        const now = performance.now();
        // A float-array growth invalidates previously written tables. Repeat only those invalidated by that growth.
        do {
            for (const tile of this.tiles.values()) {
                const expired = tile.coarserSince !== undefined && now - tile.coarserSince >= this.depthHoldMilliseconds;
                if (!tile.dirty && tile.tableLayer >= 0 && !expired) continue;
                tile.dirty = false;
                if (tile.tableLayer < 0) tile.tableLayer = this.tables.reserve() ?? -1;
                const target = drapeDepth(this.rasters.presented, tile.address, this.maxDepth);
                if (target >= tile.depth) tile.coarserSince = undefined;
                else tile.coarserSince ??= now;
                if (tile.coarserSince === undefined || now - tile.coarserSince >= this.depthHoldMilliseconds) {
                    tile.depth = target;
                    tile.coarserSince = undefined;
                }
                if (tile.tableLayer < 0) continue;
                const data = new Float32Array(4 * 4 ** tile.depth);
                drapeCells(this.rasters.resident, tile.address, tile.depth).forEach((cover, cell) => {
                    data.set([cover?.value ?? -1, cover?.west ?? 0, cover?.north ?? 0, cover?.size ?? 1], cell * 4);
                });
                const side = 2 ** tile.depth;
                this.tables.write(tile.tableLayer, data, 0, 0, side, side);
                changed = true;
            }
        } while ([...this.tiles.values()].some((tile) => tile.dirty));
        return changed;
    }

    public binding(address: ITileAddress): IGpuRasterDrapeBinding | undefined {
        return this.tiles.get(key(address));
    }

    public dispose(): void {
        this.rasters.changed.remove(this.changed);
        this.tables.onGrowObservable.remove(this.grown);
        this.tables.dispose();
        this.tiles.clear();
    }
}
