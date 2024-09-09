import * as BABYLON from "@babylonjs/core";
import { IDisplay, IHasTileMapLayerContainer, ITileMapLayerContainer, ITileMapLayerView, ITileMetrics, ITileNavigationApi } from "core/tiles";
import { ElevationMapContentType, IElevationMap, IsElevationHost } from "./map.elevation.interfaces";
import { ElevationMap } from "./map.elevation";
import { Nullable } from "core/types";
import { Observer, EventState } from "core/events";
import { IGeo2 } from "core/geography";
import { VirtualDisplay } from "../display";

export class Map3D extends BABYLON.TransformNode implements ITileNavigationApi<Map3D>, IHasTileMapLayerContainer<ElevationMapContentType> {
    protected _map: IElevationMap;
    protected _layerAddedObserver: Nullable<Observer<Array<ITileMapLayerView<ElevationMapContentType>>>>;
    protected _layerRemovededObserver: Nullable<Observer<Array<ITileMapLayerView<ElevationMapContentType>>>>;
    protected _beforeRenderObserver: Nullable<BABYLON.Observer<BABYLON.Scene>>;

    public constructor(name: string, options?: any, scene?: BABYLON.Scene) {
        super(name, scene);
        this._map = this._createMap();
        this._layerAddedObserver = this.map.layerViews.addedObservable.add(this._onLayerViewAdded.bind(this));
        this._layerRemovededObserver = this.map.layerViews.removedObservable.add(this._onLayerViewRemoved.bind(this));
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
            this.setParent(display.context3D);
        } else if (display instanceof BABYLON.Node) {
            this.setParent(display);
        }
        return this;
    }

    protected _createMap(): IElevationMap {
        return new ElevationMap();
    }

    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventState: EventState): void {
        for (const v of eventData) {
            if (IsElevationHost(v)) {
                v.tilesRoot.setParent(this);
            }
        }
    }

    protected _onBeforeRender(eventData: BABYLON.Scene, eventState: EventState): void {
        this._map.validate();
    }

    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventState: EventState): void {
        for (const v of eventData) {
            if (IsElevationHost(v)) {
                v.tilesRoot.setParent(null);
            }
        }
    }

    public dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        this._beforeRenderObserver?.remove();
        this._layerAddedObserver?.disconnect();
        this._layerRemovededObserver?.disconnect();
        this._map.dispose();
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }
}
