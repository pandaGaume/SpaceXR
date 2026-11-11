import { TileNeighbor, TilePyramid, parentTileAddress, tileNeighborAddress, type ITileAddress, type ITileAreaInAncestor, type ITilePyramidOptions } from "@spacexr/tiles";

import type { IRasterGrid } from "./raster-grid";
import { generateChildRaster, generatePointChildRaster, type RasterInterpolation } from "./resampling";
import { rasterRangeInArea, sampleRasterBilinear, type IRasterRange, type RasterRegistration } from "./sampling";
import { StitchedRasterGrids, type RasterGridFactory } from "./stitched-raster-grids";

export interface IRasterPyramidOptions<TGrid extends IRasterGrid> extends Omit<ITilePyramidOptions<IRasterGrid<TGrid["data"]>>, "prefetch" | "onLoad" | "onEvict"> {
    /** Builds each stitched grid. Defaults to a plain {@link IRasterGrid}. */
    create?: RasterGridFactory<TGrid>;
    /**
     * Called when stitched grids change: a tile arrives, and the tiles on its west, north and north-west receive its
     * edges. Renderers holding copies of those grids, such as GPU pages, refresh them.
     */
    onStitched?: (changed: readonly ITileAddress[]) => void;
    /**
     * Generates the levels below `maxLOD`, the deepest level of the source, down to `generation.maxLOD`, typically the
     * deepest level of the tile system the rasters are draped on. Each generated tile interpolates its parent and the
     * eight neighbours of its parent, generated themselves when they lie below `maxLOD`: the subdivision continues
     * generation by generation.
     */
    generation?: IRasterGenerationOptions;
    /**
     * Where the samples of the source tiles lie, declared by the source: it decides how tiles are stitched. Required, with
     * no default.
     *
     * - `area`: `w x h` pixels, as web tiles are published. Each tile loads with its eight neighbours, and its samples are
     *   moved to the corners of the pixels.
     * - `point`: tiles already hold their shared edges, `(w + 1) x (h + 1)` samples, as a tile service of the cube index
     *   produces them. Neighbours are neither loaded nor read. Generated levels, and the tiles a sparse source does not
     *   hold, interpolate their parent bilinearly.
     */
    registration: RasterRegistration;
    /**
     * @deprecated Declare `registration` alone: `true` is `point`, `false` is `area`. This option no longer decides
     *     anything and does not replace `registration`: a value that disagrees with it is rejected.
     */
    prestitched?: boolean;
}

const LATTICE_NEIGHBORS: readonly TileNeighbor[] = [TileNeighbor.E, TileNeighbor.S, TileNeighbor.SE];
const ALL_NEIGHBORS: readonly TileNeighbor[] = [TileNeighbor.NW, TileNeighbor.N, TileNeighbor.NE, TileNeighbor.W, TileNeighbor.E, TileNeighbor.SW, TileNeighbor.S, TileNeighbor.SE];

export interface IRasterGenerationOptions {
    /** Deepest generated level. */
    maxLOD: number;
    /** Interpolation between the samples of the parent level. Defaults to `bilinear`. */
    interpolation?: RasterInterpolation;
}

/** Stitched raster serving one tile, at any level, with the part of it the tile covers. */
export interface IRasterTileRegion<TGrid extends IRasterGrid> extends ITileAreaInAncestor {
    /** Tile requested. */
    address: ITileAddress;
    /** Stitched grid of `ancestor`, the tile itself up to `maxLOD`, in `point` registration. */
    grid: TGrid;
    /** Value of a channel at normalized tile coordinates, `u` west to east and `v` north to south. */
    sample(u: number, v: number, channel?: number): number;
    /** Range of a channel over every sample the tile can interpolate in an area given in tile coordinates. */
    range(west: number, north: number, east: number, south: number, channel?: number): IRasterRange;
}

/**
 * Raster tile pyramid loaded on demand, as one continuous surface: elevation, imagery, masks.
 *
 * Each tile loads with the neighbours its registration needs and is stitched with them, so that neighbouring tiles of
 * one level share their edge samples. Tiles below the source levels are generated when `generation` is set;
 * deeper tiles sample the sub-area of their ancestor at the deepest level. Points
 * are addressed over the whole pyramid, `x` eastward and `y` southward in `[0, 1]`, so values do not depend on the
 * tile asking.
 */
export class RasterPyramid<TGrid extends IRasterGrid = IRasterGrid> {
    /** Whether the depth of the pyramid varies from place to place. */
    private readonly sparse: boolean;
    /** Deepest level loaded from the source; deeper levels down to `maxLOD` are generated. */
    public readonly sourceMaxLOD: number;
    private readonly tiles: TilePyramid<IRasterGrid<TGrid["data"]>>;
    private readonly stitched: StitchedRasterGrids<TGrid>;
    private readonly registration: RasterRegistration;
    private readonly wrapX: boolean;
    private readonly onStitched: ((changed: readonly ITileAddress[]) => void) | undefined;
    private readonly stitchedListeners = new Set<(changed: readonly ITileAddress[]) => void>();

    /** @throws TypeError When the registration is missing or unknown, or when the deprecated `prestitched` disagrees with it. */
    public constructor(options: IRasterPyramidOptions<TGrid>) {
        const { create, onStitched, generation, registration, prestitched, ...pyramid } = options;
        this.sourceMaxLOD = pyramid.maxLOD;
        this.sparse = pyramid.servingLevel !== undefined;
        if (generation && (!Number.isInteger(generation.maxLOD) || generation.maxLOD < pyramid.maxLOD)) {
            throw new RangeError("The generated levels must reach at least the source maxLOD.");
        }
        const interpolation = generation?.interpolation ?? "bilinear";
        this.wrapX = options.wrapX ?? false;
        this.onStitched = onStitched;
        this.registration = registration;
        this.stitched = new StitchedRasterGrids<TGrid>({ wrapX: this.wrapX, registration, ...(prestitched === undefined ? {} : { prestitched }), ...(create ? { create } : {}) });
        this.tiles = new TilePyramid({
            ...pyramid,
            maxLOD: generation?.maxLOD ?? pyramid.maxLOD,
            load: (address, signal) => {
                if (registration === "area") return address.lod <= this.sourceMaxLOD ? pyramid.load(address, signal) : this.generate(address, interpolation, signal);
                return this.loadWithEdges(address, pyramid.load, signal);
            },
            // Pixels need the eight tiles around them; generated tiles hold a lattice, completed from the east and south.
            prefetch: registration === "point" ? [] : (address) => (address.lod <= this.sourceMaxLOD ? ALL_NEIGHBORS : LATTICE_NEIGHBORS),
            onLoad: (address, grid) => this.notifyStitched(this.add(address, grid)),
            onEvict: (address) => this.stitched.delete(address),
        });
    }

    public get maxLOD(): number {
        return this.tiles.maxLOD;
    }

    /** Number of raster tiles in memory, loaded, generated or in progress. */
    public get size(): number {
        return this.tiles.size;
    }

    /** The raster tile serving a tile and the part of it the tile covers. */
    public areaOf(address: ITileAddress): ITileAreaInAncestor {
        return this.tiles.areaOf(address);
    }

    /** Raster level sampled for a tile level: tiles beyond `maxLOD` share the deepest rasters. */
    public sourceLevel(lod: number): number {
        return this.tiles.sourceLevel(lod);
    }

    /** Keeps the raster serving a tile, and its stitched grid, in memory until it is released; see `TilePyramid.retain`. */
    public retain(address: ITileAddress): void {
        this.tiles.retain(address);
    }

    /** Releases a raster retained with {@link retain}. */
    public release(address: ITileAddress): void {
        this.tiles.release(address);
    }

    /**
     * Calls a listener whenever stitched grids change, like `onStitched`, for renderers created after the pyramid.
     *
     * @returns A function removing the listener.
     */
    public observeStitched(listener: (changed: readonly ITileAddress[]) => void): () => void {
        this.stitchedListeners.add(listener);
        return () => this.stitchedListeners.delete(listener);
    }

    /** Stitched grid of a loaded raster tile, without loading it. */
    public stitchedGrid(address: ITileAddress): TGrid | undefined {
        return this.stitched.get(address);
    }

    /**
     * Loads the raster serving a tile, with the neighbours that complete it.
     *
     * @param signal - Withdraws this request; see `TilePyramid.load`.
     * @returns The stitched grid and the part of it the tile covers, or `undefined` when the pyramid has no raster
     *     there.
     */
    public async load(address: ITileAddress, signal?: AbortSignal): Promise<IRasterTileRegion<TGrid> | undefined> {
        const region = await this.tiles.load(address, signal);
        if (!region) return undefined;
        const { ancestor, west, north, size } = region;
        // Evicted again while its neighbours loaded: stitch it once more.
        if (!this.stitched.has(ancestor)) this.notifyStitched(this.add(ancestor, region.content));
        const grid = this.stitched.get(ancestor)!;
        return {
            address: region.address,
            ancestor,
            west,
            north,
            size,
            grid,
            sample: (u, v, channel = 0) => sampleRasterBilinear(grid, west + u * size, north + v * size, channel, "point"),
            range: (areaWest, areaNorth, areaEast, areaSouth, channel = 0) =>
                rasterRangeInArea(grid, west + areaWest * size, north + areaNorth * size, west + areaEast * size, north + areaSouth * size, "point", channel),
        };
    }

    /**
     * Value at a point of the pyramid from the loaded rasters of a tile level, or `NaN` when no raster containing
     * the point is loaded. On a tile edge, either side gives the same value.
     *
     * @param face - Face of the point on the cube index, whose coordinates `x` and `y` run over that face. Defaults to 0.
     */
    public sampleAt(x: number, y: number, lod: number, channel = 0, face = 0): number {
        const sourceLod = this.sparse ? this.levelAt(x, y, lod, face) : this.sourceLevel(lod);
        const count = 2 ** sourceLod;
        const column = x * count;
        const row = y * count;
        const columns = Number.isInteger(column) ? [column, column - 1] : [Math.floor(column)];
        const rows = Number.isInteger(row) ? [row, row - 1] : [Math.floor(row)];
        for (const tileRow of rows) {
            if (tileRow < 0 || tileRow >= count) continue;
            for (const tileColumn of columns) {
                if (!this.wrapX && (tileColumn < 0 || tileColumn >= count)) continue;
                const grid = this.stitched.get({ face, lod: sourceLod, x: ((tileColumn % count) + count) % count, y: tileRow });
                if (grid) return sampleRasterBilinear(grid, column - tileColumn, row - tileRow, channel, "point");
            }
        }
        return Number.NaN;
    }

    /** Level of the raster serving a point at a tile level, in a pyramid whose depth varies from place to place. */
    private levelAt(x: number, y: number, lod: number, face: number): number {
        const count = 2 ** lod;
        const column = Math.max(0, Math.min(count - 1, Math.floor(x * count)));
        const row = Math.max(0, Math.min(count - 1, Math.floor(y * count)));
        return this.tiles.areaOf({ face, lod, x: column, y: row }).ancestor.lod;
    }

    /** Stitches a tile: tiles generated below the source hold a lattice, whatever the registration of the source. */
    private add(address: ITileAddress, grid: IRasterGrid<TGrid["data"]>): ITileAddress[] {
        return this.stitched.add(address, grid, address.lod <= this.sourceMaxLOD ? "source" : "generated");
    }

    private notifyStitched(changed: readonly ITileAddress[]): void {
        this.onStitched?.(changed);
        for (const listener of this.stitchedListeners) listener(changed);
    }

    /** Loads a tile that holds its shared edges, or interpolates its parent where the source has none. */
    private async loadWithEdges(
        address: ITileAddress,
        load: (address: ITileAddress, signal?: AbortSignal) => Promise<IRasterGrid<TGrid["data"]> | undefined>,
        signal?: AbortSignal
    ): Promise<IRasterGrid<TGrid["data"]> | undefined> {
        const own = address.lod <= this.sourceMaxLOD ? await load(address, signal) : undefined;
        if (own) return own;
        const parent = parentTileAddress(address);
        if (!parent) return undefined;
        const region = await this.tiles.load(parent, signal);
        return region && generatePointChildRaster(region.content, address.x - parent.x * 2, address.y - parent.y * 2);
    }

    /** Generates a tile below the source levels from its parent and the neighbours of its parent. */
    private async generate(address: ITileAddress, interpolation: RasterInterpolation, signal?: AbortSignal): Promise<IRasterGrid<TGrid["data"]> | undefined> {
        const parent = parentTileAddress(address)!;
        const positions = [TileNeighbor.NW, TileNeighbor.N, TileNeighbor.NE, TileNeighbor.W, TileNeighbor.C, TileNeighbor.E, TileNeighbor.SW, TileNeighbor.S, TileNeighbor.SE];
        const neighborhood = await Promise.all(
            positions.map(async (position) => {
                const neighbor = position === TileNeighbor.C ? parent : tileNeighborAddress(parent, position, { wrapX: this.wrapX });
                if (!neighbor) return undefined;
                // Only the parent is required; a missing neighbour repeats the edges of the parent.
                const region = await this.tiles.load(neighbor, signal).catch((error: unknown) => {
                    if (position === TileNeighbor.C) throw error;
                    return undefined;
                });
                return region?.content;
            })
        );
        if (!neighborhood[TileNeighbor.C]) return undefined;
        // The first generated level starts from the pixels of the source, the next ones from the lattice of their parent.
        const parentSamples = parent.lod <= this.sourceMaxLOD && this.registration === "area" ? "pixels" : "lattice";
        return generateChildRaster(neighborhood, address.x - parent.x * 2, address.y - parent.y * 2, interpolation, parentSamples);
    }
}
