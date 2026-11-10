import type { Observer } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { ITileAddress } from "@spacexr/3d-tiles-runtime";
import type { DemPyramid } from "@spacexr/dem";
import { tileAddressKey as key, TILE_EDGE_NEIGHBORS, TileNeighbor, turnedTileCoordinates } from "@spacexr/tiles";
import { sampleRasterBilinear } from "@spacexr/raster";
import { webMercatorTiling, type ITerrainTiling } from "../terrain-tiling";
import { TextureArrayPool } from "../../raster/texture-array-pool";

/** Point DEM with a one-sample gutter, so central differences agree on shared page edges. */
export function elevationPageTexels(pyramid: DemPyramid, address: ITileAddress, size: number, tiling: ITerrainTiling): Float32Array {
    const grid = pyramid.rasters.stitchedGrid(address);
    if (!grid || grid.width !== size || grid.height !== size) throw new RangeError(`Expected ${size} x ${size} DEM samples.`);
    const last = size - 1,
        stride = size + 2;
    const output = new Float32Array(stride * stride);
    const at = (x: number, y: number) => {
        const value = grid.data[y * size + x]!;
        return Number.isFinite(value) ? value : 0;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) output[(y + 1) * stride + x + 1] = at(x, y);
    for (const edge of TILE_EDGE_NEIGHBORS) {
        const neighbor = tiling.topology.neighbor(address, edge);
        const dem = neighbor && pyramid.rasters.areaOf(neighbor.address).ancestor;
        const other = dem && pyramid.rasters.stitchedGrid(dem);
        const area = dem && tiling.demArea(address, dem);
        for (let i = 0; i < size; i++) {
            const x = edge === TileNeighbor.W ? -1 : edge === TileNeighbor.E ? size : i;
            const y = edge === TileNeighbor.N ? -1 : edge === TileNeighbor.S ? size : i;
            const cx = Math.max(0, Math.min(last, x)),
                cy = Math.max(0, Math.min(last, y));
            let height = 2 * at(cx, cy) - at(Math.max(0, Math.min(last, 2 * cx - x)), Math.max(0, Math.min(last, 2 * cy - y)));
            if (other && area) {
                const [u, v] = turnedTileCoordinates(x / last, y / last, area.turns);
                const sampled = sampleRasterBilinear(other, area.west + u * area.size, area.north + v * area.size, 0, "point");
                if (Number.isFinite(sampled)) height = sampled;
            }
            output[(y + 1) * stride + x + 1] = height;
        }
    }
    // Corner gutters are not used by axis-aligned differences, but keep the texture complete.
    for (const y of [0, stride - 1])
        for (const x of [0, stride - 1])
            output[y * stride + x] = output[Math.max(1, Math.min(size, y)) * stride + Math.max(1, Math.min(size, x))]!;
    return output;
}

interface IElevationPage {
    address: ITileAddress;
    layer: number;
    users: number;
}

/**
 * Heights of the DEM tiles in use, one 32-bit float layer each in a texture array: the stitched height grid of the
 * tile, `(w + 1) x (h + 1)` heights in point registration, so neighbouring pages share their edge heights. A page is
 * written again when a neighbour completes its stitched edges. Missing heights are written as 0.
 */
export class ElevationPages {
    public readonly pool: TextureArrayPool;
    private readonly pages = new Map<string, IElevationPage>();
    private readonly stopObserving: () => void;
    private readonly growObserver: Observer<TextureArrayPool>;

    public constructor(
        scene: Scene,
        private readonly pyramid: DemPyramid | undefined,
        /** Heights per page side: the DEM tile size plus one. */
        public readonly size = 257,
        private readonly tiling: ITerrainTiling = webMercatorTiling(),
    ) {
        this.pool = new TextureArrayPool(scene, { size: size + 2, format: "r32f", initialLayers: 64 });
        this.stopObserving =
            pyramid?.rasters.observeStitched((changed) => {
                const changedKeys = new Set(changed.map(key));
                for (const page of this.pages.values()) {
                    const affected =
                        changedKeys.has(key(page.address)) ||
                        TILE_EDGE_NEIGHBORS.some((edge) => {
                            const neighbor = this.tiling.topology.neighbor(page.address, edge);
                            return neighbor && changedKeys.has(key(pyramid.rasters.areaOf(neighbor.address).ancestor));
                        });
                    if (affected) this.write(page);
                }
            }) ?? (() => undefined);
        // Float layers are not copied when a WebGL 2 pool grows: write every page again.
        this.growObserver = this.pool.onGrowObservable.add((pool) => {
            if (pool.layersKeptOnGrowth) return;
            for (const page of this.pages.values()) this.write(page);
        });
    }

    /** Layers holding a page. */
    public get count(): number {
        return this.pages.size;
    }

    /**
     * Uses the page of a DEM tile until it is released as many times.
     *
     * @returns Its layer, or `undefined` when the DEM tile is not in memory or the texture array is full.
     */
    public acquire(address: ITileAddress): number | undefined {
        const pageKey = key(address);
        const existing = this.pages.get(pageKey);
        if (existing) {
            existing.users++;
            return existing.layer;
        }
        if (!this.pyramid?.rasters.stitchedGrid(address)) return undefined;
        const layer = this.pool.reserve();
        if (layer === undefined) return undefined;
        const page = { address: { ...address }, layer, users: 1 };
        this.pages.set(pageKey, page);
        this.write(page);
        return layer;
    }

    /** Releases a page acquired with {@link acquire}; its layer returns to the pool once unused. */
    public release(address: ITileAddress): void {
        const pageKey = key(address);
        const page = this.pages.get(pageKey);
        if (!page || --page.users > 0) return;
        this.pages.delete(pageKey);
        this.pool.release(page.layer);
    }

    public dispose(): void {
        this.stopObserving();
        this.pool.onGrowObservable.remove(this.growObserver);
        this.pages.clear();
        this.pool.dispose();
    }

    private write(page: IElevationPage): void {
        const grid = this.pyramid?.rasters.stitchedGrid(page.address);
        if (!grid) return;
        if (grid.width !== this.size || grid.height !== this.size)
            throw new RangeError(`Expected ${this.size} x ${this.size} stitched heights, received ${grid.width} x ${grid.height}.`);
        if (!this.pyramid) return;
        this.pool.write(page.layer, elevationPageTexels(this.pyramid, page.address, this.size, this.tiling));
    }
}
