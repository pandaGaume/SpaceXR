import { Observable } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { RasterPyramid, type IRasterGrid, type IRasterPyramidOptions } from "@spacexr/raster";
import { ResidentTiles, type ITileAddress } from "@spacexr/tiles";

import { TextureArrayPool } from "./texture-array-pool";

/** 8-bit colour raster of an imagery tile, three or four channels. */
export type ColorRasterGrid = IRasterGrid<Uint8Array | Uint8ClampedArray>;

export interface IBabylonRasterPagesOptions extends Omit<IRasterPyramidOptions<ColorRasterGrid>, "create" | "onStitched"> {
    /** Width and height of the tiles of the pyramid, in pixels. Pages hold one more column and row. */
    tileSize: number;
    /** Layers allocated at creation. Defaults to 64. */
    initialLayers?: number;
}

/** Page of one imagery tile in the texture array. */
export interface IBabylonRasterPage {
    address: ITileAddress;
    layer: number;
}

/**
 * Imagery pages shared by every draping engine: a stitched raster pyramid, the GPU texture array holding the pages,
 * and the index of resident pages that bindings look up.
 *
 * A page is the stitched raster of one tile, `tileSize + 1` texels wide in point registration whatever the
 * registration declared by the source, so that neighbouring
 * pages hold the same texels on their shared edge. When a neighbour arrives later, the pages it completes are
 * written again. `changed` notifies every page that became resident, was rewritten or left.
 */
export class BabylonRasterPages {
    public readonly pool: TextureArrayPool;
    public readonly pyramid: RasterPyramid<ColorRasterGrid>;
    /** Resident pages by tile, valued by layer. */
    public readonly resident = new ResidentTiles<number>();
    /** Imagery tiles the runtime presents: the imagery cut, which sets how deep terrain tiles are draped. */
    public readonly presented = new ResidentTiles<true>();
    /** Notifies the tile of each page that became resident, was rewritten or left, or was presented or hidden. */
    public readonly changed = new Observable<ITileAddress>();
    private readonly pageSize: number;
    private readonly buffer: Uint8Array;

    public constructor(scene: Scene, options: IBabylonRasterPagesOptions) {
        const { tileSize, initialLayers, ...pyramid } = options;
        this.pageSize = tileSize + 1;
        this.buffer = new Uint8Array(this.pageSize * this.pageSize * 4);
        this.pool = new TextureArrayPool(scene, {
            size: this.pageSize,
            ...(initialLayers === undefined ? {} : { initialLayers }),
        });
        this.pyramid = new RasterPyramid<ColorRasterGrid>({
            ...pyramid,
            onStitched: (changed) => {
                for (const address of changed) this.rewrite(address);
            },
        });
    }

    /** Texels per page side. */
    public get size(): number {
        return this.pageSize;
    }

    /**
     * Loads the raster of a tile and makes its page resident.
     *
     * @returns The page, or `undefined` when the pyramid has no raster there or the texture array is full.
     */
    public async load(address: ITileAddress, signal?: AbortSignal): Promise<IBabylonRasterPage | undefined> {
        signal?.throwIfAborted();
        const existing = this.resident.get(address);
        if (existing !== undefined) return { address, layer: existing };
        if (address.lod > this.pyramid.maxLOD) return undefined;
        const region = await this.pyramid.load(address, signal);
        signal?.throwIfAborted();
        if (!region) return undefined;
        const again = this.resident.get(address);
        if (again !== undefined) return { address, layer: again };
        const layer = this.pool.reserve();
        if (layer === undefined) return undefined;
        this.resident.set(address, layer);
        this.upload(layer, region.grid);
        this.changed.notifyObservers(address);
        return { address, layer };
    }

    /** Marks an imagery tile as part of the cut the runtime presents. */
    public present(address: ITileAddress): void {
        if (this.presented.has(address)) return;
        this.presented.set(address, true);
        this.changed.notifyObservers(address);
    }

    /** Removes an imagery tile from the presented cut; its page stays resident. */
    public hide(address: ITileAddress): void {
        if (this.presented.delete(address)) this.changed.notifyObservers(address);
    }

    /** Releases the page of a tile; the raster stays in the pyramid cache. */
    public release(address: ITileAddress): void {
        const layer = this.resident.get(address);
        this.presented.delete(address);
        if (layer === undefined) return;
        this.resident.delete(address);
        this.pool.release(layer);
        this.changed.notifyObservers(address);
    }

    public dispose(): void {
        this.changed.clear();
        this.pool.dispose();
    }

    /** Writes the stitched raster of a resident page again, after a neighbour completed it. */
    private rewrite(address: ITileAddress): void {
        const layer = this.resident.get(address);
        const grid = this.pyramid.stitchedGrid(address);
        if (layer === undefined || !grid) return;
        this.upload(layer, grid);
        this.changed.notifyObservers(address);
    }

    private upload(layer: number, grid: ColorRasterGrid): void {
        const { width, height, channels, data } = grid;
        if (width !== this.pageSize || height !== this.pageSize)
            throw new RangeError(`Expected ${this.pageSize} x ${this.pageSize} stitched texels, received ${width} x ${height}.`);
        if (channels === 4) {
            this.pool.write(layer, new Uint8Array(data.buffer, data.byteOffset, data.length));
            return;
        }
        const buffer = this.buffer;
        for (let texel = 0; texel < width * height; texel++) {
            const offset = texel * channels;
            buffer[texel * 4] = data[offset]!;
            buffer[texel * 4 + 1] = data[offset + Math.min(1, channels - 1)]!;
            buffer[texel * 4 + 2] = data[offset + Math.min(2, channels - 1)]!;
            buffer[texel * 4 + 3] = 255;
        }
        this.pool.write(layer, buffer);
    }
}
