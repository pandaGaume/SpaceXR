import * as BABYLON from "@babylonjs/core";

import { Nullable } from "core/types";
import { IUriResolver, MaxScreenSpaceErrorFn, Tile3dStreamBinding, Tile3dStreamSource } from "core/tiles/3d/engine";
import { Tile3dScene } from "./tile3d.scene";
import { Tile3dContentLoader } from "./tile3d.loader";
import { EventState } from "core/events";
import { Geo3, IGeo3 } from "core/geography";
import { Ellipsoid, GeodeticSystem } from "core/geodesy";
import { ITileset } from "core/tiles/3d/interfaces";
import { CameraStreamPump, GeodeticCamera, IsGeodeticCamera } from "../../camera";

export interface IViewerOptions {
    uri: string;
    resolver?: IUriResolver;
    names?: Record<string, string>;
    ellipsoid?: Ellipsoid;
    /** Initial camera position (geodetic). Defaults to Map3DViewer.DefaultInitialPosition. */
    initialPosition?: IGeo3;
    /** Max screen-space error in pixels (constant). Default 16. */
    maxScreenSpaceError?: number;
    /** Per-depth max-SSE override (e.g. GoogleTile3dErrorFn for Google Photorealistic tiles). */
    maxScreenSpaceErrorFn?: MaxScreenSpaceErrorFn;
    /**
     * Right-handed scene (default true). Required for correct glTF winding
     * with the raw-ECEF placement performed by Tile3dScene.
     */
    useRightHandedSystem?: boolean;
}

/**
 * Camera-driven 3D Tiles viewer (Cesium-like navigation).
 *
 * Pipeline: GeodeticCamera -> CameraStreamPump -> Tile3dStreamSource (core
 * LOD engine: SSE refine/coarsen, hole-free REPLACE, external tilesets) ->
 * Tile3dStreamBinding -> Tile3dContentLoader (glTF/glb) + Tile3dScene
 * (ECEF placement).
 *
 * The scene embeds RAW ECEF (Babylon world coordinates are ECEF meters), the
 * engine is created with `useHighPrecisionMatrix` so planet-scale transforms
 * keep sub-meter precision, and near/far planes are managed by
 * BABYLON.GeospatialClippingBehavior.
 */
export class Map3DViewer {
    public static DefaultCanvasId = "";
    private static CanvasKeyword = "canvas";
    public static readonly DefaultInitialPosition = new Geo3(37.7749, -122.4194, 10_000_000);

    readonly _options: IViewerOptions;
    readonly _target: Nullable<HTMLElement> = null;
    readonly _canvas: Nullable<HTMLCanvasElement> = null;
    readonly _engine: Nullable<BABYLON.Engine> = null;
    readonly _scene: Nullable<BABYLON.Scene> = null;
    _camera: Nullable<BABYLON.Camera> = null;

    _loader: Nullable<Tile3dContentLoader> = null;
    _source: Nullable<Tile3dStreamSource> = null;
    _binding: Nullable<Tile3dStreamBinding> = null;
    _map: Nullable<Tile3dScene> = null;
    _pump: Nullable<CameraStreamPump> = null;
    private _onResize: Nullable<() => void> = null;

    public constructor(targetId: string, options: IViewerOptions) {
        this._options = options;
        const target = document.getElementById(targetId);
        if (!target) {
            throw new Error(`Element "${targetId}" not found.`);
        }
        this._target = target;

        // existing canvas or create a new one.
        let canvas = target.querySelector(Map3DViewer.CanvasKeyword) as Nullable<HTMLCanvasElement>;
        if (!canvas) {
            canvas = this._createCanvas(Map3DViewer.DefaultCanvasId) as Nullable<HTMLCanvasElement>;
            if (canvas) {
                target.appendChild(canvas);
            }
        }
        this._canvas = canvas;
        if (!this._canvas) return;

        this._engine = this._createEngine(this._canvas);
        if (!this._engine) return;
        this._scene = this._createScene(this._engine);
        if (!this._scene) return;

        const engine = this._engine;
        const scene = this._scene;

        // Streaming pipeline. The loader handles renderable content only:
        // external .json tilesets are fetched and grafted by the stream source
        // (listing .json here as well would download each one twice).
        this._loader = new Tile3dContentLoader(scene, options.resolver, [".gltf", ".glb"]);
        this._source = new Tile3dStreamSource({
            id: options.names?.tileset ?? "tileset",
            uri: options.uri,
            tilesetLoader: this._loader,
            maxScreenSpaceError: options.maxScreenSpaceError,
            maxScreenSpaceErrorFn: options.maxScreenSpaceErrorFn,
            ellipsoid: options.ellipsoid,
        });
        this._binding = new Tile3dStreamBinding(this._source, this._loader);
        this._map = new Tile3dScene(options.names?.map ?? "map", scene);
        this._binding.linkTo(this._map);
        this._source.rootReadyObservable.addOnce(this._onRootReady.bind(this));

        // Camera + per-frame LOD drive. The first pump tick triggers the root
        // tileset load through the engine's traversal.
        this._camera = this._createCamera(this._getCameraName(), scene, options);
        if (this._camera) {
            this._camera.attachControl(this._canvas, true);
            // _createCamera is an extension point: only a geodetic camera can
            // be positioned this way, others place themselves.
            if (IsGeodeticCamera(this._camera)) {
                const position = options.initialPosition ?? Map3DViewer.DefaultInitialPosition;
                this._camera.setGeodeticPosition(position.lat, position.lon, position.alt ?? 10_000_000);
            }
            this._pump = new CameraStreamPump(scene, this._camera, this._source);
        }

        engine.runRenderLoop(() => {
            scene.render();
        });
        this._onResize = () => engine.resize();
        window.addEventListener("resize", this._onResize);
    }

    public getScene(): Nullable<BABYLON.Scene> {
        return this._scene;
    }

    public get canvas(): Nullable<HTMLCanvasElement> {
        return this._canvas;
    }

    public get camera(): Nullable<BABYLON.Camera> {
        return this._camera;
    }

    public get source(): Nullable<Tile3dStreamSource> {
        return this._source;
    }

    public dispose(): void {
        if (this._onResize) {
            window.removeEventListener("resize", this._onResize);
            this._onResize = null;
        }
        this._engine?.stopRenderLoop();
        // Pump first (stops new traversals), then the binding (stops feeding the
        // loader), then the loader, the source and the scene graph.
        this._pump?.dispose();
        this._binding?.dispose();
        this._loader?.dispose();
        this._source?.dispose();
        this._map?.dispose();
        this._scene?.dispose();
        this._engine?.dispose();
    }

    protected _onRootReady(_eventData: ITileset, _eventState: EventState): void {
        // Hook for subclasses (fly to the tileset, UI feedback, ...).
    }

    protected _createCanvas(id: string): Nullable<HTMLElement> {
        const canvas = document.createElement(Map3DViewer.CanvasKeyword);
        if (canvas) {
            canvas.id = id;
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            return canvas;
        }
        return null;
    }

    protected _createEngine(canvas: HTMLCanvasElement): BABYLON.Engine | null {
        // High-precision matrices: ECEF magnitudes (~1e7 m) need float64 world
        // matrices to avoid sub-meter jitter near the surface.
        return new BABYLON.Engine(canvas, true, { useHighPrecisionMatrix: true });
    }

    protected _createScene(engine: BABYLON.Engine): BABYLON.Scene | null {
        const scene = new BABYLON.Scene(engine);
        scene.useRightHandedSystem = this._options.useRightHandedSystem ?? true;
        return scene;
    }

    protected _createCamera(name: string, scene: BABYLON.Scene, options: IViewerOptions): Nullable<BABYLON.Camera> {
        const ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
        const camera = new GeodeticCamera(name, scene, new GeodeticSystem(ellipsoid));
        // Near/far planes follow the altitude automatically.
        camera.addBehavior(new BABYLON.GeospatialClippingBehavior());
        return camera;
    }

    protected _getCameraName(): string {
        return this._options.names?.camera ?? "camera";
    }
}
