import "./style.css";

import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import {
    BabylonRasterPages,
    BabylonRasterTileAdapter,
    BabylonRuntimeDriver,
    BabylonRuntimeMonitor,
    GpuTerrainEngine,
    MeshTerrainEngine,
    TERRAIN_CONFIG,
    TILE_METRICS,
    createGeodesicGridSource,
    createGeospatialCamera,
    metadataTileAddress,
    type IGridElevationOptions,
    type ITerrainEngine,
    type ITerrainEngineInputs,
    type IBabylonRasterPage,
    createGeospatialRendererEngine,
    createGeospatialScene,
} from "@spacexr/3d-tiles-babylon";
import {
    DenseImplicitSubtreeLoader,
    EcefSpatialMetric,
    TileRuntime,
    VerticalScale,
    WebMercatorTileMetrics,
    type IEcefCameraFrame,
    type ITileAddress,
    type IEcefSpatialState,
    type IRuntimeAdapter,
} from "@spacexr/3d-tiles-runtime";
import { GeodeticSystem } from "@spacexr/geodesy";
import {
    ChildHeightRanges,
    DemPyramid,
    WorkerDemDecoder,
    createMapzenTerrariumSource,
    createMapzenNormalsSource,
    decodeMapzenNormalPixels,
    webDemTileLoader,
    type IDemWorkerEndpoint,
} from "@spacexr/dem";

import { PngDataDecoder } from "@spacexr/raster";

import DemDecoderWorker from "./dem-decoder.worker?worker";
import { debugImageryTile } from "./debug-imagery";
import { loadLocalImagery } from "./local-imagery";
import { clearMonitorPanel, renderMonitorPanel } from "./monitor-panel";
import places from "./places.json";

interface IPlace {
    latitude: number;
    longitude: number;
    /** Height of the point the camera orbits, in metres. */
    height: number;
}

/**
 * The point the camera orbits. `place` names an entry of places.json, `mont-blanc` by default. `lat` and `lon`, in
 * degrees, give any other point instead, at `height` metres, 0 by default.
 */
function cameraTarget(parameters: URLSearchParams): IPlace {
    const latitude = parameters.get("lat");
    const longitude = parameters.get("lon");
    if (latitude !== null || longitude !== null) {
        const point = {
            latitude: Number(latitude),
            longitude: Number(longitude),
            height: Number(parameters.get("height") ?? "0"),
        };
        if (
            latitude === null ||
            longitude === null ||
            !Object.values(point).every(Number.isFinite) ||
            Math.abs(point.latitude) > 90 ||
            Math.abs(point.longitude) > 180
        )
            throw new RangeError(
                "lat and lon must both be given, in degrees, and height in metres.",
            );
        return point;
    }
    const name = parameters.get("place") ?? "mont-blanc";
    const place = (places as Record<string, IPlace | undefined>)[name];
    if (!place)
        throw new RangeError(
            `place must be one of ${Object.keys(places).join(", ")}.`,
        );
    return {
        latitude: place.latitude,
        longitude: place.longitude,
        height: Number(parameters.get("height") ?? place.height),
    };
}

function requiredElement<TElement extends HTMLElement>(
    id: string,
    constructor: { new (): TElement },
): TElement {
    const element = document.getElementById(id);
    if (!(element instanceof constructor))
        throw new Error(`Required element #${id} is missing.`);
    return element;
}

/** PNG and elevation decoding take about 60 ms per tile; workers keep it off the render loop. */
function createDemDecoder(): WorkerDemDecoder {
    return new WorkerDemDecoder(
        Array.from(
            {
                length: Math.max(
                    1,
                    Math.min(4, (navigator.hardwareConcurrency || 2) - 1),
                ),
            },
            () => new DemDecoderWorker() as unknown as IDemWorkerEndpoint,
        ),
    );
}

async function run(): Promise<void> {
    const startupStartedAt = performance.now();
    const canvas = requiredElement("render-canvas", HTMLCanvasElement);
    const status = requiredElement("runtime-status", HTMLSpanElement);
    const panel = {
        tiles: requiredElement("runtime-statistics", HTMLSpanElement),
        memory: requiredElement("memory-statistics", HTMLSpanElement),
        cleanup: requiredElement("cleanup-statistics", HTMLSpanElement),
        renderer: requiredElement("renderer-statistics", HTMLSpanElement),
        frame: requiredElement("frame-statistics", HTMLSpanElement),
    };
    const tileLabels = requiredElement("tile-labels", HTMLDivElement);
    const parameters = new URLSearchParams(window.location.search);
    // `renderer=webgpu` runs the WGSL shaders on the WebGPU engine of Babylon where the browser supports it, WebGL and GLSL otherwise.
    // `antialias=0` removes multisampling, whose resolved edges depend on the hardware and the graphics API.
    const antialias = parameters.get("antialias") !== "0";
    const { engine, renderer } = await createGeospatialRendererEngine(
        canvas,
        parameters.get("renderer") === "webgpu" ? "webgpu" : "webgl",
        { webgl: { antialias }, webgpu: { antialias } },
    );
    const scene = createGeospatialScene(engine);

    const geodeticSystem = GeodeticSystem.WGS84;
    const gridCells = TERRAIN_CONFIG.grid.cells;
    // DEM tiles kept in memory.
    const demCacheEntries = Number(
        parameters.get("demCache") ?? TERRAIN_CONFIG.dem.cacheEntries,
    );
    // Time a DEM load nobody waits for any more goes on before it is aborted.
    const demAbortDelay = Number(
        parameters.get("demAbortDelay") ??
            TERRAIN_CONFIG.dem.abortDelayMilliseconds,
    );
    const monitoringEnabled = parameters.get("monitor") !== "0";
    const solidRendering = parameters.get("solid") === "1";
    const elevationEnabled = parameters.get("elevation") !== "0";
    const junctions = parameters.get("junctions") ?? "fine";
    if (junctions !== "fine" && junctions !== "coarse" && junctions !== "none")
        throw new RangeError(
            "The junctions parameter must be fine, coarse or none.",
        );
    const edgeHeights = parameters.get("heights") ?? "coarsest";
    if (
        edgeHeights !== "coarsest" &&
        edgeHeights !== "finest" &&
        edgeHeights !== "average"
    )
        throw new RangeError(
            "The heights parameter must be coarsest, finest or average.",
        );
    // Refined tiles coarsen only once their error drops below (1 - hysteresis) times the threshold.
    const hysteresis = Number(
        parameters.get("hysteresis") ?? TERRAIN_CONFIG.selection.hysteresis,
    );
    // Refined tiles wait this long before coarsening, so that a neighbour leaving the view does not flicker them.
    const coarsenDelay = Number(
        parameters.get("coarsenDelay") ??
            TERRAIN_CONFIG.selection.coarseningDelayMilliseconds,
    );
    // Main-thread milliseconds per frame for rebuilding grids whose neighbours changed; the rest waits for the next frames.
    const junctionBudget = Number(
        parameters.get("junctionBudget") ??
            TERRAIN_CONFIG.mesh.junctionBudgetMilliseconds,
    );
    const demInterpolation =
        parameters.get("interpolation") ?? TERRAIN_CONFIG.dem.interpolation;
    if (
        demInterpolation !== "nearest" &&
        demInterpolation !== "linear" &&
        demInterpolation !== "bilinear" &&
        demInterpolation !== "cubic"
    )
        throw new RangeError(
            "The interpolation parameter must be cubic, bilinear, linear or nearest.",
        );
    const demGeneratedLevels = Number(
        parameters.get("demGeneratedLevels") ??
            TERRAIN_CONFIG.dem.generatedLevels,
    );
    if (
        !Number.isInteger(demGeneratedLevels) ||
        demGeneratedLevels < 0 ||
        demGeneratedLevels > 8
    )
        throw new RangeError(
            "demGeneratedLevels must be an integer from 0 to 8.",
        );
    // `debug` draws pages locally; any other name loads src/local/<name>.imagery.ts, kept out of the repository.
    const imagery = parameters.get("imagery") ?? "debug";
    // Uniform ambient is an explicit diagnostic comparison; normal terrain lighting stays the default.
    const lighting = parameters.get("lighting") ?? "terrain";
    if (lighting !== "ambient" && lighting !== "terrain")
        throw new RangeError("lighting must be ambient or terrain.");
    // Imagery drapes shaded grids only; wireframe grids keep their level colours.
    const imageryEnabled = solidRendering && imagery !== "none";
    const verticalScaleInput = requiredElement(
        "vertical-scale",
        HTMLInputElement,
    );
    const verticalScaleValue = requiredElement(
        "vertical-scale-value",
        HTMLOutputElement,
    );
    const initialScale = Number(
        parameters.get("scale") ?? parameters.get("exaggeration") ?? "1",
    );
    if (!Number.isFinite(initialScale) || initialScale < 0)
        throw new RangeError("The scale parameter must be non-negative.");
    // Everything in the scene reads this one scale; the slider only changes it.
    const verticalScale = new VerticalScale(initialScale);
    const spatialOptions = { geodeticSystem };
    const dem = elevationEnabled ? createMapzenTerrariumSource() : undefined;
    const childHeightRanges = new ChildHeightRanges();
    // Terrain subtrees with their own levels, "lod/x/y/maxLOD" separated by commas, for example "13/4252/2920/13".
    const subtrees = (parameters.get("subtrees") ?? "")
        .split(",")
        .filter(Boolean)
        .map((entry) => {
            const [lod, x, y, maxLOD] = entry.split("/").map(Number);
            if (![lod, x, y, maxLOD].every(Number.isInteger))
                throw new RangeError(
                    "Each subtree must be written lod/x/y/maxLOD.",
                );
            return { root: { lod: lod!, x: x!, y: y! }, maxLOD: maxLOD! };
        });
    // Tiles start at 0/0. Each DEM reports the tile range and prepares the ranges of its four children.
    const preparedHeights = dem
        ? {
              ranges: childHeightRanges,
              verticalScale: () => verticalScale.value,
          }
        : undefined;
    const source = createGeodesicGridSource(preparedHeights, { subtrees });
    if (dem)
        requiredElement("attribution", HTMLElement).textContent =
            dem.source.attribution ?? "";

    // The camera orbits a place of places.json, or the point `lat` and `lon` give, at `height` metres.
    const target = cameraTarget(parameters);
    const pitchRadians =
        (Number(parameters.get("pitch") ?? "60") * Math.PI) / 180;
    const orbitRadius = Number(parameters.get("radius") ?? "25000");
    const camera = createGeospatialCamera(scene, {
        name: "geographic-camera",
        geodeticSystem,
        target: {
            latitudeDegrees: target.latitude,
            longitudeDegrees: target.longitude,
            heightMeters: dem ? target.height * verticalScale.value : 0,
        },
        radius: orbitRadius,
        pitchRadians,
        radiusMin: 500,
    });

    if (solidRendering) {
        // Sun from the north-west, 45 degrees above the horizon of the target.
        const { east, north, up } =
            geodeticSystem.createLocalTangentPlaneDegrees(
                target.latitude,
                target.longitude,
            ).basis;
        const toSun = new Vector3(
            up.x + (north.x - east.x) * Math.SQRT1_2,
            up.y + (north.y - east.y) * Math.SQRT1_2,
            up.z + (north.z - east.z) * Math.SQRT1_2,
        ).normalize();
        const sun = new DirectionalLight("sun", toSun.negate(), scene);
        sun.intensity = lighting === "ambient" ? 0 : 1.1;
        const sky = new HemisphericLight(
            "sky",
            new Vector3(up.x, up.y, up.z),
            scene,
        );
        sky.intensity = lighting === "ambient" ? 1 : 0.25;
        sky.groundColor =
            lighting === "ambient"
                ? Color3.White()
                : new Color3(0.1, 0.1, 0.12);
    }

    // Imagery is a second implicit quadtree, refined on texel size instead of geometric error.
    const imagerySource = !imageryEnabled
        ? undefined
        : imagery === "debug"
          ? {
                load: (address: ITileAddress) =>
                    Promise.resolve(
                        debugImageryTile(
                            address,
                            TERRAIN_CONFIG.imagery.tileCells,
                        ),
                    ),
                maxLOD: TERRAIN_CONFIG.imagery.maxLOD,
                // Drawn pixel by pixel.
                registration: "area" as const,
                attribution: "",
            }
          : await loadLocalImagery(imagery);
    // A physical DEM tile covers n by n imagery tiles. Generated DEM levels do not advance this limit.
    const imagerySubdivision = Number(
        parameters.get("imagerySubdivision") ??
            TERRAIN_CONFIG.imagery.demSubdivision,
    );
    if (![2, 4, 8].includes(imagerySubdivision))
        throw new RangeError("imagerySubdivision must be 2, 4 or 8.");
    const imagerySourceMaxLOD =
        imagerySource?.maxLOD ?? TERRAIN_CONFIG.imagery.maxLOD;
    const imageryMaxLOD = dem
        ? Math.min(
              imagerySourceMaxLOD,
              dem.source.metrics.maxLOD + Math.log2(imagerySubdivision),
          )
        : imagerySourceMaxLOD;
    const imageryMetrics = new WebMercatorTileMetrics({
        minLOD: TERRAIN_CONFIG.imagery.minLOD,
        maxLOD: imageryMaxLOD,
        tileSize: TERRAIN_CONFIG.imagery.tileCells,
    });
    const imageryPages = imagerySource
        ? new BabylonRasterPages(scene, {
              load: imagerySource.load,
              maxLOD: imageryMetrics.maxLOD,
              registration: imagerySource.registration,
              wrapX: true,
              tileSize: imageryMetrics.tileSize,
          })
        : undefined;
    if (imagerySource?.attribution) {
        const attribution = requiredElement("attribution", HTMLElement);
        attribution.textContent = [
            imagerySource.attribution,
            attribution.textContent,
        ]
            .filter(Boolean)
            .join(" | ");
    }
    // Deepest drape below each terrain tile: up to 4^kmax imagery pages per tile.
    const maxDrapeDepth = Number(
        parameters.get("kmax") ?? TERRAIN_CONFIG.imagery.maxDrapeDepth,
    );

    function createImageryRuntime(
        pages: BabylonRasterPages,
    ): TileRuntime<
        IEcefCameraFrame,
        IEcefSpatialState,
        IBabylonRasterPage,
        never
    > {
        // Imagery tiles share the height ranges prepared by the terrain DEM, for culling and distances.
        const imagerySource = createGeodesicGridSource(preparedHeights, {
            metrics: imageryMetrics,
            id: "imagery",
        });
        const imageryAdapter = new BabylonRasterTileAdapter<IEcefSpatialState>(
            pages,
            {
                addressOf: (context) => metadataTileAddress(context.tile),
            },
        );
        return new TileRuntime({
            id: "implicit-grid-mapzen-imagery",
            selectionStrategy: "base",
            uri: "memory://imagery/tileset.json",
            adapter: {
                tilesets: {
                    load: async () => ({ tileset: imagerySource.tileset }),
                },
                subtrees: new DenseImplicitSubtreeLoader(),
                implicitTiles: imagerySource.resolver,
                spatial: new EcefSpatialMetric(spatialOptions),
                activation: imageryAdapter,
                presentation: imageryAdapter,
            },
            // The geometric error of an imagery tile is one texel: at most two texels per screen pixel.
            maxScreenSpaceError: TERRAIN_CONFIG.imagery.screenSpaceError,
            refinementHysteresisRatio: hysteresis,
            coarseningDelayMilliseconds: coarsenDelay,
            maxConcurrentLoads: TERRAIN_CONFIG.selection.maxConcurrentLoads,
            // Each imagery page holds a texture array layer: these pages bound the GPU memory.
            cache: {
                maxContentEntries: TERRAIN_CONFIG.imagery.contentCacheEntries,
            },
        });
    }

    const elevation: IGridElevationOptions | undefined = dem
        ? {
              pyramid: new DemPyramid({
                  registration: dem.source.registration,
                  load: webDemTileLoader(dem, createDemDecoder()),
                  maxLOD: dem.source.metrics.maxLOD,
                  // Room for the DEM tiles retained by the displayed cut, and for the tiles loading around it.
                  cacheEntries: demCacheEntries,
                  abortDelayMilliseconds: demAbortDelay,
                  // Generated height resolution is independent of the geometric quadtree and imagery.
                  ...(demGeneratedLevels > 0
                      ? {
                            generation: {
                                maxLOD:
                                    dem.source.metrics.maxLOD +
                                    demGeneratedLevels,
                                interpolation: demInterpolation,
                            },
                        }
                      : {}),
                  // The grid covers every longitude.
                  wrapX: true,
                  childHeightRanges,
              }),
              verticalScale,
          }
        : undefined;
    // The engine turning terrain tiles into pixels; the runtimes, the DEM and the imagery pages stay shared.
    const engineName = parameters.get("engine") ?? "mesh";
    if (engineName !== "mesh" && engineName !== "gpu")
        throw new RangeError("The engine parameter must be mesh or gpu.");
    const normalMode = parameters.get("normals") ?? "mapzen";
    if (normalMode !== "mapzen" && normalMode !== "dem")
        throw new RangeError("normals must be mapzen or dem.");
    const normalSource =
        dem &&
        solidRendering &&
        engineName === "gpu" &&
        lighting === "terrain" &&
        normalMode === "mapzen"
            ? createMapzenNormalsSource()
            : undefined;
    const normalMaxLOD = Number(parameters.get("normalMaxLOD") ?? 15);
    if (
        !Number.isInteger(normalMaxLOD) ||
        normalMaxLOD < 0 ||
        normalMaxLOD > 15
    )
        throw new RangeError("normalMaxLOD must be an integer from 0 to 15.");
    const normalDecoder = new PngDataDecoder();
    const normalPages = normalSource
        ? new BabylonRasterPages(scene, {
              load: async (address, signal) => {
                  const result = await normalSource.fetchTile(address, signal);
                  return result.status === "absent"
                      ? undefined
                      : decodeMapzenNormalPixels(
                            await normalDecoder.decode(result.bytes, signal),
                        );
              },
              maxLOD: Math.min(normalMaxLOD, normalSource.metrics.maxLOD),
              registration: normalSource.registration,
              tileSize: normalSource.metrics.tileSize,
              wrapX: true,
              cacheEntries: 256,
              initialLayers: 16,
          })
        : undefined;
    const terrainInputs: ITerrainEngineInputs = {
        scene,
        labelLayer: tileLabels,
        wireframe: !solidRendering,
        lighting,
        geometrySelection: "runtime",
        junctions,
        edgeHeights,
        ...(elevation ? { elevation } : {}),
        ...(imageryPages ? { imageryPages } : {}),
        ...(normalPages ? { normalPages } : {}),
    };
    const terrain: ITerrainEngine =
        engineName === "gpu"
            ? new GpuTerrainEngine(terrainInputs, { cells: gridCells })
            : new MeshTerrainEngine(terrainInputs, {
                  cells: gridCells,
                  maxDrapeDepth,
                  junctionBudgetMilliseconds: junctionBudget,
              });
    verticalScaleInput.value = String(verticalScale.value);
    verticalScaleValue.value = `x${verticalScale.value}`;
    verticalScaleInput.disabled = !elevation;
    verticalScaleInput.addEventListener("input", () => {
        verticalScale.set(Number(verticalScaleInput.value));
        verticalScaleValue.value = `x${verticalScale.value}`;
    });

    const adapter: IRuntimeAdapter<
        IEcefCameraFrame,
        IEcefSpatialState,
        unknown,
        never
    > = {
        tilesets: { load: async () => ({ tileset: source.tileset }) },
        subtrees: new DenseImplicitSubtreeLoader(),
        implicitTiles: source.resolver,
        spatial: new EcefSpatialMetric(spatialOptions),
        activation: terrain,
        presentation: terrain,
    };
    const runtime = new TileRuntime({
        id: "implicit-grid-mapzen",
        selectionStrategy: "base",
        uri: "memory://geodesic-grid/tileset.json",
        adapter,
        maxScreenSpaceError: Number(
            parameters.get("sse") ?? TERRAIN_CONFIG.selection.screenSpaceError,
        ),
        refinementHysteresisRatio: hysteresis,
        coarseningDelayMilliseconds: coarsenDelay,
        maxConcurrentLoads: TERRAIN_CONFIG.selection.maxConcurrentLoads,
        instrumentation: { enabled: monitoringEnabled },
        // Neighbouring tiles stay within one level, so that every edge junction connects.
        quadtreeBalance:
            parameters.get("balance") === "0" ? false : { wrapX: true },
        // Terrain tiles of the view and around it; their DEM tiles are cached by the DEM pyramid.
        cache: {
            maxContentEntries: TERRAIN_CONFIG.selection.contentCacheEntries,
        },
    });

    const imageryRuntime = imageryPages
        ? createImageryRuntime(imageryPages)
        : undefined;

    const monitor = new BabylonRuntimeMonitor(
        engine,
        scene,
        runtime.instrumentation,
        { enabled: monitoringEnabled, resources: terrain },
    );
    if (monitor.enabled)
        monitor.subscribe((snapshot) => renderMonitorPanel(panel, snapshot));
    else clearMonitorPanel(panel);
    const unsubscribeEvents = runtime.events.subscribe((event) => {
        if (event.type !== "error") return;
        status.textContent = `Pipeline error: ${event.phase}`;
        console.error("3D Tiles pipeline error", event.error);
    });

    const driver = new BabylonRuntimeDriver(runtime, scene, {
        camera,
        // Mercator selects the real view, and loads its periphery without drawing it.
        frustumMargin: Number(
            parameters.get("frustumMargin") ??
                TERRAIN_CONFIG.selection.frustumMargin,
        ),
        manual: true,
        onError: (error) => {
            status.textContent = "Runtime frame failed";
            console.error("3D Tiles pipeline frame failed", error);
        },
    });
    const imageryDriver = imageryRuntime
        ? new BabylonRuntimeDriver(imageryRuntime, scene, {
              camera,
              manual: true,
              onError: (error) =>
                  console.error("Imagery runtime frame failed", error),
          })
        : undefined;
    status.textContent = "Loading the implicit quadtree...";
    await Promise.all([driver.start(), imageryDriver?.start()]);
    monitor.setStartupMilliseconds(performance.now() - startupStartedAt);
    const coverage = `Global WebMercator coverage, ${source.tileset.root.children?.length ?? 0} roots, LOD ${TILE_METRICS.minLOD}..${TILE_METRICS.maxLOD}`;
    status.textContent = `${coverage} | ${renderer === "webgpu" ? "WebGPU, WGSL" : "WebGL, GLSL"}`;

    // Objects of the example, for probes run from the browser console.
    (window as unknown as Record<string, unknown>).__SPACEXR_EXAMPLE__ = {
        renderer,
        camera,
        runtime,
        imageryRuntime,
        terrain,
        // Parts of the mesh engine, for the probes written against it.
        ...(terrain instanceof MeshTerrainEngine
            ? { pipeline: terrain.grids, drape: terrain.drape }
            : {}),
        imageryPages,
        normalPages,
        verticalScale,
        scene,
    };

    // The selection and its junctions are published before drawing this camera. Network work stays asynchronous.
    scene.onBeforeRenderObservable.add(() => terrain.beforeRender());
    // Each frame waits for the selection of its camera, then draws inside a frame of the engine, which submits it:
    // WebGPU only presents the canvas texture of a frame whose commands were submitted.
    const frame = async (): Promise<void> => {
        if (scene.isDisposed) return;
        camera.update();
        try {
            await Promise.all([
                driver.updateBeforeRender(),
                imageryDriver?.updateBeforeRender(),
            ]);
            if (scene.isDisposed) return;
            engine.beginFrame();
            scene.render(false);
            engine.endFrame();
            monitor.update();
            terrain.afterRender();
        } catch (error: unknown) {
            console.error("Mercator frame failed", error);
        }
        requestAnimationFrame(() => void frame());
    };
    requestAnimationFrame(() => void frame());

    const resize = (): void => engine.resize();
    window.addEventListener("resize", resize);
    window.addEventListener(
        "beforeunload",
        () => {
            window.removeEventListener("resize", resize);
            driver.dispose();
            imageryDriver?.dispose();
            unsubscribeEvents();
            void runtime.dispose();
            void imageryRuntime?.dispose();
            // The engine releases its imagery bindings before the pages they read.
            terrain.dispose();
            imageryPages?.dispose();
            normalPages?.dispose();
            monitor.dispose();
            scene.dispose();
            engine.dispose();
        },
        { once: true },
    );
}

void run().catch((error: unknown) => {
    const status = document.getElementById("runtime-status");
    if (status)
        status.textContent =
            error instanceof Error
                ? error.message
                : "The pipeline example could not start.";
    console.error("Babylon implicit grid Mapzen example failed", error);
});
