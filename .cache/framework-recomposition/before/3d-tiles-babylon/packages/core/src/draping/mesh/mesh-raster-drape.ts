import type { Material } from "@babylonjs/core/Materials/material.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { Observer } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { drapeCells, drapeDepth, pageAffectsDrape } from "@spacexr/raster";
import type { ITileAddress } from "@spacexr/tiles";

import type { BabylonRasterPages } from "../../raster/raster-pages";
import { TextureArrayPool } from "../../raster/texture-array-pool";
import { RasterDrapeMaterialPlugin, type IMeshRasterDrape, type IMeshRasterDrapeSource } from "./raster-drape-plugin";

export interface IMeshRasterDrapeOptions {
    /**
     * Deepest drape, in levels below the terrain tile: a tile draped at depth `k` samples up to `4^k` pages. Defaults
     * to 4, 256 pages. The table of each mesh holds `2^maxDepth x 2^maxDepth` cells.
     */
    maxDepth?: number;
    /**
     * Time a tile keeps its drape depth after the imagery cut beneath it became coarser, in milliseconds. Refinements
     * apply at once; coarsenings wait, so that the transient cuts of a replacement, or a cut coarsening for a moment
     * while the camera turns, do not flash coarser imagery. The finer pages stay resident meanwhile. Defaults to 500.
     */
    depthHoldMilliseconds?: number;
}

interface IDrapedMesh {
    address: ITileAddress;
    drape: IMeshRasterDrape;
    dirty: boolean;
    /** Time since the cut beneath the tile has been coarser than its depth, `undefined` otherwise. */
    coarserSince: number | undefined;
}

/** Statistics of the mesh draping engine. */
export interface IMeshRasterDrapeStatistics {
    meshes: number;
    /** Meshes by drape depth. */
    depths: Record<number, number>;
    /** Cells draped with a page of their own level. */
    exactCells: number;
    /** Cells draped with a coarser page, while finer pages load or beyond the imagery levels. */
    coarserCells: number;
    /** Cells without any page. */
    emptyCells: number;
}

/**
 * Mesh draping engine: drapes imagery pages on terrain meshes, one mesh per terrain tile.
 *
 * The depth of each terrain tile follows the imagery cut, which its runtime refines on texel size, hence on camera
 * distance: a distant tile is draped by one page, its own or a sub-area of an ancestor, and a near tile by up to
 * `4^maxDepth` pages, one per cell. Each cell uses the deepest resident page containing it. A mesh owns one layer of a
 * float texture array, its cell table; the shader reads the cell of each fragment there. Bindings are recomputed when
 * the cut or the resident pages change around a tile. The engine only reads the shared pages; a GPU instancing engine
 * can use the same pages alongside.
 */
export class MeshRasterDrape implements IMeshRasterDrapeSource {
    /** Cell tables, one layer per mesh. */
    public readonly tables: TextureArrayPool;
    public readonly maxDepth: number;
    public readonly depthHoldMilliseconds: number;
    private readonly meshes = new Map<AbstractMesh, IDrapedMesh>();
    private readonly plugins: RasterDrapeMaterialPlugin[] = [];
    private readonly pageObserver: Observer<ITileAddress>;
    private readonly growObserver: Observer<TextureArrayPool>;
    private readonly table: Float32Array;
    private dirty = false;

    public constructor(
        scene: Scene,
        private readonly rasters: BabylonRasterPages,
        options: IMeshRasterDrapeOptions = {},
    ) {
        this.maxDepth = options.maxDepth ?? 4;
        if (!Number.isInteger(this.maxDepth) || this.maxDepth < 0 || this.maxDepth > 6)
            throw new RangeError("The maximum drape depth must be an integer from 0 to 6.");
        this.depthHoldMilliseconds = Math.max(0, options.depthHoldMilliseconds ?? 500);
        const cells = 2 ** this.maxDepth;
        this.table = new Float32Array(cells * cells * 4);
        this.tables = new TextureArrayPool(scene, { size: cells, format: "rgba32f", initialLayers: 128 });
        // Float layers are not copied when a WebGL 2 pool grows: every table is written again.
        this.growObserver = this.tables.onGrowObservable.add((pool) => {
            if (pool.layersKeptOnGrowth) return;
            for (const draped of this.meshes.values()) draped.dirty = true;
            this.dirty = true;
        });
        this.pageObserver = rasters.changed.add((page) => {
            for (const draped of this.meshes.values()) {
                if (pageAffectsDrape(page, draped.address, this.maxDepth)) {
                    draped.dirty = true;
                    this.dirty = true;
                }
            }
        });
    }

    public get pages(): TextureArrayPool {
        return this.rasters.pool;
    }

    /** Adds the draping plugin to a standard material shared by terrain meshes. */
    public attach(material: Material): RasterDrapeMaterialPlugin {
        const plugin = new RasterDrapeMaterialPlugin(material, this);
        this.plugins.push(plugin);
        return plugin;
    }

    /** Shows or hides the imagery on every attached material. */
    public set enabled(value: boolean) {
        for (const plugin of this.plugins) plugin.isEnabled = value;
    }

    /** Registers the mesh of a terrain tile and writes its table at once, before the mesh is first drawn. */
    public add(mesh: AbstractMesh, address: ITileAddress): void {
        const draped: IDrapedMesh = {
            address: { ...address },
            drape: { depth: -1, tableLayer: this.tables.reserve() ?? -1 },
            dirty: false,
            coarserSince: undefined,
        };
        this.meshes.set(mesh, draped);
        this.write(draped, performance.now());
    }

    public remove(mesh: AbstractMesh): void {
        const draped = this.meshes.get(mesh);
        if (!draped) return;
        if (draped.drape.tableLayer >= 0) this.tables.release(draped.drape.tableLayer);
        this.meshes.delete(mesh);
    }

    /** Recomputes the bindings the cut or the pages changed, and applies held coarsenings. Call once per frame. */
    public update(): void {
        if (!this.dirty) return;
        this.dirty = false;
        const now = performance.now();
        for (const draped of this.meshes.values()) {
            if (!draped.dirty && draped.coarserSince === undefined) continue;
            draped.dirty = false;
            this.write(draped, now);
            // A held coarsening is checked again at the next frame.
            if (draped.coarserSince !== undefined) this.dirty = true;
        }
    }

    public drapeOf(mesh: AbstractMesh): IMeshRasterDrape | undefined {
        return this.meshes.get(mesh)?.drape;
    }

    public getStatistics(): IMeshRasterDrapeStatistics {
        const statistics: IMeshRasterDrapeStatistics = {
            meshes: this.meshes.size,
            depths: {},
            exactCells: 0,
            coarserCells: 0,
            emptyCells: 0,
        };
        for (const { address, drape } of this.meshes.values()) {
            if (drape.depth < 0) continue;
            statistics.depths[drape.depth] = (statistics.depths[drape.depth] ?? 0) + 1;
            for (const cover of drapeCells(this.rasters.resident, address, drape.depth)) {
                if (!cover) statistics.emptyCells++;
                else if (cover.ancestor.lod === address.lod + drape.depth) statistics.exactCells++;
                else statistics.coarserCells++;
            }
        }
        return statistics;
    }

    public dispose(): void {
        this.rasters.changed.remove(this.pageObserver);
        this.tables.onGrowObservable.remove(this.growObserver);
        this.meshes.clear();
        this.tables.dispose();
    }

    /** Computes the depth and cells of a terrain tile and writes its table. */
    private write(draped: IDrapedMesh, now: number): void {
        if (draped.drape.tableLayer < 0) draped.drape.tableLayer = this.tables.reserve() ?? -1;
        const cutDepth = drapeDepth(this.rasters.presented, draped.address, this.maxDepth);
        if (cutDepth >= draped.drape.depth) draped.coarserSince = undefined;
        else if (draped.coarserSince === undefined) draped.coarserSince = now;
        const held = draped.coarserSince !== undefined && now - draped.coarserSince < this.depthHoldMilliseconds;
        if (!held) draped.coarserSince = undefined;
        const depth = held ? draped.drape.depth : cutDepth;
        draped.drape.depth = depth;
        if (draped.drape.tableLayer < 0) return;
        const count = 2 ** depth;
        const table = this.table;
        drapeCells(this.rasters.resident, draped.address, depth).forEach((cover, cell) => {
            const offset = cell * 4;
            table[offset] = cover?.value ?? -1;
            table[offset + 1] = cover?.west ?? 0;
            table[offset + 2] = cover?.north ?? 0;
            table[offset + 3] = cover?.size ?? 1;
        });
        this.tables.write(draped.drape.tableLayer, table.subarray(0, count * count * 4), 0, 0, count, count);
    }
}
