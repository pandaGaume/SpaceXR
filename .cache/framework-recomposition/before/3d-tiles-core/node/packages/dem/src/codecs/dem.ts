import { assertRasterSize, type IImageDecoder, type IRasterGrid, type IRgbaImage } from "@spacexr/raster";

/**
 * Encoding of elevations in the pixels of a DEM tile.
 *
 * - `terrarium`: Mapzen Terrarium, `height = r * 256 + g + b / 256 - 32768`.
 * - `mapbox-terrain-rgb`: Mapbox Terrain-RGB, `height = -10000 + (r * 65536 + g * 256 + b) * 0.1`.
 * - `grayscale`: linear grey level of the red channel, `height = minimum + r / 255 * (maximum - minimum)`.
 *
 * Heights are in metres.
 */
export type DemEncoding = "terrarium" | "mapbox-terrain-rgb" | { kind: "grayscale"; minimum: number; maximum: number };

/** Converts one pixel to a height in metres. */
export type HeightPixelDecoder = (red: number, green: number, blue: number) => number;

export const terrariumHeight: HeightPixelDecoder = (red, green, blue) => red * 256 + green + blue / 256 - 32768;

export const mapboxTerrainRgbHeight: HeightPixelDecoder = (red, green, blue) => -10000 + (red * 65536 + green * 256 + blue) * 0.1;

/** Creates a decoder mapping grey levels 0 to 255 linearly onto `[minimum, maximum]`. */
export function grayscaleHeight(minimum: number, maximum: number): HeightPixelDecoder {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
        throw new RangeError("Grayscale elevation range must be finite with minimum <= maximum.");
    }
    return (red) => minimum + (red / 255) * (maximum - minimum);
}

/** Returns the pixel decoder of an encoding. */
export function heightPixelDecoder(encoding: DemEncoding): HeightPixelDecoder {
    if (encoding === "terrarium") return terrariumHeight;
    if (encoding === "mapbox-terrain-rgb") return mapboxTerrainRgbHeight;
    return grayscaleHeight(encoding.minimum, encoding.maximum);
}

/**
 * Regular grid of heights in metres: a raster of one channel.
 *
 * Samples are row-major from the north-west corner. Missing samples are `NaN`.
 */
export interface IHeightGrid extends IRasterGrid<Float32Array> {
    channels: 1;
    /** Smallest valid height, or `NaN` when every sample is missing. */
    minimum: number;
    /** Largest valid height, or `NaN` when every sample is missing. */
    maximum: number;
    /** Number of missing samples. */
    noDataCount: number;
}

/** Builds a height grid, computing its range over the valid samples. */
export function createHeightGrid(width: number, height: number, data: Float32Array): IHeightGrid {
    assertRasterSize(width, height, 1, data.length);
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    let noDataCount = 0;
    for (let index = 0; index < data.length; index++) {
        const value = data[index]!;
        if (Number.isNaN(value)) {
            noDataCount++;
            continue;
        }
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
    }
    if (noDataCount === data.length) return { width, height, channels: 1, data, minimum: Number.NaN, maximum: Number.NaN, noDataCount };
    return { width, height, channels: 1, data, minimum, maximum, noDataCount };
}

/** Options of {@link decodeHeightGrid}. */
export interface IDecodeHeightGridOptions {
    /**
     * Treats pixels whose alpha is 0 as missing. Defaults to `true`.
     * Terrarium and Terrain-RGB tiles are opaque, so this only affects sources that mark gaps with transparency.
     */
    transparentAsNoData?: boolean;
}

/** Decodes RGBA pixels into a height grid. */
export function decodeHeightGrid(image: IRgbaImage, encoding: DemEncoding, options: IDecodeHeightGridOptions = {}): IHeightGrid {
    const { width, height, data } = image;
    if (data.length !== width * height * 4) throw new RangeError(`Expected ${width * height * 4} RGBA bytes, received ${data.length}.`);
    const decode = heightPixelDecoder(encoding);
    const transparentAsNoData = options.transparentAsNoData ?? true;
    const heights = new Float32Array(width * height);
    for (let index = 0, offset = 0; index < heights.length; index++, offset += 4) {
        heights[index] = transparentAsNoData && data[offset + 3] === 0 ? Number.NaN : decode(data[offset]!, data[offset + 1]!, data[offset + 2]!);
    }
    return createHeightGrid(width, height, heights);
}

/** Decodes the encoded image bytes of a DEM tile. */
export async function decodeDemTile(
    bytes: Uint8Array,
    encoding: DemEncoding,
    imageDecoder: IImageDecoder,
    options: IDecodeHeightGridOptions & { signal?: AbortSignal } = {}
): Promise<IHeightGrid> {
    const image = await imageDecoder.decode(bytes, options.signal);
    return decodeHeightGrid(image, encoding, options);
}
