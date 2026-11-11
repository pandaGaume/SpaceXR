import { RasterPyramid, type IRasterPyramidOptions } from "@spacexr/raster";
import type { CelestialTileSource, ITileAddress, TileContentLoader } from "@spacexr/tiles";

import { createHeightGrid, type DemEncoding, type IDemDecoder, type IHeightGrid, type IHeightRange, type QuadrantHeightRanges } from "../codecs";
import type { IDemTileSource } from "../sources";
import type { ChildHeightRanges } from "./child-height-ranges";

/** Loader fetching and decoding the tiles of a web DEM source. */
export function webDemTileLoader(source: IDemTileSource, decoder: IDemDecoder): TileContentLoader<IHeightGrid> {
    return async (address, signal) => {
        const result = await source.source.fetchTile(address, signal);
        if (result.status === "absent") return undefined;
        // The pyramid needs heights and their range, not the extra statistics of a standalone DemInfos tile.
        return decoder.decodeDem(result.bytes, source.encoding, signal ? { signal } : {});
    };
}

/**
 * Loader fetching and decoding the tiles of an elevation dataset of a tile service. Its tiles hold radial heights and
 * their shared edges.
 *
 * @throws RangeError When the dataset does not hold elevation.
 */
export function cubeDemTileLoader(source: CelestialTileSource, decoder: IDemDecoder): TileContentLoader<IHeightGrid> {
    const { content, encoding } = source.dataset;
    if (content !== "elevation") throw new RangeError(`Dataset of ${source.dataset.body} holds ${content}, not elevation.`);
    return async (address, signal) => {
        const result = await source.fetchTile(address, signal);
        return result.status === "absent" ? undefined : decoder.decodeDem(result.bytes, encoding as DemEncoding, undefined);
    };
}

/** Options of {@link cubeDemPyramid}. */
export interface ICubeDemPyramidOptions extends Pick<IDemPyramidOptions, "cacheEntries" | "abortDelayMilliseconds" | "childHeightRanges" | "onStitched"> {
    /**
     * Deepest level of generated tiles, which interpolate the dataset bilinearly below its deepest level, the same everywhere.
     * Defaults to none: a tile deeper than the dataset at its place, inside or outside its subtrees, reads a sub-area of the
     * deepest tile there. A slope read on generated tiles is constant by parts, which shows as a checkerboard in lighting: a
     * renderer computing normals from the samples should leave it unset.
     */
    maxLOD?: number;
}

/**
 * The heights of an elevation dataset of a tile service as one surface per face of the cube. Tiles keep their shared
 * edges, and a tile the dataset does not declare reads a sub-area of the deepest tile at its place.
 */
export function cubeDemPyramid(source: CelestialTileSource, decoder: IDemDecoder, options: ICubeDemPyramidOptions = {}): DemPyramid {
    const { maxLOD, ...rest } = options;
    return new DemPyramid({
        ...rest,
        registration: "point",
        maxLOD: source.deepestLOD,
        load: cubeDemTileLoader(source, decoder),
        ...(maxLOD !== undefined && maxLOD > source.deepestLOD ? { generation: { maxLOD } } : { servingLevel: (address: ITileAddress) => source.servingLevel(address) }),
    });
}

export interface IDemPyramidOptions extends Omit<IRasterPyramidOptions<IHeightGrid>, "create"> {
    /** Receives the quadrant ranges of each tile whose heights are loaded, prepared for its four children. */
    childHeightRanges?: ChildHeightRanges;
}

/** Heights of one tile, at any level: from its own DEM tile, or from a sub-area of an ancestor beyond `maxLOD`. */
export interface IDemTileHeights {
    /** DEM tile sampled for the tile. */
    demAddress: ITileAddress;
    /** Height in metres at normalized tile coordinates, `u` west to east and `v` north to south. */
    sampler: (u: number, v: number) => number;
    /** Range of every sample the tile can interpolate. */
    range: IHeightRange;
    /** Ranges of the four children, in north-west, north-east, south-west, south-east order. */
    quadrants: QuadrantHeightRanges;
}

/**
 * Which DEM levels give the height of a point touched by tiles of several levels of detail:
 *
 * - `coarsest`: the coarsest level, which keeps coarse tiles intact;
 * - `finest`: the finest level, which keeps the finest detail;
 * - `average`: the mean over every level.
 */
export type SurfaceLevelPolicy = "coarsest" | "finest" | "average";

/** Levels a point follows under a policy, from levels sorted coarsest first. */
export function selectSurfaceLevels(levels: readonly number[], policy: SurfaceLevelPolicy): readonly number[] {
    if (levels.length === 0 || policy === "average") return levels;
    return policy === "coarsest" ? [levels[0]!] : [levels[levels.length - 1]!];
}

/**
 * A DEM tile pyramid loaded on demand, as one continuous surface: a {@link RasterPyramid} of heights.
 *
 * Tiles are stitched with their neighbours, following the registration of the source, so that neighbouring tiles of one
 * level share their edge heights. With `generation`, the levels below the deepest DEM level are generated by interpolating the
 * level above, down to the deepest level of the terrain tile system: `cubic` interpolation then
 * smooths terrain the DEM cannot resolve, instead of the facets of an overzoomed bilinear sub-area. Points are addressed over the whole pyramid, `x` eastward and `y` southward in `[0, 1]`, so
 * heights and gradients do not depend on the tile asking.
 */
export class DemPyramid {
    /** The underlying raster pyramid, with stitched height grids. */
    public readonly rasters: RasterPyramid<IHeightGrid>;
    private readonly childHeightRanges: ChildHeightRanges | undefined;

    public constructor(options: IDemPyramidOptions) {
        const { childHeightRanges, ...rasters } = options;
        this.childHeightRanges = childHeightRanges;
        this.rasters = new RasterPyramid<IHeightGrid>({ ...rasters, create: (width, height, _channels, data) => createHeightGrid(width, height, data) });
    }

    public get maxLOD(): number {
        return this.rasters.maxLOD;
    }

    /** Number of DEM tiles in memory, loaded or loading. */
    public get size(): number {
        return this.rasters.size;
    }

    /**
     * Keeps the DEM tile serving a tile in memory until it is released, for example while a terrain tile is displayed:
     * `heightAt` and the surface helpers only read DEM tiles in memory.
     */
    public retain(address: ITileAddress): void {
        this.rasters.retain(address);
    }

    /** Releases a DEM tile retained with {@link retain}. */
    public release(address: ITileAddress): void {
        this.rasters.release(address);
    }

    /** Whether the DEM tile serving a tile is in memory, so that `heightAt` reads it. */
    public isResident(address: ITileAddress): boolean {
        return this.rasters.stitchedGrid(this.rasters.areaOf(address).ancestor) !== undefined;
    }

    /** DEM level sampled for a tile level: the level itself down to the deepest generated level, then that level. */
    public demLevel(lod: number): number {
        return this.rasters.sourceLevel(lod);
    }

    /**
     * Loads the heights of a tile with its range and the ranges of its four children, which are also recorded in
     * `childHeightRanges`. Returns `undefined` when the pyramid has no DEM tile there.
     *
     * @param signal - Withdraws this request, which then rejects. A load nobody else waits for is aborted.
     */
    public async tileHeights(address: ITileAddress, signal?: AbortSignal): Promise<IDemTileHeights | undefined> {
        const region = await this.rasters.load(address, signal);
        if (!region) return undefined;
        const quadrants: QuadrantHeightRanges = [region.range(0, 0, 0.5, 0.5), region.range(0.5, 0, 1, 0.5), region.range(0, 0.5, 0.5, 1), region.range(0.5, 0.5, 1, 1)];
        this.childHeightRanges?.recordChildren(address, quadrants);
        return { demAddress: region.ancestor, sampler: (u, v) => region.sample(u, v), range: region.range(0, 0, 1, 1), quadrants };
    }

    /**
     * Height at a point of the pyramid from the loaded DEM of a tile level, or `NaN` when no DEM tile containing
     * the point is loaded. On a tile edge, either side gives the same value.
     *
     * @param face - Face of the point on the cube index, whose coordinates `x` and `y` run over that face. Defaults to 0.
     */
    public heightAt(x: number, y: number, lod: number, face = 0): number {
        return this.rasters.sampleAt(x, y, lod, 0, face);
    }

    /** Mean height over tile levels, ignoring the levels without loaded DEM; `NaN` when none is loaded. */
    public surfaceHeight(x: number, y: number, lods: readonly number[], face = 0): number {
        let sum = 0;
        let count = 0;
        for (const lod of lods) {
            const height = this.heightAt(x, y, lod, face);
            if (Number.isNaN(height)) continue;
            sum += height;
            count++;
        }
        return count === 0 ? Number.NaN : sum / count;
    }

    /**
     * Height gradient, in metres per normalized pyramid unit along `x` and `y`, averaged over tile levels. Each
     * level differentiates one grid cell apart, `1 / (cellsPerTile * 2^lod)`, so that the gradient follows the mesh
     * built with that many cells per tile rather than DEM detail its triangles cannot show. Missing neighbours fall
     * back to one-sided differences, as on the edges of a cube face.
     */
    public surfaceGradient(x: number, y: number, lods: readonly number[], cellsPerTile: number, face = 0): [number, number] | undefined {
        const difference = (before: number, center: number, after: number, step: number): number | undefined => {
            if (!Number.isNaN(before) && !Number.isNaN(after)) return (after - before) / (2 * step);
            if (!Number.isNaN(after) && !Number.isNaN(center)) return (after - center) / step;
            if (!Number.isNaN(before) && !Number.isNaN(center)) return (center - before) / step;
            return undefined;
        };
        let gradientX = 0;
        let gradientY = 0;
        let count = 0;
        for (const lod of lods) {
            const step = 1 / (cellsPerTile * 2 ** lod);
            const center = this.heightAt(x, y, lod, face);
            const alongX = difference(this.heightAt(x - step, y, lod, face), center, this.heightAt(x + step, y, lod, face), step);
            const alongY = difference(this.heightAt(x, y - step, lod, face), center, this.heightAt(x, y + step, lod, face), step);
            if (alongX === undefined || alongY === undefined) continue;
            gradientX += alongX;
            gradientY += alongY;
            count++;
        }
        return count === 0 ? undefined : [gradientX / count, gradientY / count];
    }
}
