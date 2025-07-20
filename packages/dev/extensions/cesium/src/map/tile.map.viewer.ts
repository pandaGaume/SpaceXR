import * as BABYLON from "@babylonjs/core";
import { TileMapBase } from "core/tiles";
import { Nullable } from "core/types";
import { ITileset } from "../tiles";
import { Ellipsoid } from "core/geodesy";
import { GeodeticCamera } from "../../../../babylon/src/camera/camera.Geodetic";

export interface IViewerOptions {
    ellipsoid: Ellipsoid;
}

export class ViewerBase extends TileMapBase<ITileset> {
    public static DefaultCanvasId = "";
    private static CanvasKeyword = "canvas";

    _options: IViewerOptions;
    _target: Nullable<HTMLElement> = null;
    _canvas: Nullable<HTMLCanvasElement> = null;
    _engine: Nullable<BABYLON.Engine> = null;
    _scene: Nullable<BABYLON.Scene> = null;
    _camera: Nullable<GeodeticCamera> = null;

    public constructor(targetId: string, options: IViewerOptions) {
        super();
        this._options = options;

        const target = document.getElementById(targetId);
        if (!target) {
            throw new Error(`Element "${targetId}" not found.`);
        }
        this._target = target;

        // existing canvas or create a new one.
        let canvas = this._target.querySelector(ViewerBase.CanvasKeyword) as Nullable<HTMLCanvasElement>;
        if (!canvas) {
            canvas = this._createCanvas(ViewerBase.DefaultCanvasId) as Nullable<HTMLCanvasElement>;
            if (canvas) {
                this._target.appendChild(canvas);
            }
        }

        this._canvas = canvas;
        if (this._canvas) {
            this._engine = this._createEngine(this._canvas);
            if (this._engine) {
                this._scene = this._createScene(this._engine);
                if (this._scene) {
                    this._camera = this._createCamera("", this._scene, this._options.ellipsoid ?? Ellipsoid.WGS84);
                }
            }
        }
    }

    public get canvas(): Nullable<HTMLCanvasElement> {
        return this._canvas;
    }

    public get camera(): Nullable<GeodeticCamera> {
        return this._camera;
    }

    protected _createCamera(name: string, scene: BABYLON.Scene, ellipsoid: Ellipsoid): GeodeticCamera {
        const cam = new GeodeticCamera(name, scene, ellipsoid ?? Ellipsoid.WGS84);
        return cam;
    }

    protected _createCanvas(id: string): Nullable<HTMLElement> {
        const canvas = document.createElement(ViewerBase.CanvasKeyword);
        if (canvas) {
            canvas.id = "id";
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
}
