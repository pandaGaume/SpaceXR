import { IDemInfos } from "core/dem";
import { IPipelineMessageType, ITile, ITileDisplay, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer, TileMapBase } from "core/tiles";
import { ElevationLayer } from "./map.elevation.layer";
import { EventState, Observable } from "core/events";
import { Nullable, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type ElevationTileContentType = IDemInfos | HTMLImageElement;
export type ElevationLayerType = ImageLayer | ElevationLayer;

export class ElevationMap extends TransformNode implements ITileNavigationApi<ElevationMap>, ITileMap<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
    private _map: TileMapBase<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>>;

    public constructor(name: string, display?: ITileDisplay) {
        super(name);
        this._map = new TileMapBase(name, display);
        this._map.linkTo(this);
    }

    // TILE map API
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): ElevationMap {
        this._map.setViewMap(center, zoom, rotation);
        return this;
    }

    public zoomMap(delta: number): ElevationMap {
        this._map.zoomMap(delta);
        return this;
    }

    public zoomInMap(delta: number): ElevationMap {
        this._map.zoomInMap(delta);
        return this;
    }
    public zoomOutMap(delta: number): ElevationMap {
        this._map.zoomOutMap(delta);
        return this;
    }
    public translatePixelMap(tx: number, ty: number, metrics?: ITileMetrics): ElevationMap {
        this._map.translatePixelMap(tx, ty, metrics);
        return this;
    }
    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): ElevationMap {
        this._map.translateMap(lat, lon);
        return this;
    }
    public rotateMap(r: number): ElevationMap {
        this._map.rotateMap(r);
        return this;
    }

    public get navigation(): ITileNavigationState {
        return this._map.navigation;
    }

    public get layerAddedObservable(): Observable<ITileMapLayer<ElevationTileContentType>> {
        return this._map.layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<ITileMapLayer<ElevationTileContentType>> {
        return this._map.layerRemovedObservable;
    }

    public getLayers(predicate?: (l: ITileMapLayer<ElevationTileContentType>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<ElevationTileContentType>> {
        return this._map.getLayers(predicate, sorted);
    }

    public addLayer(layer: ITileMapLayer<ElevationTileContentType>): void {
        this._map.addLayer(layer);
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerAdded(layer);
        } else if (layer instanceof ImageLayer) {
            this._onTextureLayerAdded(layer);
        }
    }

    public removeLayer(layer: ITileMapLayer<ElevationTileContentType>): void {
        this._map.removeLayer(layer);
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(layer);
        } else if (layer instanceof ImageLayer) {
            this._onTextureLayerRemoved(layer);
        }
    }
    // END TILE map API

    public dispose() {
        super.dispose();
        this._map?.dispose();
    }

    public get display(): Nullable<ITileDisplay> {
        return this._map.display;
    }

    /// TargetBlock
    public added(eventData: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        if (eventState.currentTarget instanceof ElevationLayer) {
            this._onElevationAdded(eventData, eventState);
        } else {
            this._onTextureAdded(eventData, eventState);
        }
    }
    public removed(eventData: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        if (eventState.currentTarget instanceof ElevationLayer) {
            this._onElevationRemoved(eventData, eventState);
        } else {
            this._onTextureRemoved(eventData, eventState);
        }
    }
    public updated(eventData: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        if (eventState.currentTarget instanceof ElevationLayer) {
            this._onElevationUpdated(eventData, eventState);
        } else {
            this._onTextureUpdated(eventData, eventState);
        }
    }
    /// End TargetBlock

    /// handlers
    protected _onElevationLayerAdded(layer: ElevationLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationLayerRemoved(container: ElevationLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureLayerAdded(container: ImageLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureLayerRemoved(container: ImageLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationAdded(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationRemoved(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationUpdated(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureAdded(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureRemoved(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureUpdated(data: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {
        /* nothing to do here - overrided by subclasses */
    }
}
