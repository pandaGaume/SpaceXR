import "./style.css";
import "@babylonjs/loaders/glTF/2.0/index.js";

import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import {
    BabylonGltfTileAdapter,
    BabylonRuntimeDriver,
    CopyrightAttributions,
    createGeospatialCamera,
    createGeospatialRendererEngine,
    createGeospatialScene,
    type IBabylonGltfTileHandle,
} from "@spacexr/3d-tiles-babylon";
import {
    EcefSpatialMetric,
    TileRuntime,
    type IEcefCameraFrame,
    type IEcefSpatialState,
    type IRuntimeAdapter,
} from "@spacexr/3d-tiles-runtime";
import { GeodeticSystem } from "@spacexr/geodesy";

import { loadExampleConfig } from "./config";
import { GoogleTilesetLoader, GoogleTilesUriResolver, googleRequestError } from "./google-tiles";

function requiredElement<TElement extends HTMLElement>(id: string, constructor: { new (): TElement }): TElement {
    const element = document.getElementById(id);
    if (!(element instanceof constructor)) throw new Error(`Required element #${id} is missing.`);
    return element;
}

function megabytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeErrorSummary(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 240);
}

async function run(): Promise<void> {
    const config = loadExampleConfig();
    const canvas = requiredElement("render-canvas", HTMLCanvasElement);
    const status = requiredElement("runtime-status", HTMLSpanElement);
    const statistics = requiredElement("runtime-statistics", HTMLSpanElement);
    const dataAttribution = requiredElement("data-attribution", HTMLSpanElement);

    // `?renderer=webgpu` runs on the WebGPU engine of Babylon where the browser supports it, WebGL otherwise.
    const requestedRenderer = new URLSearchParams(window.location.search).get("renderer") === "webgpu" ? "webgpu" : "webgl";
    const { engine, renderer } = await createGeospatialRendererEngine(canvas, requestedRenderer);
    const scene = createGeospatialScene(engine, { clearColor: new Color4(0.027, 0.082, 0.176, 1) });

    const geodeticSystem = GeodeticSystem.WGS84;
    const initialNormal = geodeticSystem.geodeticSurfaceNormalDegrees(config.latitudeDegrees, config.longitudeDegrees);
    const light = new HemisphericLight("ambient-light", new Vector3(initialNormal.x, initialNormal.y, initialNormal.z), scene);
    light.intensity = 1.8;
    const camera = createGeospatialCamera(scene, {
        name: "viewer-camera",
        geodeticSystem,
        target: {
            latitudeDegrees: config.latitudeDegrees,
            longitudeDegrees: config.longitudeDegrees,
            heightMeters: config.heightMeters,
        },
        radius: config.cameraDistanceMeters,
    });

    const resolver = new GoogleTilesUriResolver();
    const attributions = new CopyrightAttributions();
    const unsubscribeAttributions = attributions.subscribe((sources) => {
        dataAttribution.textContent = sources.length > 0 ? ` | ${sources.join("; ")}` : "";
    });
    const content = new BabylonGltfTileAdapter(scene, { resolver, createRequestError: googleRequestError, attributions });
    const adapter: IRuntimeAdapter<IEcefCameraFrame, IEcefSpatialState, IBabylonGltfTileHandle, never> = {
        tilesets: new GoogleTilesetLoader(resolver),
        activation: content,
        presentation: content,
        spatial: new EcefSpatialMetric({ geodeticSystem }),
        uri: resolver,
    };
    const runtime = new TileRuntime<IEcefCameraFrame, IEcefSpatialState, IBabylonGltfTileHandle, never>({
        id: "google-photorealistic-3d-tiles",
        uri: resolver.rootTilesetUri,
        adapter,
        maxScreenSpaceError: 16,
        refinementHysteresisRatio: 0.2,
        maxConcurrentLoads: 8,
        // Memory budgets of the example; the runtime defaults keep the tiles around the view while the camera moves.
        cache: {
            maxContentCpuBytes: 384 * 1024 * 1024,
            maxContentGpuBytes: 768 * 1024 * 1024,
        },
        instrumentation: true,
    });

    const unsubscribeStatistics = runtime.instrumentation.subscribe((snapshot) => {
        statistics.textContent = `${snapshot.nodes.selected}/${snapshot.nodes.total} nodes | ${snapshot.contents.ready} ready | ${snapshot.contents.loading + snapshot.contents.queued} loading | ${snapshot.contents.error} errors | ${megabytes(snapshot.contents.gpuBytes)} GPU`;
    });
    const unsubscribeEvents = runtime.events.subscribe((event) => {
        if (event.type !== "error") return;
        status.textContent = `Runtime error during ${event.phase}: ${safeErrorSummary(event.error)}`;
        console.error("3D Tiles runtime error", event.error);
    });

    const driver = new BabylonRuntimeDriver(runtime, scene, {
        camera,
        onError: (error) => {
            status.textContent = "Runtime update failed";
            console.error("3D Tiles update failed", error);
        },
    });
    status.textContent = "Loading Google Photorealistic 3D Tiles...";
    await driver.start();
    status.textContent = `${config.latitudeDegrees.toFixed(4)}, ${config.longitudeDegrees.toFixed(4)} | ${renderer === "webgpu" ? "WebGPU" : "WebGL"}`;
    engine.runRenderLoop(() => scene.render());

    // Objects of the example, for probes run from the browser console.
    (window as unknown as Record<string, unknown>).__SPACEXR_EXAMPLE__ = { runtime, scene, camera, renderer };

    const resize = (): void => engine.resize();
    window.addEventListener("resize", resize);
    window.addEventListener(
        "beforeunload",
        () => {
            window.removeEventListener("resize", resize);
            driver.dispose();
            unsubscribeStatistics();
            unsubscribeEvents();
            void runtime.dispose();
            attributions.clear();
            unsubscribeAttributions();
            scene.dispose();
            engine.dispose();
        },
        { once: true },
    );
}

void run().catch((error: unknown) => {
    const status = document.getElementById("runtime-status");
    if (status) status.textContent = error instanceof Error ? error.message : "The example could not start.";
    console.error("Babylon Google 3D Tiles example failed", error);
});
