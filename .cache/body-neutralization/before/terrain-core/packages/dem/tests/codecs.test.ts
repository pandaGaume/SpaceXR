import type { IImageDecoder, IRgbaImage } from "@spacexr/raster";
import { describe, expect, it } from "vitest";

import { createHeightGrid, decodeDemTile, decodeHeightGrid, grayscaleHeight, mapboxTerrainRgbHeight, terrariumHeight, terrariumPixel } from "../src";

function image(pixels: Array<[number, number, number, number]>, width: number): IRgbaImage {
    return { width, height: pixels.length / width, channels: 4, data: new Uint8ClampedArray(pixels.flat()) };
}

describe("DEM pixel decoders", () => {
    it("decodes Terrarium pixels", () => {
        expect(terrariumHeight(128, 0, 0)).toBe(0);
        expect(terrariumHeight(0, 0, 0)).toBe(-32768);
        expect(terrariumHeight(...(terrariumPixel(8848.5).slice(0, 3) as [number, number, number]))).toBe(8848.5);
        expect(terrariumHeight(...(terrariumPixel(-430.25).slice(0, 3) as [number, number, number]))).toBe(-430.25);
    });

    it("decodes Mapbox Terrain-RGB pixels", () => {
        expect(mapboxTerrainRgbHeight(1, 134, 160)).toBeCloseTo(0, 9);
        expect(mapboxTerrainRgbHeight(0, 0, 0)).toBe(-10000);
    });

    it("decodes linear grey levels", () => {
        const decode = grayscaleHeight(-100, 410);
        expect(decode(0, 0, 0)).toBe(-100);
        expect(decode(255, 0, 0)).toBe(410);
        expect(decode(51, 0, 0)).toBe(2);
        expect(() => grayscaleHeight(10, 0)).toThrow(RangeError);
    });
});

describe("height grids", () => {
    it("decodes an image, marking transparent pixels as missing", () => {
        const grid = decodeHeightGrid(image([terrariumPixel(10), terrariumPixel(-5), [128, 0, 0, 0], terrariumPixel(250)], 2), "terrarium");
        expect(grid.width).toBe(2);
        expect(grid.height).toBe(2);
        expect([...grid.data.slice(0, 2), grid.data[3]]).toEqual([10, -5, 250]);
        expect(grid.data[2]).toBeNaN();
        expect(grid).toMatchObject({ minimum: -5, maximum: 250, noDataCount: 1 });
    });

    it("can keep transparent pixels", () => {
        const grid = decodeHeightGrid(image([[128, 0, 0, 0]], 1), "terrarium", { transparentAsNoData: false });
        expect(grid).toMatchObject({ minimum: 0, maximum: 0, noDataCount: 0 });
    });

    it("reports an empty range when every sample is missing", () => {
        const grid = createHeightGrid(2, 1, new Float32Array([Number.NaN, Number.NaN]));
        expect(grid.minimum).toBeNaN();
        expect(grid.noDataCount).toBe(2);
    });

    it("rejects inconsistent dimensions", () => {
        expect(() => decodeHeightGrid({ width: 2, height: 2, channels: 4, data: new Uint8Array(12) }, "terrarium")).toThrow(RangeError);
        expect(() => createHeightGrid(3, 1, new Float32Array(2))).toThrow(RangeError);
    });

    it("decodes DEM tile bytes through an image decoder port", async () => {
        const decoder: IImageDecoder = { decode: () => Promise.resolve(image([terrariumPixel(1234)], 1)) };
        const grid = await decodeDemTile(new Uint8Array([1]), "terrarium", decoder);
        expect(grid.data[0]).toBe(1234);
    });
});
