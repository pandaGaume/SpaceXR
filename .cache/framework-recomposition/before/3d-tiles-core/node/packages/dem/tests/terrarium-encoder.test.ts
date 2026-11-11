import type { IRasterGrid } from "@spacexr/raster";
import { describe, expect, it } from "vitest";
import {
    TERRARIUM_HEIGHT_STEP,
    TERRARIUM_MIN_HEIGHT,
    TERRARIUM_MAX_HEIGHT,
    terrariumPixel,
    terrariumHeight,
    encodeTerrariumGrid,
    decodeHeightGrid,
    createHeightGrid,
} from "../src";

describe("Terrarium pixel encoding", () => {
    it.each([
        [0, [128, 0, 0, 255]],
        [1, [128, 1, 0, 255]],
        [-1, [127, 255, 0, 255]],
        [-32768, [0, 0, 0, 255]],
        [32767.99609375, [255, 255, 255, 255]],
        [0.5, [128, 0, 128, 255]],
        [NaN, [0, 0, 0, 0]],
    ])("encodes the known height %s", (height, pixel) => {
        expect(terrariumPixel(height as number)).toEqual(pixel);
    });
    it.each([0.9999, 255.9999, -0.0001, -256.0001])("propagates channel rounding carries for %s", (height) => {
        const pixel = terrariumPixel(height);
        expect(pixel.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)).toBe(true);
        expect(Math.abs(terrariumHeight(pixel[0], pixel[1], pixel[2]) - height)).toBeLessThanOrEqual(1 / 512 + 1e-10);
    });
    it("uses the higher height on exact ties", () => {
        expect(terrariumPixel(1 / 512)).toEqual([128, 0, 1, 255]);
        expect(terrariumPixel(-1 / 512)).toEqual([128, 0, 0, 255]);
        expect(TERRARIUM_HEIGHT_STEP).toBe(1 / 256);
    });
    it.each([Infinity, -Infinity, TERRARIUM_MIN_HEIGHT - 0.00001, TERRARIUM_MAX_HEIGHT + 0.00001])("rejects %s without saturation", (height) => {
        expect(() => terrariumPixel(height)).toThrow(RangeError);
    });
    it("bounds quantization error across negative, positive and boundary values", () => {
        for (let index = 0; index <= 4096; index++) {
            const height = TERRARIUM_MIN_HEIGHT + ((TERRARIUM_MAX_HEIGHT - TERRARIUM_MIN_HEIGHT) * index) / 4096;
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
        expect(grid.data[0]).toBe(12.5);
        expect(grid.data[1]).toBeNaN();
        expect(grid.data[2]).toBe(-32768);
        expect(grid.data[3]).toBe(32767.99609375);
        expect(grid.noDataCount).toBe(1);
        expect(heights.data[1]).toBeNaN();
    });
    it("accepts Float64 heights and an exact destination view without touching surrounding bytes", () => {
        const backing = new Uint8Array(12).fill(42),
            target = backing.subarray(2, 10);
        const source = { width: 2, height: 1, channels: 1, data: new Float64Array([0.9999, NaN]) };
        expect(encodeTerrariumGrid(source, target).data).toBe(target);
        expect([...backing]).toEqual([42, 42, 128, 1, 0, 255, 0, 0, 0, 0, 42, 42]);
    });
    it("preserves shared samples on adjacent 257-square tile borders", () => {
        function tile(x: number) {
            const data = new Float64Array(257 * 257);
            for (let row = 0; row < 257; row++) for (let column = 0; column < 257; column++) data[row * 257 + column] = (x * 256 + column) / 7 + row / 9;
            return encodeTerrariumGrid({ width: 257, height: 257, channels: 1, data });
        }
        const left = tile(0),
            right = tile(1);
        for (let row = 0; row < 257; row++) {
            expect(left.data.slice((row * 257 + 256) * 4, (row * 257 + 257) * 4)).toEqual(right.data.slice(row * 257 * 4, (row * 257 + 1) * 4));
        }
    });
    it("rejects non-height channels and inconsistent dimensions", () => {
        for (const grid of [
            { width: 1, height: 1, channels: 2, data: new Float32Array(2) },
            { width: 0, height: 1, channels: 1, data: new Float32Array(0) },
            { width: 2, height: 1, channels: 1, data: new Float32Array(1) },
        ])
            expect(() => encodeTerrariumGrid(grid)).toThrow(RangeError);
    });
    it("preserves the destination when an input height or destination length is invalid", () => {
        const target = new Uint8Array(8).fill(17);
        const grid = { width: 2, height: 1, channels: 1, data: new Float32Array([0, Infinity]) };
        expect(() => encodeTerrariumGrid(grid, target)).toThrow(RangeError);
        expect([...target]).toEqual(Array(8).fill(17));
        expect(() => encodeTerrariumGrid(createHeightGrid(1, 1, new Float32Array([0])), new Uint8Array(3))).toThrow(RangeError);
    });
    it("rejects overlapping source/destination views and accepts disjoint views", () => {
        const buffer = new ArrayBuffer(16);
        const grid: IRasterGrid<Float32Array> = { width: 1, height: 1, channels: 1, data: new Float32Array(buffer, 0, 1) };
        expect(() => encodeTerrariumGrid(grid, new Uint8Array(buffer, 0, 4))).toThrow(RangeError);
        const target = new Uint8ClampedArray(buffer, 4, 4);
        expect(encodeTerrariumGrid(grid, target).data).toBe(target);
        expect([...target]).toEqual([128, 0, 0, 255]);
    });
});
