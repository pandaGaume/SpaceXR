import { IDemInfos } from "core/dem";
import { ITile, ITileDisplay, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationState, ImageLayer, TileMapBase } from "core/tiles";
import { ElevationLayer, ElevationTile } from "./map.elevation.layer";
import { EventState, Observable } from "core/events";
import { Nullable, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type ElevationTileContentType = IDemInfos | HTMLImageElement;

export class Map3d extends TransformNode implements ITileMap<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>, Map3d> {
    private _map: TileMapBase<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>>;

    public constructor(name: string, display?: ITileDisplay) {
        super(name);
        this._map = new TileMapBase(name, display);
        this._map.linkTo(this);
    }

    // TILE map API
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): Map3d {
        this._map.setViewMap(center, zoom, rotation);
        return this;
    }
    public zoomMap(delta: number): Map3d {
        this._map.zoomMap(delta);
        return this;
    }
    public zoomInMap(delta: number): Map3d {
        this._map.zoomInMap(delta);
        return this;
    }
    public zoomOutMap(delta: number): Map3d {
        this._map.zoomOutMap(delta);
        return this;
    }
    public translatePixelMap(tx: number, ty: number, metrics?: ITileMetrics): Map3d {
        this._map.translatePixelMap(tx, ty, metrics);
        return this;
    }
    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): Map3d {
        this._map.translateMap(lat, lon);
        return this;
    }
    public rotateMap(r: number): Map3d {
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
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onTextureLayerAdded(layer);
        }
    }
    public removeLayer(layer: ITileMapLayer<ElevationTileContentType>): void {
        this._map.removeLayer(layer);
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
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
    public added(eventData: Array<ElevationTile> | Array<ITile<HTMLImageElement>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onElevationAdded(tile);
                continue;
            }

            this._onTextureAdded(tile);
        }
    }
    public removed(eventData: Array<ElevationTile> | Array<ITile<HTMLImageElement>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onElevationRemoved(tile);
                continue;
            }
            this._onTextureRemoved(tile);
        }
    }
    public updated(eventData: Array<ElevationTile> | Array<ITile<HTMLImageElement>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onElevationUpdated(tile);
                continue;
            }
            this._onTextureUpdated(tile);
        }
    }
    /// End TargetBlock

    /// handlers
    protected _onElevationLayerAdded(layer: ElevationLayer): void {
        // register the root of the layer under the map
        layer.root.parent = this;
    }

    protected _onElevationLayerRemoved(layer: ElevationLayer): void {
        // unregister the root of the layer from the map
        layer.root.parent = null;
    }

    protected _onTextureLayerAdded(layer: ImageLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureLayerRemoved(layer: ImageLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationAdded(tile: ElevationTile): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationRemoved(tile: ElevationTile): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationUpdated(tile: ElevationTile): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureAdded(tile: ITile<HTMLImageElement>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureRemoved(tile: ITile<HTMLImageElement>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureUpdated(tile: ITile<HTMLImageElement>): void {
        /* nothing to do here - overrided by subclasses */
    }
}
