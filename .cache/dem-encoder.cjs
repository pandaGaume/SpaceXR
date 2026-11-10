const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/3d-tiles-core';
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
function write(f,s){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),s.trimStart()+'\n');}
write('node/packages/dem/src/codecs/terrarium-encoder.ts',`import { assertRasterSize, type IRasterGrid, type IRgbaImage } from "@spacexr/raster";

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
 * \u0060\u0060\u0060ts
 * terrariumPixel(0); // [128, 0, 0, 255]
 * terrariumPixel(0.9999); // [128, 1, 0, 255], rounding carries into green
 * \u0060\u0060\u0060
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
 * \u0060\u0060\u0060ts
 * const heights = createHeightGrid(2, 1, new Float32Array([12.5, NaN]));
 * const pixels = encodeTerrariumGrid(heights);
 * const restored = decodeHeightGrid(pixels, "terrarium");
 * \u0060\u0060\u0060
 */
export function encodeTerrariumGrid(
    grid: IRasterGrid<Float32Array | Float64Array>,
    target?: Uint8Array | Uint8ClampedArray,
): IRgbaImage {
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
`);
write('node/packages/dem/src/codecs/index.ts',read('node/packages/dem/src/codecs/index.ts')+'export * from "./terrarium-encoder";\n');
let tests=read('node/packages/dem/tests/codecs.test.ts');
tests=tests.replace('mapboxTerrainRgbHeight, terrariumHeight','mapboxTerrainRgbHeight, terrariumHeight, terrariumPixel');
tests=tests.replace(/\/\*\* Encodes a height in Terrarium pixels[\s\S]*?\n\}\n\n/,'');
write('node/packages/dem/tests/codecs.test.ts',tests);
write('node/packages/dem/tests/terrarium-encoder.test.ts',`import type { IRasterGrid } from "@spacexr/raster";
import { describe, expect, it } from "vitest";
import {
    TERRARIUM_HEIGHT_STEP, TERRARIUM_MIN_HEIGHT, TERRARIUM_MAX_HEIGHT,
    terrariumPixel, terrariumHeight, encodeTerrariumGrid, decodeHeightGrid, createHeightGrid,
} from "../src";

describe("Terrarium pixel encoding", () => {
    it.each([
        [0, [128, 0, 0, 255]], [1, [128, 1, 0, 255]], [-1, [127, 255, 0, 255]],
        [-32768, [0, 0, 0, 255]], [32767.99609375, [255, 255, 255, 255]],
        [0.5, [128, 0, 128, 255]], [NaN, [0, 0, 0, 0]],
    ])("encodes the known height %s", (height, pixel) => {
        expect(terrariumPixel(height as number)).toEqual(pixel);
    });
    it.each([0.9999, 255.9999, -0.0001, -256.0001])("propagates channel rounding carries for %s", height => {
        const pixel = terrariumPixel(height);
        expect(pixel.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)).toBe(true);
        expect(Math.abs(terrariumHeight(pixel[0], pixel[1], pixel[2]) - height)).toBeLessThanOrEqual(1 / 512 + 1e-10);
    });
    it("uses the higher height on exact ties", () => {
        expect(terrariumPixel(1 / 512)).toEqual([128, 0, 1, 255]);
        expect(terrariumPixel(-1 / 512)).toEqual([128, 0, 0, 255]);
        expect(TERRARIUM_HEIGHT_STEP).toBe(1 / 256);
    });
    it.each([Infinity, -Infinity, TERRARIUM_MIN_HEIGHT - 0.00001, TERRARIUM_MAX_HEIGHT + 0.00001])("rejects %s without saturation", height => {
        expect(() => terrariumPixel(height)).toThrow(RangeError);
    });
    it("bounds quantization error across negative, positive and boundary values", () => {
        for (let index = 0; index <= 4096; index++) {
            const height = TERRARIUM_MIN_HEIGHT + (TERRARIUM_MAX_HEIGHT - TERRARIUM_MIN_HEIGHT) * index / 4096;
            const [r, g, b] = terrariumPixel(height);
            expect(Math.abs(terrariumHeight(r, g, b) - height)).toBeLessThanOrEqual(1 / 512 + 1e-10);
        }
    });
});

describe("Terrarium raster encoding", () => {
    it("round-trips metre grids and NoData through the public decoder", () => {
        const heights = createHeightGrid(2, 2, new Float32Array([12.5, NaN, -32768, 32767.99609375]));
        const pixels = encodeTerrariumGrid(heights);
        expect(pixels).toMatchObject({ width: 2, height: 2, channels: 4 });
        const grid = decodeHeightGrid(pixels, "terrarium");
        expect(grid.data[0]).toBe(12.5); expect(grid.data[1]).toBeNaN();
        expect(grid.data[2]).toBe(-32768); expect(grid.data[3]).toBe(32767.99609375);
        expect(grid.noDataCount).toBe(1);expect(heights.data[1]).toBeNaN();
    });
    it("accepts Float64 heights and an exact destination view without touching surrounding bytes", () => {
        const backing = new Uint8Array(12).fill(42), target = backing.subarray(2, 10);
        const source = { width: 2, height: 1, channels: 1, data: new Float64Array([0.9999, NaN]) };
        expect(encodeTerrariumGrid(source, target).data).toBe(target);
        expect([...backing]).toEqual([42,42,128,1,0,255,0,0,0,0,42,42]);
    });
    it("preserves shared samples on adjacent 257-square tile borders", () => {
        function tile(x: number) {
            const data = new Float64Array(257 * 257);
            for (let row = 0; row < 257; row++) for (let column = 0; column < 257; column++) data[row * 257 + column] = (x * 256 + column) / 7 + row / 9;
            return encodeTerrariumGrid({ width: 257, height: 257, channels: 1, data });
        }
        const left = tile(0), right = tile(1);
        for (let row = 0; row < 257; row++) {
            expect(left.data.slice((row * 257 + 256) * 4, (row * 257 + 257) * 4)).toEqual(right.data.slice(row * 257 * 4, (row * 257 + 1) * 4));
        }
    });
    it("rejects non-height channels and inconsistent dimensions", () => {
        for (const grid of [
            {width: 1, height: 1, channels: 2, data: new Float32Array(2)},
            {width: 0, height: 1, channels: 1, data: new Float32Array(0)},
            {width: 2, height: 1, channels: 1, data: new Float32Array(1)},
        ]) expect(() => encodeTerrariumGrid(grid)).toThrow(RangeError);
    });
    it("preserves the destination when an input height or destination length is invalid", () => {
        const target = new Uint8Array(8).fill(17);
        const grid = {width: 2, height: 1, channels: 1, data: new Float32Array([0, Infinity])};
        expect(() => encodeTerrariumGrid(grid, target)).toThrow(RangeError);
        expect([...target]).toEqual(Array(8).fill(17));
        expect(() => encodeTerrariumGrid(createHeightGrid(1, 1, new Float32Array([0])), new Uint8Array(3))).toThrow(RangeError);
    });
    it("rejects overlapping source/destination views and accepts disjoint views", () => {
        const buffer = new ArrayBuffer(16);
        const grid: IRasterGrid<Float32Array> = {width: 1, height: 1, channels: 1, data: new Float32Array(buffer,0,1)};
        expect(() => encodeTerrariumGrid(grid, new Uint8Array(buffer,0,4))).toThrow(RangeError);
        const target = new Uint8ClampedArray(buffer,4,4);
        expect(encodeTerrariumGrid(grid,target).data).toBe(target);
        expect([...target]).toEqual([128,0,0,255]);
    });
});
`);
const section=`## Encode Terrarium elevation pixels

\u0060\u0060\u0060ts
import { createHeightGrid, encodeTerrariumGrid, terrariumPixel } from "@spacexr/dem";

const pixel = terrariumPixel(12.5); // [128, 12, 128, 255]
const heights = createHeightGrid(2, 1, new Float32Array([12.5, NaN]));
const pixels = encodeTerrariumGrid(heights);
\u0060\u0060\u0060

Terrarium stores metre heights in RGB with a step of 1/256 metre and a maximum rounding error of 1/512 metre. Supported finite heights are -32768 to 32767.99609375 metres inclusive. NaN becomes a transparent NoData pixel; other invalid or out-of-range values throw. The minimum valid height is opaque and is distinct from NoData.

encodeTerrariumGrid accepts one Float32 or Float64 channel and returns raw unpremultiplied RGBA pixels with the same dimensions and sample order. An optional Uint8Array or Uint8ClampedArray destination avoids allocating the output buffer. Invalid input is detected before writing that destination. Source and destination storage must not overlap.

The output is not a PNG byte stream. Store it with a lossless image encoder that preserves channel bytes and does not apply colour conversion or alpha premultiplication. Grid dimensions are unrestricted, including 257 by 257 vertex samples; the caller defines the sampling positions and shared borders.

`;
write('node/packages/dem/README.md',read('node/packages/dem/README.md').replace('## Continuous surfaces',section+'## Continuous surfaces'));
write('docs/dem.md',read('docs/dem.md').replace('## Statistics and normals',`## Terrarium encoding

- A valid height h in metres becomes the integer q = round((h + 32768) * 256). Round ties toward the higher height. Split the whole integer into R = floor(q / 65536), G = floor(q / 256) mod 256, B = q mod 256, and A = 255. Rounding the integer before splitting preserves channel carries.
- The inclusive input range is [-32768, 32767.99609375] metres. Reject infinities and values outside that interval; do not silently saturate. The quantization step is 1/256 metre and the maximum rounding error is 1/512 metre.
- NaN encodes to [0, 0, 0, 0]. The lowest valid height encodes to [0, 0, 0, 255], so it remains distinct from missing data.
- Preserve row-major north-west sample order, grid dimensions and source heights. Encoding does not resample or create shared borders. A caller-supplied destination is exact-sized, non-overlapping and remains unchanged if validation fails.
- Encoded pixels are raw RGBA. A separate lossless image encoder must preserve their bytes, colour interpretation and unpremultiplied alpha. The elevation codec does not perform image compression.

## Statistics and normals`));
console.log('Public Terrarium pixel/grid encoder and contracts prepared.');
