import * as BABYLON from "@babylonjs/core";
import { Map3D, Map3DOptions } from "./map";
import { Nullable } from "core/types";

export class ViewerOptions extends Map3DOptions {}

export class Map3DViewer {
    public static DefaultCanvasId = "";
    private static CanvasKeyword = "canvas";

    _target: Nullable<HTMLElement> = null;
    _canvas: Nullable<HTMLCanvasElement> = null;
    _engine: Nullable<BABYLON.Engine> = null;
    _scene: Nullable<BABYLON.Scene> = null;
    _camera: Nullable<BABYLON.Camera> = null;

    _map: Nullable<Map3D> = null;

    public constructor(targetId: string, options: ViewerOptions) {
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
                    this._camera = this._createCamera("", this._scene, options);
                }
            }
        }
        this._map = new Map3D(new BABYLON.TransformNode("root", this._scene));
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

    protected _createCamera(name: string, scene: BABYLON.Scene, options: ViewerOptions): Nullable<BABYLON.Camera> {
        return null;
    }
}
