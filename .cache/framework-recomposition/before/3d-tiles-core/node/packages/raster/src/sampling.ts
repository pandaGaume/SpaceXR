import type { RasterRegistration } from "@spacexr/tiles";

import type { IRasterGrid } from "./raster-grid";

export type { RasterRegistration };

/** Value interval. Both bounds are `NaN` when no valid sample is covered. */
export interface IRasterRange {
    minimum: number;
    maximum: number;
}

/** Continuous sample coordinate of a normalized position, clamped to the grid. */
export function sampleCoordinate(t: number, size: number, registration: RasterRegistration = "area"): number {
    const coordinate = registration === "point" ? t * (size - 1) : t * size - 0.5;
    return Math.min(Math.max(coordinate, 0), size - 1);
}

/**
 * First and last samples that can influence a bilinear sample taken between the normalized coordinates `start`
 * and `end`. With `area` registration, a position `t` interpolates samples `floor(t * size - 0.5)` and the next one;
 * with `point` registration, samples `floor(t * (size - 1))` and the next one.
 */
export function sampleSpan(start: number, end: number, size: number, registration: RasterRegistration = "area"): { first: number; last: number } {
    const clamp = (index: number) => Math.min(Math.max(index, 0), size - 1);
    if (registration === "point") return { first: clamp(Math.floor(start * (size - 1))), last: clamp(Math.ceil(end * (size - 1))) };
    return { first: clamp(Math.floor(start * size - 0.5)), last: clamp(Math.ceil(end * size - 0.5)) };
}

/**
 * Samples one channel of a raster with bilinear interpolation.
 *
 * `u` runs west to east and `v` north to south over the tile extent, both in `[0, 1]`; see
 * {@link RasterRegistration} for the location of the samples. Missing (`NaN`) neighbours are left out of the
 * weighting; the result is `NaN` only when all four are missing.
 */
export function sampleRasterBilinear(grid: IRasterGrid, u: number, v: number, channel = 0, registration: RasterRegistration = "area"): number {
    const { width, height, channels, data } = grid;
    const x = sampleCoordinate(u, width, registration);
    const y = sampleCoordinate(v, height, registration);
    const column = Math.min(Math.floor(x), width - 2 < 0 ? 0 : width - 2);
    const row = Math.min(Math.floor(y), height - 2 < 0 ? 0 : height - 2);
    const nextColumn = Math.min(column + 1, width - 1);
    const nextRow = Math.min(row + 1, height - 1);
    const fx = x - column;
    const fy = y - row;
    const at = (sampleColumn: number, sampleRow: number) => data[(sampleRow * width + sampleColumn) * channels + channel]!;

    let sum = 0;
    let weightSum = 0;
    const add = (sampleColumn: number, sampleRow: number, weight: number): void => {
        const value = at(sampleColumn, sampleRow);
        if (weight === 0 || Number.isNaN(value)) return;
        sum += value * weight;
        weightSum += weight;
    };
    add(column, row, (1 - fx) * (1 - fy));
    add(nextColumn, row, fx * (1 - fy));
    add(column, nextRow, (1 - fx) * fy);
    add(nextColumn, nextRow, fx * fy);
    if (weightSum > 0) return sum / weightSum;

    // The point lies exactly on missing samples with zero-weight neighbours: use the nearest valid corner, if any.
    for (const [sampleColumn, sampleRow] of [
        [column, row],
        [nextColumn, row],
        [column, nextRow],
        [nextColumn, nextRow],
    ] as const) {
        const value = at(sampleColumn, sampleRow);
        if (!Number.isNaN(value)) return value;
    }
    return Number.NaN;
}

/**
 * Range of one channel over every sample that can influence a bilinear sample taken inside an area.
 *
 * The area is given in normalized tile coordinates, `u` west to east and `v` north to south. The range bounds every
 * value {@link sampleRasterBilinear} can return in the area with the same registration, which makes it a safe
 * bounding range for an overzoomed sub-area or a child tile.
 */
export function rasterRangeInArea(
    grid: IRasterGrid,
    west: number,
    north: number,
    east: number,
    south: number,
    registration: RasterRegistration = "area",
    channel = 0
): IRasterRange {
    if (!(west <= east) || !(north <= south)) throw new RangeError("The area must satisfy west <= east and north <= south.");
    const columns = sampleSpan(west, east, grid.width, registration);
    const rows = sampleSpan(north, south, grid.height, registration);
    const range: IRasterRange = { minimum: Number.NaN, maximum: Number.NaN };
    for (let row = rows.first; row <= rows.last; row++) {
        for (let column = columns.first; column <= columns.last; column++) {
            const value = grid.data[(row * grid.width + column) * grid.channels + channel]!;
            if (Number.isNaN(value)) continue;
            if (!(value >= range.minimum)) range.minimum = value;
            if (!(value <= range.maximum)) range.maximum = value;
        }
    }
    return range;
}
