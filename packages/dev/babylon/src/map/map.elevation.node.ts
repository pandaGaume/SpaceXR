import * as BABYLON from "@babylonjs/core";
import { IDisplay, IHasTileMapLayerContainer, ITileMapLayerContainer, ITileMetrics, ITileNavigationApi } from "core/tiles";
import { ElevationMapContentType, IElevationMap } from "./map.elevation.interfaces";
import { ElevationMap } from "./map.elevation";
import { Nullable } from "core/types";
import { EventState } from "core/events";
import { IGeo2 } from "core/geography";
import { VirtualDisplay } from "../display";

/// <sumary>
/// Act as proxy for Elevation Map, and bind the rendering evenyt of the scene
/// </sumary>
export class Map3D extends BABYLON.TransformNode implements ITileNavigationApi<Map3D>, IHasTileMapLayerContainer<ElevationMapContentType> {
    protected _map: IElevationMap;
    protected _beforeRenderObserver: Nullable<BABYLON.Observer<BABYLON.Scene>>;

    public constructor(name: string, options?: any, scene?: BABYLON.Scene) {
        super(name, scene);
        this._map = this._createMap();
        this._beforeRenderObserver = this.getScene().onBeforeRenderObservable.add(this._onBeforeRender.bind(this));
    }

    public get layers(): ITileMapLayerContainer<ElevationMapContentType> {
        return this._map.layers;
    }

    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): Map3D {
        this._map.setViewMap(center, zoom, rotation, validate);
        return this;
    }

    public zoomMap(delta: number, validate?: boolean): Map3D {
        this._map.zoomMap(delta, validate);
        return this;
    }

    public zoomInMap(delta: number, validate?: boolean): Map3D {
        this._map.zoomInMap(delta, validate);
        return this;
    }

    public zoomOutMap(delta: number, validate?: boolean): Map3D {
        this._map.zoomOutMap(delta, validate);
        return this;
    }

    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics, validate?: boolean): Map3D {
        this._map.translateUnitsMap(tx, ty, metrics, validate);
        return this;
    }

    public translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): Map3D {
        this._map.translateMap(dlat, dlon, validate);
        return this;
    }

    public rotateMap(r: number, validate?: boolean): Map3D {
        this._map.rotateMap(r, validate);
        return this;
    }

    public get map(): IElevationMap {
        return this._map;
    }

    public withDisplay(display: IDisplay): Map3D {
        this._map.display = display;
        if (display instanceof VirtualDisplay) {
            this.parent = display.context3D;
        } else if (display instanceof BABYLON.Node) {
            this.parent = display;
        }
        return this;
    }

    protected _createMap(): IElevationMap {
        return new ElevationMap(this);
    }

    protected _onBeforeRender(eventData: BABYLON.Scene, eventState: EventState): void {
        this._map.validate();
    }

    public dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        this._beforeRenderObserver?.remove();
        this._map.dispose();
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }
}
