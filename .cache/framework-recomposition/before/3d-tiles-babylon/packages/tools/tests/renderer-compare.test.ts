import { PngDataDecoder, type IRgbaImage } from "@spacexr/raster";
import { describe, expect, it } from "vitest";

import { compareImages, RENDERER_VARIANTS, rendererCases } from "../src/terrain-bench/pixels";
import { encodePng } from "../src/terrain-bench/png";
import { BENCH_VIEWS } from "../src/terrain-bench/scenarios";

const image = (width: number, height: number, pixel: (x: number, y: number) => number[]): IRgbaImage => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
    return { width, height, channels: 4, data };
};

const gradient = image(5, 3, (x, y) => [x * 50, y * 100, (x * y * 37) % 256, 255]);

describe("encodePng", () => {
    it("writes what the PNG decoder of the raster package reads back", async () => {
        expect(await new PngDataDecoder().decode(encodePng(gradient))).toEqual(gradient);
    });
});

describe("compareImages", () => {
    it("finds no difference between equal images", () => {
        const difference = compareImages(gradient, { ...gradient, data: gradient.data.slice() });
        expect(difference.differingPixels).toBe(0);
        expect(difference.maxDifference).toEqual([0, 0, 0, 0]);
        expect(difference.image.data.every((value, index) => value === (index % 4 === 3 ? 255 : 0))).toBe(true);
    });

    it("counts differing pixels and keeps the largest difference of each channel", () => {
        const other = image(5, 3, (x, y) => {
            const [r, g, b, a] = gradient.data.subarray((y * 5 + x) * 4, (y * 5 + x) * 4 + 4);
            return x === 1 && y === 2 ? [r! + 3, g!, b! - 1, a!] : x === 4 && y === 0 ? [r!, g! + 1, b!, a!] : [r!, g!, b!, a!];
        });
        const difference = compareImages(gradient, other);
        expect(difference.pixels).toBe(15);
        expect(difference.differingPixels).toBe(2);
        expect(difference.maxDifference).toEqual([3, 1, 1, 0]);
        // A difference of one still shows.
        expect(difference.image.data[(0 * 5 + 4) * 4]).toBeGreaterThan(0);
    });

    it("refuses images of different sizes", () => {
        expect(() =>
            compareImages(
                gradient,
                image(3, 5, () => [0, 0, 0, 255]),
            ),
        ).toThrow(RangeError);
    });
});

describe("renderer cases", () => {
    it("covers every variant at every bench view, under unique ids", () => {
        const cases = rendererCases("http://localhost:5174/");
        expect(cases).toHaveLength(BENCH_VIEWS.length * RENDERER_VARIANTS.length);
        expect(new Set(cases.map((scenario) => scenario.id)).size).toBe(cases.length);
        expect(cases.every((scenario) => scenario.url.startsWith("http://localhost:5174/?antialias=0&engine="))).toBe(true);
    });

    it("draws both engines, shaded and wireframe, and every lighting of the GPU engine", () => {
        const queries = RENDERER_VARIANTS.map((variant) => variant.query);
        for (const engine of ["mesh", "gpu"]) {
            expect(queries.some((query) => query.includes(`engine=${engine}&solid=1`))).toBe(true);
            expect(queries).toContain(`engine=${engine}`);
        }
        for (const part of ["normals=mapzen", "normals=dem", "lighting=ambient", "imagery=debug"])
            expect(queries.some((query) => query.startsWith("engine=gpu") && query.includes(part))).toBe(true);
    });
});
