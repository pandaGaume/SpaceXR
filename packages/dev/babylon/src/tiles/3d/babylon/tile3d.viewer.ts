import * as BABYLON from "@babylonjs/core";

import { Nullable } from "core/types";
import { ICameraViewState, IDisplay } from "core/tiles";
import { IUriResolver, Tile3dStreamEngine } from "../engine";
import { CanvasDisplay } from "core/map";
import { Tile3dScene } from "./tile3d.scene";
import { Tile3dContentLoader } from "./tile3d.loader";
import { ITileset } from "../interfaces";
import { EventState } from "core/events";
import { SetupCameraStateSync } from "./tile3d.camera.sync";
import { GoogleTile3dErrorFn } from "../vendors";

export interface IViewerOptions {
    uri: string;
    resolver?: IUriResolver;
    names?: Record<string, string>;
}

export class Map3DViewer {
    public static DefaultCanvasId = "";
    private static CanvasKeyword = "canvas";

    readonly _options: IViewerOptions;
    readonly _target: Nullable<HTMLElement> = null;
    readonly _canvas: Nullable<HTMLCanvasElement> = null;
    readonly _engine: Nullable<BABYLON.Engine> = null;
    readonly _scene: Nullable<BABYLON.Scene> = null;
    _camera: Nullable<BABYLON.Camera> = null;

    _display: Nullable<IDisplay> = null;
    _streamEngine: Nullable<Tile3dStreamEngine> = null;
    _map: Nullable<Tile3dScene> = null;

    _cameraSync: Nullable<BABYLON.IDisposable> = null;
    _cameraNav: Nullable<BABYLON.IDisposable> = null;

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
        if (this._canvas) {
            this._engine = this._createEngine(this._canvas);
            if (this._engine) {
                this._scene = this._createScene(this._engine);
                if (this._scene) {
                    this._display = new CanvasDisplay(this._canvas);
                    this._streamEngine = new Tile3dStreamEngine(options.uri, this._display, new Tile3dContentLoader(this._scene, options.resolver));
                    if (options.resolver) {
                        this._streamEngine.contentOptions.uriResolver = options.resolver;
                    }
                    this._streamEngine.contentOptions.maxScreenSpaceErrorFn = GoogleTile3dErrorFn;
                    this._map = new Tile3dScene(options.names?.map ?? "map", this._scene, {});
                    this._streamEngine.linkTo(this._map);
                    this._streamEngine.rootReadyObservable.addOnce(this._onRootReady.bind(this));
                    this._streamEngine.setContext(); // start the root loading.

                    /*this._scene.useRightHandedSystem = true;
                    BABYLON.SceneLoader.OnPluginActivatedObservable.add((p) => {
                        if ((p as any).name === "gltf") {
                            (p as any).useRightHandedSystem = true; // glTF loader matches scene
                        }
                    });*/

                    /*this._streamEngine.retreiveMetasAsync().then((m) => {
                        console.log(`Meta = ${JSON.stringify(m)}`);
                    });*/
                }
            }
        }
    }

    public getScene(): Nullable<BABYLON.Scene> {
        return this._scene;
    }

    protected _onRootReady(eventData: ITileset, eventState: EventState): void {
        if (this._engine && this._scene) {
            const engine = this._engine;
            const scene = this._scene;
            this._camera = this._createCamera(this._getCameraName(), eventData, scene, this._options);
            if (this._camera) {
                this._cameraSync = SetupCameraStateSync(this._camera, scene, this.onCameraStateUpdate.bind(this));
                //this._cameraNav = SetupAdaptiveUniversalCamera(this._camera, scene);
                // This attaches the camera to the canvas
                this._camera.attachControl(this._canvas, true);
            }

            engine.runRenderLoop(() => {
                scene.render();
            });

            window.addEventListener("resize", () => {
                engine.resize();
            });
        }
    }

    public get canvas(): Nullable<HTMLCanvasElement> {
        return this._canvas;
    }

    public get camera(): Nullable<BABYLON.Camera> {
        return this._camera;
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
        const engine = new BABYLON.Engine(canvas, true);
        return engine;
    }

    protected _createScene(engine: BABYLON.Engine): BABYLON.Scene | null {
        const scene = new BABYLON.Scene(engine);
        return scene;
    }

    protected _createCamera(name: string, root: ITileset, scene: BABYLON.Scene, options: IViewerOptions): Nullable<BABYLON.Camera> {
        if (root.root.boundingVolume) {
            if (this._scene && this._display && root.root.boundingVolume.box) {
                return this._setupArcRotateCamera(root.root.boundingVolume.box, this._scene);
                //return this._setupUniversalCameraForTilesetRoot(root.root.boundingVolume.box, this._scene, this._display.resolution.width, this._display.resolution.height);
            }
        }
        return null;
    }

    protected onCameraStateUpdate(state: ICameraViewState): void {
        this._streamEngine?.setContext(state);
    }

    protected _getCameraName(): string {
        return this._options.names?.camera ?? "camera";
    }

    protected _setupArcRotateCamera(box: number[], scene: BABYLON.Scene, margin = 1.5): BABYLON.Camera {
        const C = new BABYLON.Vector3(box[0], box[1], box[2]);
        const U = new BABYLON.Vector3(box[3], box[4], box[5]);
        const V = new BABYLON.Vector3(box[6], box[7], box[8]);
        const W = new BABYLON.Vector3(box[9], box[10], box[11]);

        const u = U.length();
        const v = V.length();
        const w = W.length();
        const size = Math.hypot(u, v, w);

        const camera = new BABYLON.ArcRotateCamera("Camera", Math.PI, Math.PI / 2, size * margin, C, scene);

        // Set camera near and far planes based on bounding size
        camera.minZ = 0;
        camera.maxZ = size * margin * 2;

        // Adaptive zoom by percentage of radius
        camera.wheelDeltaPercentage = 0.00005;
        camera.wheelPrecision = 0; // ignore l'ancien mode

        return camera;
    }

    protected _setupUniversalCameraForTilesetRoot(
        box: number[], // length 12
        scene: BABYLON.Scene,
        canvasWidth: number,
        canvasHeight: number,
        margin = 1.5,
        camera?: BABYLON.UniversalCamera
    ): BABYLON.UniversalCamera {
        const C = new BABYLON.Vector3(box[0], box[1], box[2]);
        const U = new BABYLON.Vector3(box[3], box[4], box[5]);
        const V = new BABYLON.Vector3(box[6], box[7], box[8]);
        const W = new BABYLON.Vector3(box[9], box[10], box[11]);

        const u = U.length();
        const v = V.length();
        const w = W.length();

        const aspect = canvasWidth / canvasHeight;
        const fovY = BABYLON.Tools.ToRadians(60); // default FOV
        const hFov = 2 * Math.atan(Math.tan(fovY / 2) * aspect);

        // Distances to fit vertical/horizontal extents
        const dV = v / Math.tan(fovY / 2);
        const dH = u / Math.tan(hFov / 2);
        let d = margin * Math.max(dV, dH);

        // Ensure we are beyond the W extent
        d = Math.max(d, w * 1.05);

        // Define orientation vectors
        const forward = new BABYLON.Vector3(0, 0, -1); // look towards -Z
        const up = BABYLON.Vector3.Up(); // world up

        // Camera position = center - forward * distance
        const position = C.subtract(forward.scale(d));
        if (camera) {
            camera.position = position;
        } else {
            // Create the UniversalCamera
            camera = camera ?? new BABYLON.UniversalCamera(this._getCameraName(), position, scene);
        }

        camera.setTarget(C);
        camera.upVector = up.clone();

        // Adjust near/far planes
        const R = Math.hypot(u, v, w); // bounding sphere radius
        camera.minZ = 10;
        camera.maxZ = d + R * 1.1;

        return camera;
    }
}
