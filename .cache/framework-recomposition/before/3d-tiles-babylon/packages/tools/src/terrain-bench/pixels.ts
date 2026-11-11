import type { IRgbaImage } from "@spacexr/raster";
import { BENCH_VIEWS } from "./scenarios";

/** What a renderer comparison draws: example parameters, without the view and the renderer. */
export interface IRendererVariant {
    name: string;
    query: string;
}

/**
 * Every shader path of both engines: shaded, draped, Mapzen and DEM normals, ambient light, and wireframe. Imagery is
 * the debug pyramid drawn in the page, so that only DEM and normal tiles come from the network.
 */
export const RENDERER_VARIANTS: readonly IRendererVariant[] = [
    { name: "mesh", query: "engine=mesh&solid=1&imagery=none" },
    { name: "mesh-imagery", query: "engine=mesh&solid=1&imagery=debug" },
    { name: "mesh-wireframe", query: "engine=mesh" },
    { name: "gpu", query: "engine=gpu&solid=1&imagery=none&normals=mapzen" },
    { name: "gpu-dem-normals", query: "engine=gpu&solid=1&imagery=none&normals=dem" },
    { name: "gpu-imagery", query: "engine=gpu&solid=1&imagery=debug&normals=mapzen" },
    { name: "gpu-ambient", query: "engine=gpu&solid=1&imagery=debug&lighting=ambient" },
    { name: "gpu-wireframe", query: "engine=gpu" },
];

/** One image drawn by WebGL from GLSL and by WebGPU from WGSL. */
export interface IRendererCase {
    id: string;
    /** Address of the page, without its renderer. */
    url: string;
}

/**
 * Without multisampling: its resolved edges depend on the hardware and the graphics API, not on the shaders.
 */
export const RENDERER_COMPARISON_QUERY = "antialias=0";

/**
 * Every variant at every bench view, with the camera at rest where the view places it, without multisampling.
 *
 * @param base - Address of the example.
 */
export function rendererCases(base: string): IRendererCase[] {
    const root = base.replace(/\/+$/, "");
    return BENCH_VIEWS.flatMap((view) =>
        RENDERER_VARIANTS.map((variant) => ({
            id: `${view.name}/${variant.name}`,
            url: `${root}/?${RENDERER_COMPARISON_QUERY}&${variant.query}&${view.query}`,
        })),
    );
}

/** How two images differ, pixel by pixel. */
export interface IImageDifference {
    pixels: number;
    /** Pixels where any channel differs. */
    differingPixels: number;
    /** Largest absolute difference of each channel, red, green, blue and alpha. */
    maxDifference: [number, number, number, number];
    /** Black where the images agree; elsewhere the largest channel difference, scaled so that 1 shows. */
    image: IRgbaImage;
}

/**
 * Compares two images of the same size.
 *
 * @throws RangeError When their sizes differ.
 */
export function compareImages(a: IRgbaImage, b: IRgbaImage): IImageDifference {
    if (a.width !== b.width || a.height !== b.height)
        throw new RangeError(`Images of ${a.width}x${a.height} and ${b.width}x${b.height} pixels cannot be compared.`);
    const pixels = a.width * a.height;
    const maxDifference: [number, number, number, number] = [0, 0, 0, 0];
    const data = new Uint8Array(pixels * 4);
    let differingPixels = 0;
    for (let pixel = 0; pixel < pixels; pixel++) {
        let largest = 0;
        for (let channel = 0; channel < 4; channel++) {
            const index = pixel * 4 + channel;
            const difference = Math.abs(a.data[index]! - b.data[index]!);
            if (difference > maxDifference[channel]!) maxDifference[channel] = difference;
            largest = Math.max(largest, difference);
        }
        if (largest > 0) differingPixels++;
        const shown = largest > 0 ? Math.min(255, 64 + largest * 16) : 0;
        data.set([shown, shown, shown, 255], pixel * 4);
    }
    return { pixels, differingPixels, maxDifference, image: { width: a.width, height: a.height, channels: 4, data } };
}
