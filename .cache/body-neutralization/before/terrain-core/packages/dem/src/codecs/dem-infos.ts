import { sampleSpan, type IRasterRange } from "@spacexr/raster";

import { createHeightGrid, type IHeightGrid } from "./dem";

/** Height interval in metres. Both bounds are `NaN` when no valid sample is covered. */
export type IHeightRange = IRasterRange;

/** Ranges of the four quadrants, in north-west, north-east, south-west, south-east order, like child tiles. */
export type QuadrantHeightRanges = readonly [IHeightRange, IHeightRange, IHeightRange, IHeightRange];

/** Height sample located by its column and row in a grid. */
export interface IHeightSample {
    column: number;
    row: number;
    height: number;
}

/**
 * Height grid with its statistics and optional surface normals.
 *
 * Counterpart of SpaceXR `IDemInfos`. Statistics ignore missing samples.
 */
export interface IDemInfos extends IHeightGrid {
    /** Lowest sample, or `undefined` when every sample is missing. */
    readonly lowest: IHeightSample | undefined;
    /** Highest sample, or `undefined` when every sample is missing. */
    readonly highest: IHeightSample | undefined;
    /** Mean of the valid samples, or `NaN` when every sample is missing. */
    readonly mean: number;
    /** `maximum - minimum`, or `NaN` when every sample is missing. */
    readonly delta: number;
    /**
     * Height ranges of the four quadrants, which are the extents of the child tiles.
     * Computed in the same pass as the tile range, with the sample footprint rule of `rasterRangeInArea`.
     */
    readonly quadrants: QuadrantHeightRanges;
    /**
     * Unit normals, three components per sample in local east, north, up axes.
     * Present when computed by {@link computeGridNormals} or supplied by the source.
     */
    readonly normals: Float32Array | undefined;
    /** Copies a rectangular part of the grid, with its normals, and recomputes the statistics. */
    view(column: number, row: number, width: number, height: number): IDemInfos;
}

function emptyRange(): IHeightRange {
    return { minimum: Number.NaN, maximum: Number.NaN };
}

function include(range: IHeightRange, value: number): void {
    if (!(value >= range.minimum)) range.minimum = value;
    if (!(value <= range.maximum)) range.maximum = value;
}

/** Height grid with statistics. */
export class DemInfos implements IDemInfos {
    public readonly width: number;
    public readonly height: number;
    public readonly channels = 1 as const;
    public readonly data: Float32Array;
    public readonly minimum: number;
    public readonly maximum: number;
    public readonly noDataCount: number;
    public readonly lowest: IHeightSample | undefined;
    public readonly highest: IHeightSample | undefined;
    public readonly mean: number;
    public readonly delta: number;
    public readonly quadrants: QuadrantHeightRanges;
    public readonly normals: Float32Array | undefined;

    /**
     * @param grid - Heights and their range.
     * @param normals - Optional normals, three components per sample.
     * @throws RangeError When the normals do not match the grid size.
     */
    public constructor(grid: IHeightGrid, normals?: Float32Array) {
        if (normals && normals.length !== grid.width * grid.height * 3) {
            throw new RangeError(`Expected ${grid.width * grid.height * 3} normal components, received ${normals.length}.`);
        }
        this.width = grid.width;
        this.height = grid.height;
        this.data = grid.data;
        this.normals = normals;

        let lowestIndex = -1;
        let highestIndex = -1;
        let sum = 0;
        let count = 0;
        // Samples influencing each half, following the footprint rule of rasterRangeInArea.
        const westLastColumn = sampleSpan(0, 0.5, grid.width).last;
        const eastFirstColumn = sampleSpan(0.5, 1, grid.width).first;
        const northLastRow = sampleSpan(0, 0.5, grid.height).last;
        const southFirstRow = sampleSpan(0.5, 1, grid.height).first;
        const quadrants = [emptyRange(), emptyRange(), emptyRange(), emptyRange()] as const;
        for (let index = 0; index < grid.data.length; index++) {
            const value = grid.data[index]!;
            if (Number.isNaN(value)) continue;
            if (lowestIndex < 0 || value < grid.data[lowestIndex]!) lowestIndex = index;
            if (highestIndex < 0 || value > grid.data[highestIndex]!) highestIndex = index;
            sum += value;
            count++;
            const column = index % grid.width;
            const row = Math.floor(index / grid.width);
            const west = column <= westLastColumn;
            const east = column >= eastFirstColumn;
            if (row <= northLastRow) {
                if (west) include(quadrants[0], value);
                if (east) include(quadrants[1], value);
            }
            if (row >= southFirstRow) {
                if (west) include(quadrants[2], value);
                if (east) include(quadrants[3], value);
            }
        }
        this.quadrants = quadrants;
        this.noDataCount = grid.data.length - count;
        this.lowest = lowestIndex < 0 ? undefined : this.sample(lowestIndex);
        this.highest = highestIndex < 0 ? undefined : this.sample(highestIndex);
        this.minimum = this.lowest?.height ?? Number.NaN;
        this.maximum = this.highest?.height ?? Number.NaN;
        this.mean = count === 0 ? Number.NaN : sum / count;
        this.delta = this.maximum - this.minimum;
    }

    public view(column: number, row: number, width: number, height: number): DemInfos {
        if (![column, row, width, height].every(Number.isInteger) || column < 0 || row < 0 || width < 1 || height < 1) {
            throw new RangeError("A view requires a non-negative integer origin and a positive integer size.");
        }
        if (column + width > this.width || row + height > this.height) throw new RangeError("The view exceeds the grid.");
        const heights = new Float32Array(width * height);
        const normals = this.normals ? new Float32Array(width * height * 3) : undefined;
        for (let line = 0; line < height; line++) {
            const source = (row + line) * this.width + column;
            heights.set(this.data.subarray(source, source + width), line * width);
            normals?.set(this.normals!.subarray(source * 3, (source + width) * 3), line * width * 3);
        }
        return new DemInfos(createHeightGrid(width, height, heights), normals);
    }

    private sample(index: number): IHeightSample {
        return { column: index % this.width, row: Math.floor(index / this.width), height: this.data[index]! };
    }
}

/**
 * Computes unit surface normals with central differences, in local east, north, up axes.
 *
 * Rows grow southward, so the north gradient is the negated row gradient. At the edges, and next to missing
 * samples, the difference falls back to the available side. A sample without any valid neighbour gets `(0, 0, 1)`.
 *
 * @param grid - Height grid.
 * @param columnSpacing - Ground distance between two columns, in metres.
 * @param rowSpacing - Ground distance between two rows, in metres. Defaults to `columnSpacing`.
 * @returns Three components per sample.
 */
export function computeGridNormals(grid: IHeightGrid, columnSpacing: number, rowSpacing = columnSpacing): Float32Array {
    if (!(columnSpacing > 0) || !(rowSpacing > 0)) throw new RangeError("Grid spacing must be positive.");
    const { width, height, data } = grid;
    const normals = new Float32Array(width * height * 3);
    const at = (column: number, row: number): number => data[row * width + column]!;

    const slope = (center: number, before: number, after: number, spacing: number): number => {
        const hasBefore = !Number.isNaN(before);
        const hasAfter = !Number.isNaN(after);
        if (hasBefore && hasAfter) return (after - before) / (2 * spacing);
        if (hasAfter && !Number.isNaN(center)) return (after - center) / spacing;
        if (hasBefore && !Number.isNaN(center)) return (center - before) / spacing;
        return 0;
    };

    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            const center = at(column, row);
            const west = column > 0 ? at(column - 1, row) : Number.NaN;
            const east = column < width - 1 ? at(column + 1, row) : Number.NaN;
            const north = row > 0 ? at(column, row - 1) : Number.NaN;
            const south = row < height - 1 ? at(column, row + 1) : Number.NaN;
            const eastSlope = slope(center, west, east, columnSpacing);
            const northSlope = slope(center, south, north, rowSpacing);
            const length = Math.hypot(eastSlope, northSlope, 1);
            const offset = (row * width + column) * 3;
            normals[offset] = -eastSlope / length;
            normals[offset + 1] = -northSlope / length;
            normals[offset + 2] = 1 / length;
        }
    }
    return normals;
}
