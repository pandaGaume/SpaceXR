import { TileNeighbor } from "@spacexr/tiles";

import { allocateLike, type IRasterGrid } from "./raster-grid";

/**
 * Interpolation between the samples of a raster level, used to generate the levels below the deepest level of a
 * pyramid:
 *
 * - `nearest`: the nearest sample;
 * - `linear`: linear on the two triangles of each cell, split from its north-west to its south-east corner;
 * - `bilinear`: bilinear in each cell;
 * - `cubic`: Catmull-Rom spline, smooth (C1) and interpolating: it passes through the samples and may overshoot.
 *
 * Every interpolation passes through the samples, so generated levels keep the heights of the source, summits included,
 * and reproduces constant values; all but `nearest` reproduce linear slopes.
 */
export type RasterInterpolation = "nearest" | "linear" | "bilinear" | "cubic";

/** Value of one channel at an integer position of a sample lattice, `NaN` where it is missing. */
export type LatticeSampler = (column: number, row: number) => number;

/** Weighted sum skipping missing samples; `NaN` when every weighted sample is missing. */
function weighted(samples: readonly number[], weights: readonly number[]): number {
    let sum = 0;
    let total = 0;
    for (let index = 0; index < samples.length; index++) {
        const value = samples[index]!;
        const weight = weights[index]!;
        if (weight === 0 || Number.isNaN(value)) continue;
        sum += value * weight;
        total += weight;
    }
    return total === 0 ? Number.NaN : sum / total;
}

function cubicWeights(t: number): [number, number, number, number] {
    const t2 = t * t;
    const t3 = t2 * t;
    return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2];
}

/**
 * Interpolates a sample lattice at a continuous position, in sample units: `(x, y)` lies between samples
 * `floor(x)` and `floor(x) + 1`. Missing samples are left out of the weighting.
 */
export function interpolateLattice(sample: LatticeSampler, x: number, y: number, interpolation: RasterInterpolation): number {
    if (interpolation === "nearest") return sample(Math.round(x), Math.round(y));
    const column = Math.floor(x);
    const row = Math.floor(y);
    const fx = x - column;
    const fy = y - row;
    if (interpolation === "cubic") {
        const wx = cubicWeights(fx);
        const wy = cubicWeights(fy);
        const samples: number[] = [];
        const weights: number[] = [];
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) (samples.push(sample(column + i - 1, row + j - 1)), weights.push(wx[i]! * wy[j]!));
        const value = weighted(samples, weights);
        // Negative weights make a renormalized sum unreliable next to missing samples: fall back to bilinear there.
        return samples.some(Number.isNaN) ? interpolateLattice(sample, x, y, "bilinear") : value;
    }
    const corners = [sample(column, row), sample(column + 1, row), sample(column, row + 1), sample(column + 1, row + 1)];
    if (interpolation === "linear") {
        // North-west to south-east diagonal: the triangle above it holds the north-east corner.
        const weights = fx >= fy ? [1 - fx, fx - fy, 0, fy] : [1 - fy, 0, fy - fx, fx];
        return weighted(corners, weights);
    }
    return weighted(corners, [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]);
}

interface ICubicAxis {
    first: number;
    count: number;
    offsets: Int32Array;
    weights: Float64Array;
}

/** Positions and weights shared by every row or column of a generated child. */
function cubicAxis(size: number, quadrant: number): ICubicAxis {
    const start = (quadrant * size) / 2;
    const first = Math.floor(start) - 1;
    const count = Math.floor(start + (size - 1) / 2) + 3 - first;
    const offsets = new Int32Array(size);
    const weights = new Float64Array(size * 4);
    for (let i = 0; i < size; i++) {
        const coordinate = (quadrant * size + i) / 2;
        const cell = Math.floor(coordinate);
        offsets[i] = cell - 1 - first;
        weights.set(cubicWeights(coordinate - cell), i * 4);
    }
    return { first, count, offsets, weights };
}

/** Reuses the parent lattice instead of reading its same samples for every cubic stencil. */
function writeCubicChild(
    sample: LatticeSampler,
    width: number,
    height: number,
    column: number,
    row: number,
    x: ICubicAxis,
    y: ICubicAxis,
    data: IRasterGrid["data"],
    channels: number,
    channel: number
): void {
    // Keep doubles here: a pixel-registered parent is averaged before interpolation, without intermediate rounding.
    const lattice = new Float64Array(x.count * y.count);
    for (let j = 0; j < y.count; j++) for (let i = 0; i < x.count; i++) lattice[j * x.count + i] = sample(x.first + i, y.first + j);
    const cached: LatticeSampler = (i, j) => lattice[(j - y.first) * x.count + i - x.first]!;
    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            let sum = 0;
            let total = 0;
            let missing = false;
            for (let dy = 0; dy < 4; dy++) {
                const offset = (y.offsets[j]! + dy) * x.count + x.offsets[i]!;
                for (let dx = 0; dx < 4; dx++) {
                    const value = lattice[offset + dx]!;
                    const weight = x.weights[i * 4 + dx]! * y.weights[j * 4 + dy]!;
                    if (Number.isNaN(value)) missing = true;
                    if (weight === 0 || Number.isNaN(value)) continue;
                    // Preserve the public interpolator's row-major accumulation and missing-data fallback.
                    sum += value * weight;
                    total += weight;
                }
            }
            data[(j * width + i) * channels + channel] = missing
                ? interpolateLattice(cached, (column * width + i) / 2, (row * height + j) / 2, "bilinear")
                : total === 0
                  ? Number.NaN
                  : sum / total;
        }
    }
}

/**
 * Generates one child of a raster tile, one level finer, by interpolating the samples of the tile and of its eight
 * neighbours.
 *
 * Tiles of one level form a single lattice: sample `i` of tile `x` lies at `x + i / w` in tile units. Child sample
 * `i` of the child at `column` (0 west, 1 east) therefore lies at parent sample `(column * w + i) / 2`, and children
 * of neighbouring parents interpolate the same lattice, so they agree along their shared edges. Missing neighbours
 * repeat the edge samples of the parent.
 *
 * @param neighborhood - The parent and its neighbours, indexed by {@link TileNeighbor}; the centre is required.
 * @param column - Column of the child in the parent, 0 or 1.
 * @param row - Row of the child in the parent, 0 or 1.
 * @param parentSamples - `lattice` when the tiles hold samples of that lattice, as generated tiles do. `pixels` when they
 *     are tiles of a source in `area` registration, centred half a pixel from it: each lattice sample is then the mean of
 *     the four pixels around it, as in a stitched raster. Defaults to `lattice`.
 */
export function generateChildRaster<TData extends IRasterGrid["data"]>(
    neighborhood: readonly (IRasterGrid<TData> | undefined)[],
    column: number,
    row: number,
    interpolation: RasterInterpolation,
    parentSamples: "lattice" | "pixels" = "lattice"
): IRasterGrid<TData> {
    const parent = neighborhood[TileNeighbor.C];
    if (!parent) throw new RangeError("The neighbourhood needs its centre tile.");
    const { width, height, channels } = parent;
    for (const tile of neighborhood) {
        if (tile && (tile.width !== width || tile.height !== height || tile.channels !== channels)) {
            throw new RangeError("Every tile of the neighbourhood must have the size and channels of its centre.");
        }
    }
    const data = allocateLike(parent.data, width * height * channels);
    const cubicX = interpolation === "cubic" && width >= 2 && height >= 2 ? cubicAxis(width, column) : undefined;
    const cubicY = cubicX ? cubicAxis(height, row) : undefined;
    for (let channel = 0; channel < channels; channel++) {
        const stored: LatticeSampler = (x, y) => {
            // Tile of the neighbourhood holding the lattice position, clamped to the parent where it is missing.
            const tileColumn = x < 0 ? 0 : x >= width ? 2 : 1;
            const tileRow = y < 0 ? 0 : y >= height ? 2 : 1;
            const tile = neighborhood[tileRow * 3 + tileColumn];
            if (!tile) return parent.data[(Math.min(Math.max(y, 0), height - 1) * width + Math.min(Math.max(x, 0), width - 1)) * channels + channel]!;
            const localX = x - (tileColumn - 1) * width;
            const localY = y - (tileRow - 1) * height;
            return tile.data[(localY * width + localX) * channels + channel]!;
        };
        const sample: LatticeSampler =
            parentSamples === "lattice" ? stored : (x, y) => weighted([stored(x - 1, y - 1), stored(x, y - 1), stored(x - 1, y), stored(x, y)], [1, 1, 1, 1]);
        if (cubicX && cubicY) writeCubicChild(sample, width, height, column, row, cubicX, cubicY, data, channels, channel);
        else {
            for (let j = 0; j < height; j++) {
                for (let i = 0; i < width; i++) {
                    data[(j * width + i) * channels + channel] = interpolateLattice(sample, (column * width + i) / 2, (row * height + j) / 2, interpolation);
                }
            }
        }
    }
    return { width, height, channels, data };
}

/**
 * Generates a child of a raster that holds its shared edges, in `point` registration: its samples lie on the lattice
 * of the parent, `(c * w + i) / 2`, interpolated bilinearly. Samples of an edge only read the same edge of the parent,
 * so neighbouring children keep identical edges without their neighbours, across cube faces included.
 *
 * @param parent - Raster of `(w + 1) x (h + 1)` samples.
 * @param column - Column of the child in its parent, 0 west and 1 east.
 * @param row - Row of the child in its parent, 0 north and 1 south.
 */
export function generatePointChildRaster<TData extends IRasterGrid["data"]>(parent: IRasterGrid<TData>, column: number, row: number): IRasterGrid<TData> {
    const { width, height, channels } = parent;
    const cellsX = width - 1;
    const cellsY = height - 1;
    const data = allocateLike(parent.data, parent.data.length);
    for (let j = 0; j < height; j++) {
        const y = (row * cellsY + j) / 2;
        const y0 = Math.min(Math.floor(y), cellsY - 1);
        const fy = y - y0;
        for (let i = 0; i < width; i++) {
            const x = (column * cellsX + i) / 2;
            const x0 = Math.min(Math.floor(x), cellsX - 1);
            const fx = x - x0;
            for (let channel = 0; channel < channels; channel++) {
                const at = (dx: number, dy: number): number => parent.data[((y0 + dy) * width + x0 + dx) * channels + channel]!;
                const samples = [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];
                const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
                data[(j * width + i) * channels + channel] = weighted(samples, weights);
            }
        }
    }
    return { width, height, channels, data };
}
