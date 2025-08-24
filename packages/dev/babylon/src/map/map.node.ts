import * as BABYLON from "@babylonjs/core";
import { ICameraViewState, IDisplay, IHasTileMapLayerContainer, ITileMapLayerContainer, ITileNavigationApi } from "core/tiles";
import { IDisposable, Nullable } from "core/types";
import { EventState } from "core/events";
import { IGeo2 } from "core/geography";
import { VirtualDisplay } from "../display";
import { IInputSource, InputsNavigationController } from "core/map";
import { IMap3D, Map3DContentType } from "./map.interfaces";
import { Map3D } from "./map";
import { SetupCameraStateSync, SyncActiveCameraState } from "../tiles/3d/babylon/tile3d.camera.sync";

/// <sumary>
/// Act as proxy for Elevation Map, and bind the rendering event of the scene
/// </sumary>
export class MapNode extends BABYLON.TransformNode implements ITileNavigationApi, IHasTileMapLayerContainer<Map3DContentType> {
    private _map: IMap3D;
    private _beforeRenderObserver: Nullable<BABYLON.Observer<BABYLON.Scene>>;
    private _pointerController: Nullable<InputsNavigationController> = null;
    private _ownPointerController = false;
    private _cameraMonitoring?: IDisposable;
    private _activCameraChangeMonitor: IDisposable;

    public constructor(name: string, scene?: BABYLON.Scene) {
        super(name, scene);
        this._map = this._createMap();
        scene = scene ?? this.getScene();
        this._beforeRenderObserver = scene.onBeforeRenderObservable.add(this._onBeforeRender.bind(this));
        let current: BABYLON.Camera | null = scene.activeCamera ?? null;
        let listener = this._onCameraState.bind(this);
        if (current) {
            this._cameraMonitoring = SetupCameraStateSync(scene, current, listener);
        }
        this._activCameraChangeMonitor = SyncActiveCameraState(scene, listener);
    }

    public get layers(): ITileMapLayerContainer<Map3DContentType> {
        return this._map.layers;
    }

    public get navigationState() {
        return this._map.navigationState;
    }

    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): ITileNavigationApi {
        this._map.setViewMap(center, zoom, rotation, validate);
        return this;
    }

    public zoomMap(delta: number, validate?: boolean): ITileNavigationApi {
        this._map.zoomMap(delta, validate);
        return this;
    }

    public zoomInMap(delta: number, validate?: boolean): ITileNavigationApi {
        this._map.zoomInMap(delta, validate);
        return this;
    }

    public zoomOutMap(delta: number, validate?: boolean): ITileNavigationApi {
        this._map.zoomOutMap(delta, validate);
        return this;
    }

    public translateUnitsMap(tx: number, ty: number, validate?: boolean): ITileNavigationApi {
        this._map.translateUnitsMap(tx, ty, validate);
        return this;
    }

    public translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): ITileNavigationApi {
        this._map.translateMap(dlat, dlon, validate);
        return this;
    }

    public rotateMap(r: number, validate?: boolean): ITileNavigationApi {
        this._map.rotateMap(r, validate);
        return this;
    }

    public setCameraState(cam: ICameraViewState, validate?: boolean): ITileNavigationApi {
        this._map.setCameraState(cam, validate);
        return this;
    }

    public get map(): IMap3D {
        return this._map;
    }

    public withDisplay(display: IDisplay): MapNode {
        this._map.display = display;
        if (display instanceof VirtualDisplay) {
            this.parent = display.context3D;
            return this._withPointerControl(display.pointerSource);
        } else if (display instanceof BABYLON.Node) {
            this.parent = display;
        }
        return this;
    }

    public withElevationExageration(e: number) {
        this.map.elevationOptions.exageration = e;
    }

    protected _withPointerControl(controller: InputsNavigationController | IInputSource): MapNode {
        if (this._pointerController === controller) return this;

        if (this._pointerController && this._ownPointerController) {
            this._pointerController.dispose();
        }
        if (controller instanceof InputsNavigationController) {
            this._pointerController = controller;
        } else {
            this._pointerController = new InputsNavigationController(controller, this._map);
            this._ownPointerController = true;
        }
        return this;
    }

    protected _createMap(): IMap3D {
        return new Map3D(this);
    }

    protected _onBeforeRender(eventData: BABYLON.Scene, eventState: EventState): void {
        this._map.validate();
    }

    protected _onCameraState(eventData: ICameraViewState) {
        this.setCameraState(eventData);
    }

    public dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        this._pointerController?.dispose();
        this._beforeRenderObserver?.remove();
        this._cameraMonitoring?.dispose();
        this._activCameraChangeMonitor?.dispose();
        this._map.dispose();
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }
}
