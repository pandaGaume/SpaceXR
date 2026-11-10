/** Typed array holding the samples of a raster. */
export type RasterData = Float32Array | Float64Array | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array;

/**
 * Regular grid of values: heights, colours, masks, normals.
 *
 * Samples are row-major from the north-west corner, with `channels` interleaved values per sample: the value of
 * channel `c` at `column, row` is `data[(row * width + column) * channels + c]`. Missing floating-point values are
 * `NaN`.
 */
export interface IRasterGrid<TData extends RasterData = RasterData> {
    width: number;
    height: number;
    channels: number;
    data: TData;
}

/** Builds a raster after checking its size. */
export function createRasterGrid<TData extends RasterData>(width: number, height: number, channels: number, data: TData): IRasterGrid<TData> {
    assertRasterSize(width, height, channels, data.length);
    return { width, height, channels, data };
}

/** @throws RangeError When the dimensions are not positive integers or do not match the number of values. */
export function assertRasterSize(width: number, height: number, channels: number, length: number): void {
    if (![width, height, channels].every(Number.isInteger) || width < 1 || height < 1 || channels < 1) {
        throw new RangeError("Raster dimensions and channels must be positive integers.");
    }
    if (length !== width * height * channels) throw new RangeError(`Expected ${width * height * channels} values, received ${length}.`);
}

/** Empty array of the same type as `data`. */
export function allocateLike<TData extends RasterData>(data: TData, length: number): TData {
    return new (data.constructor as new (length: number) => TData)(length);
}
