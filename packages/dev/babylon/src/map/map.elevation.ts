import { IDemInfos } from "core/dem";
import {
    IPipelineMessageType,
    ITile,
    ITileDisplayBounds,
    ITileMap,
    ITileMapLayer,
    ITileMetrics,
    ITileNavigationState,
    ImageLayer,
    TileDisplayBounds,
    TileMapBase,
} from "core/tiles";
import { ElevationLayer } from "./map.elevation.layer";
import { EventState, Observable, Observer } from "core/events";
import { Nullable, Scene, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { IPointerSource, PointerController } from "core/map";
import { hasHolographicBounds, HolographicDisplay } from "../display";


// we use type of IDemInfos for elevation and rgb images for the texture.
export type Map3dTileContentType = IDemInfos | HTMLImageElement;

export function IsMap3dImageTarget(target: any): target is IMap3dImageTarget {
    return target.imageAdded !== undefined && target.imageRemoved !== undefined && target.imageUpdated !== undefined;
}

export function IsMap3dElevationTarget(target: any): target is IMap3dElevationTarget {
    return target.demAdded !== undefined && target.demRemoved !== undefined && target.demUpdated !== undefined;
}

export interface IMap3dElevationTarget {
    demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
}

export interface IMap3dImageTarget {
    imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
}

export interface IMap3DMetrics {
    resolution: Size2;
    dimension: Size2;
    scale: number;
    spatialResolution: Size2;

    getLevelOfDetail(center: IGeo2, metrics: ITileMetrics): number;
}

export interface IMap3dOptions {
    metrics: IMap3DMetrics;
}

export class Map3d extends TransformNode implements ITileMap<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>, Map3d>, IMap3dImageTarget {
    public static DefaultTextureSize: number = 1024;

    // the map logic. This is the main entry point for the map API.
    private _map: TileMapBase<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>>;
    private _addLayerObserver: Nullable<Observer<ITileMapLayer<Map3dTileContentType>>>;
    private _removeLayerObserver: Nullable<Observer<ITileMapLayer<Map3dTileContentType>>>;

    private _targetDisplay: Nullable<HolographicDisplay>;
    private _controller: Nullable<PointerController<IPointerSource>>;
    private _ownController = false;

    public constructor(name: string, options: IMap3dOptions, scene: Scene) {
        super(name, scene);
        const m = options.metrics;
        const display = new TileDisplayBounds(m.resolution.width, m.resolution.height);

        // create the map
        this._map = new TileMapBase(name, display);
        this._addLayerObserver = this._map.layerAddedObservable.add(this._onLayerAdded.bind(this));
        this._removeLayerObserver = this._map.layerRemovedObservable.add(this._onLayerRemoved.bind(this));

        // TODO : this is not the place for scaling ....
        this.scaling.set(m.dimension.width / display.displayWidth, m.dimension.height / display.displayHeight, 1);
        this._controller = null;
        this._targetDisplay = null;
    }

    public withDisplay(display: HolographicDisplay): Map3d {
        this._targetDisplay = display;
        for (var l of this.getElevationLayers()) {
            if (l.enabled == false) {
                continue;
            }
            var m = l.mesh.material;
            if (m && hasHolographicBounds(m)) {
                m.holographicBounds = display;
            }
        }
        return this.withPointerControl(this._targetDisplay.pointerSource);
    }

    public withPointerControl(controller: PointerController<IPointerSource> | IPointerSource): Map3d {
        if (this._controller && this._ownController) {
            this._controller.dispose();
        }
        if (controller instanceof PointerController) {
            this._controller = controller;
        } else {
            this._controller = new PointerController(controller, this);
            this._ownController = true;
        }
        return this;
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
    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): Map3d {
        this._map.translateUnitsMap(tx, ty, metrics);
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
    public get layerAddedObservable(): Observable<ITileMapLayer<Map3dTileContentType>> {
        return this._map.layerAddedObservable;
    }
    public get layerRemovedObservable(): Observable<ITileMapLayer<Map3dTileContentType>> {
        return this._map.layerRemovedObservable;
    }

    public getLayers(predicate?: (l: ITileMapLayer<Map3dTileContentType>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<Map3dTileContentType>> {
        return this._map.getLayers(predicate, sorted);
    }

    public addLayer(layer: ITileMapLayer<Map3dTileContentType>): void {
        this._map.addLayer(layer);
    }

    public removeLayer(layer: ITileMapLayer<Map3dTileContentType>): void {
        this._map.removeLayer(layer);
    }
    // END TILE map API

    public dispose() {
        super.dispose();
        this._map.dispose();
        this._controller?.dispose();
        this._addLayerObserver?.disconnect();
        this._removeLayerObserver?.disconnect();
    }

    public get display(): Nullable<ITileDisplayBounds> {
        return this._map.display;
    }

    /// TargetBlock
    public added(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (tile && tile.content instanceof HTMLImageElement) {
                this.imageAdded(eventState.target, <ITile<HTMLImageElement>>tile);
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (tile && tile.content instanceof HTMLImageElement) {
                this.imageRemoved(eventState.target, <ITile<HTMLImageElement>>tile);
            }
        }
    }

    public updated(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (tile && tile.content instanceof HTMLImageElement) {
                this.imageUpdated(eventState.target, <ITile<HTMLImageElement>>tile);
            }
        }
    }
    /// End TargetBlock

    public imageAdded(src: ImageLayer, tile: ITile<HTMLImageElement>): void {
        // looking for every dem enabled layer to forward the image
        for (const layer of this.getElevationLayers()) {
            layer.imageAdded(src, tile);
        }
    }

    public imageRemoved(src: ImageLayer, tile: ITile<HTMLImageElement>): void {
        // looking for every dem enabled layer to forward the image
        for (const layer of this.getElevationLayers()) {
            layer.imageRemoved(src, tile);
        }
    }

    public imageUpdated(src: ImageLayer, tile: ITile<HTMLImageElement>): void {
        // looking for every dem enabled layer to forward the image
        for (const layer of this.getElevationLayers()) {
            layer.imageUpdated(src, tile);
        }
    }

    /// handlers

    protected _onLayerAdded(layer: ITileMapLayer<Map3dTileContentType>): void {
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerAdded(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onImageLayerAdded(layer);
        }
    }

    protected _onLayerRemoved(layer: ITileMapLayer<Map3dTileContentType>): void {
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onImageLayerRemoved(layer);
        }
    }

    protected _onElevationLayerAdded(layer: ElevationLayer): void {
        // register the root of the layer under the map
        layer.root.parent = this;
        layer.linkTo(this);
        if (this._targetDisplay) {
            var m = layer.mesh.material;
            if (m && hasHolographicBounds(m)) {
                m.holographicBounds = this._targetDisplay;
            }
        }
    }

    protected _onElevationLayerRemoved(layer: ElevationLayer): void {
        layer.unlinkFrom(this);
        // unregister the root of the layer from the map
        layer.root.parent = null;
        layer.mesh.material = null;
    }

    protected _onImageLayerAdded(layer: ImageLayer): void {
        layer.linkTo(this);
    }

    protected _onImageLayerRemoved(layer: ImageLayer): void {
        layer.unlinkFrom(this);
    }

    protected *getElevationLayers(): IterableIterator<ElevationLayer> {
        for (const layer of this._map.getLayers((l) => l.enabled && l instanceof ElevationLayer)) {
            yield <ElevationLayer>layer;
        }
    }
}
