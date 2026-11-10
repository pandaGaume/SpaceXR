import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import type { EngineOptions } from "@babylonjs/core/Engines/thinEngine.js";
import { WebGPUEngine, type WebGPUEngineOptions } from "@babylonjs/core/Engines/webgpuEngine.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Scene } from "@babylonjs/core/scene.js";

export interface IGeospatialEngineOptions {
    /** Defaults to true. */
    antialias?: boolean;
    /** Defaults to true. */
    adaptToDeviceRatio?: boolean;
    /** Merged over the geospatial defaults: stencil and large world rendering. */
    engineOptions?: EngineOptions;
}

export interface IGeospatialSceneOptions {
    clearColor?: Color4;
}

/**
 * Creates a WebGL engine for planetary ECEF coordinates. Large world rendering renders relative to the camera, so
 * tiles stay stable millions of metres away from the origin.
 */
export function createGeospatialEngine(canvas: HTMLCanvasElement, options: IGeospatialEngineOptions = {}): Engine {
    return new Engine(
        canvas,
        options.antialias ?? true,
        { stencil: true, useLargeWorldRendering: true, ...options.engineOptions },
        options.adaptToDeviceRatio ?? true,
    );
}

/** Graphics API of a geospatial engine. */
export type GeospatialRenderer = "webgl" | "webgpu";

export interface IGeospatialWebGPUEngineOptions {
    /** Defaults to true. */
    antialias?: boolean;
    /** Defaults to true. */
    adaptToDeviceRatio?: boolean;
    /** Merged over the geospatial defaults: stencil, large world rendering and the maximum limits of the adapter. */
    engineOptions?: WebGPUEngineOptions;
}

/**
 * Creates a WebGPU engine for planetary ECEF coordinates, with the large world rendering of
 * {@link createGeospatialEngine}. The engine requests the maximum limits of the adapter: WebGPU only guarantees 256
 * texture array layers, fewer than the raster pages a draped terrain keeps resident. The terrain engines and the
 * imagery drape run their WGSL shaders on it, and their GLSL shaders on WebGL.
 */
export async function createGeospatialWebGPUEngine(
    canvas: HTMLCanvasElement,
    options: IGeospatialWebGPUEngineOptions = {},
): Promise<WebGPUEngine> {
    const engine = new WebGPUEngine(canvas, {
        antialias: options.antialias ?? true,
        adaptToDeviceRatio: options.adaptToDeviceRatio ?? true,
        stencil: true,
        useLargeWorldRendering: true,
        setMaximumLimits: true,
        // Every feature of the adapter, timestamp queries included, which the monitor needs to measure GPU frame time.
        enableAllFeatures: true,
        ...options.engineOptions,
    });
    await engine.initAsync();
    return engine;
}

export interface IGeospatialRendererOptions {
    webgl?: IGeospatialEngineOptions;
    webgpu?: IGeospatialWebGPUEngineOptions;
}

/** An engine and the graphics API it renders with. */
export interface IGeospatialRendererEngine {
    engine: AbstractEngine;
    renderer: GeospatialRenderer;
}

/**
 * Creates a geospatial engine for a graphics API: WebGPU when it is requested and the browser supports it, WebGL
 * otherwise, so that browsers without WebGPU keep working. Support is checked before the canvas is bound, since a
 * canvas holding a WebGPU context can no longer hold a WebGL one.
 */
export async function createGeospatialRendererEngine(
    canvas: HTMLCanvasElement,
    renderer: GeospatialRenderer,
    options: IGeospatialRendererOptions = {},
): Promise<IGeospatialRendererEngine> {
    if (renderer === "webgpu" && (await WebGPUEngine.IsSupportedAsync))
        return { engine: await createGeospatialWebGPUEngine(canvas, options.webgpu), renderer: "webgpu" };
    return { engine: createGeospatialEngine(canvas, options.webgl), renderer: "webgl" };
}

/**
 * Creates a scene that uses the glTF and 3D Tiles right-handed convention. The engine may be a WebGL engine from
 * {@link createGeospatialEngine} or a WebGPU engine from {@link createGeospatialWebGPUEngine}.
 */
export function createGeospatialScene(engine: AbstractEngine, options: IGeospatialSceneOptions = {}): Scene {
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = options.clearColor ?? new Color4(0.008, 0.035, 0.09, 1);
    // Pointer moves would otherwise ray cast every tile mesh to raise hover events.
    scene.skipPointerMovePicking = true;
    return scene;
}
