import { assertRasterSize, type IRasterGrid, type IRgbaImage } from "@spacexr/raster";

/** Height represented by one increment of the Terrarium blue channel, in metres. */
export const TERRARIUM_HEIGHT_STEP = 1 / 256;
/** Lowest height encoded by an opaque Terrarium pixel, in metres. */
export const TERRARIUM_MIN_HEIGHT = -32768;
/** Highest height encoded by an opaque Terrarium pixel, in metres. */
export const TERRARIUM_MAX_HEIGHT = 32768 - TERRARIUM_HEIGHT_STEP;

/** One unpremultiplied 8-bit Terrarium pixel in R, G, B, A order. */
export type TerrariumPixel = [number, number, number, number];

function validateHeight(height: number): void {
    if (Number.isNaN(height)) return;
    if (!Number.isFinite(height) || height < TERRARIUM_MIN_HEIGHT || height > TERRARIUM_MAX_HEIGHT) {
        throw new RangeError("Terrarium heights must be NaN or finite metres in [-32768, 32767.99609375].");
    }
}

/**
 * Encode one height as a Terrarium RGBA pixel, the inverse of terrariumHeight.
 *
 * @remarks
 * A finite input is rounded to the nearest 1/256 metre. Exact ties choose the
 * higher height. The maximum absolute rounding error is 1/512 metre. Rounding
 * happens on the whole 24-bit integer so carries between blue, green and red
 * are preserved. Out-of-range values are rejected rather than clamped.
 *
 * NaN is NoData and produces [0, 0, 0, 0]. Valid heights are opaque, including
 * the minimum height, whose pixel is [0, 0, 0, 255]. The default decodeHeightGrid
 * transparency convention restores NoData as NaN.
 *
 * @param height - Height in metres, or NaN for a missing sample.
 * @returns Unpremultiplied 8-bit RGBA channels. This is not a PNG byte stream.
 * @throws RangeError if height is infinite or outside the representable interval.
 * @example
 * ```ts
 * terrariumPixel(0); // [128, 0, 0, 255]
 * terrariumPixel(0.9999); // [128, 1, 0, 255], rounding carries into green
 * ```
 */
export function terrariumPixel(height: number): TerrariumPixel {
    validateHeight(height);
    if (Number.isNaN(height)) return [0, 0, 0, 0];
    const integer = Math.round((height - TERRARIUM_MIN_HEIGHT) / TERRARIUM_HEIGHT_STEP);
    return [(integer >>> 16) & 255, (integer >>> 8) & 255, integer & 255, 255];
}

/**
 * Encode a one-channel metre height grid into raw Terrarium RGBA pixels.
 *
 * @remarks
 * Samples and output pixels use the same row-major north-west order. Encoding
 * does not resample, add border samples or modify the input heights. Any valid
 * dimensions are accepted, including a 257 by 257 vertex grid.
 *
 * An optional destination avoids allocating the pixel buffer. It must have
 * exactly width*height*4 bytes and must not overlap the source height storage.
 * Dimensions, every height and the destination are validated before any pixel
 * is written, so a failed call preserves a supplied destination.
 *
 * Persist the returned pixels with a lossless encoder such as PNG, preserving
 * their byte values, colour space and unpremultiplied alpha. JPEG or colour
 * processing would corrupt the elevation data. Image compression is the
 * responsibility of the caller and is not performed by this codec.
 *
 * @param grid - One Float32 or Float64 channel of heights in metres; NaN means NoData.
 * @param target - Optional exact-sized RGBA destination, including typed-array views.
 * @returns An RGBA raster whose data is target, or a newly allocated Uint8Array.
 * @throws RangeError for invalid dimensions, channels, heights, destination size or overlapping storage.
 * @example
 * ```ts
 * const heights = createHeightGrid(2, 1, new Float32Array([12.5, NaN]));
 * const pixels = encodeTerrariumGrid(heights);
 * const restored = decodeHeightGrid(pixels, "terrarium");
 * ```
 */
export function encodeTerrariumGrid(grid: IRasterGrid<Float32Array | Float64Array>, target?: Uint8Array | Uint8ClampedArray): IRgbaImage {
    if (grid.channels !== 1) throw new RangeError("Terrarium encoding requires one height channel.");
    assertRasterSize(grid.width, grid.height, 1, grid.data.length);
    const byteLength = grid.width * grid.height * 4;
    if (target && target.length !== byteLength) throw new RangeError("Terrarium destination must have exactly width*height*4 bytes.");
    if (target && target.buffer === grid.data.buffer) {
        const sourceEnd = grid.data.byteOffset + grid.data.byteLength;
        const targetEnd = target.byteOffset + target.byteLength;
        if (grid.data.byteOffset < targetEnd && target.byteOffset < sourceEnd) {
            throw new RangeError("Terrarium source and destination storage must not overlap.");
        }
    }
    // Preflight preserves a caller-owned destination if a later sample is invalid.
    for (const height of grid.data) validateHeight(height);
    const data = target ?? new Uint8Array(byteLength);
    for (let index = 0, offset = 0; index < grid.data.length; index++, offset += 4) {
        const height = grid.data[index]!;
        if (Number.isNaN(height)) {
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            data[offset + 3] = 0;
        } else {
            const integer = Math.round((height - TERRARIUM_MIN_HEIGHT) / TERRARIUM_HEIGHT_STEP);
            data[offset] = (integer >>> 16) & 255;
            data[offset + 1] = (integer >>> 8) & 255;
            data[offset + 2] = integer & 255;
            data[offset + 3] = 255;
        }
    }
    return { width: grid.width, height: grid.height, channels: 4, data };
}
