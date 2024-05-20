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
import { ElevationLayer, ElevationTile } from "./map.elevation.layer";
import { EventState, Observable } from "core/events";
import { Nullable, Scene, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";
import { Map3dMaterial, WebMapMaterial } from "../materials";
import { Size2 } from "core/geometry";
import { IPointerSource, PointerController } from "core/map";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type Map3dTileContentType = IDemInfos | HTMLImageElement;

export interface IMap3DMetrics {
    resolution: Size2;
    dimension: Size2;
    scale: number;
    spatialResolution: Size2;

    getLevelOfDetail(center: IGeo2, metrics: ITileMetrics): number;
}

export interface IMap3dOptions {
    metrics: IMap3DMetrics;
    material?: Map3dMaterial; // default is WebMapMaterial.
}

export class Map3d extends TransformNode implements ITileMap<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>, Map3d> {
    public static DefaultTextureSize: number = 1024;

    // the map logic. This is the main entry point for the map API.
    private _map: TileMapBase<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>>;
    // only meshes have materials, we will use this material to apply to the elevation layer which own a mesh.
    private _material: Nullable<Map3dMaterial>;
    private _controller: Nullable<PointerController<IPointerSource>>;

    public constructor(name: string, options: IMap3dOptions, scene: Scene) {
        super(name, scene);
        const m = options.metrics;
        const display = new TileDisplayBounds(m.resolution.width, m.resolution.height);
        this._map = new TileMapBase(name, display);
        // TODO : this is not the place for scaling ....
        this.scaling.set(m.dimension.width / display.displayWidth, m.dimension.height / display.displayHeight, 1);
        this._material = options?.material ?? this._createDefaultMaterial();
        this._controller = null;
    }

    public get material(): Nullable<Map3dMaterial> {
        return this._material;
    }

    public withPointerControl(controller: PointerController<IPointerSource> | IPointerSource): Map3d {
        if (this._controller) {
            this._controller.dispose();
        }
        this._controller = controller instanceof PointerController ? controller : new PointerController(controller, this);
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
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerAdded(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onImageLayerAdded(layer);
        }
    }
    public removeLayer(layer: ITileMapLayer<Map3dTileContentType>): void {
        this._map.removeLayer(layer);
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onImageLayerRemoved(layer);
        }
    }
    // END TILE map API

    public dispose() {
        super.dispose();
        this._map?.dispose();
    }

    public get display(): Nullable<ITileDisplayBounds> {
        return this._map.display;
    }

    /// TargetBlock
    public added(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onDemAdded(eventState.target, tile);
                continue;
            }
            this._onImageAdded(eventState.target, <ITile<HTMLImageElement>>tile);
        }
    }

    public removed(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onDemRemoved(eventState.target, tile);
                continue;
            }
            this._onImageRemoved(eventState.target, <ITile<HTMLImageElement>>tile);
        }
    }

    public updated(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onDemUpdated(eventState.target, tile);
                continue;
            }
            this._onImageUpdated(eventState.target, <ITile<HTMLImageElement>>tile);
        }
    }
    /// End TargetBlock

    /// handlers
    protected _onElevationLayerAdded(layer: ElevationLayer): void {
        // register the root of the layer under the map
        layer.root.parent = this;
        if (this._material && !layer.mesh.material) {
            layer.mesh.material = this._material;
        }
        layer.linkTo(this);
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

    protected _onDemAdded(src: ElevationLayer, tile: ElevationTile): void {
        this._material?.demAdded(src, tile);
    }

    protected _onDemRemoved(src: ElevationLayer, tile: ElevationTile): void {
        this._material?.demRemoved(src, tile);
    }

    protected _onDemUpdated(src: ElevationLayer, tile: ElevationTile): void {
        this._material?.demUpdated(src, tile);
    }

    protected _onImageAdded(src: ImageLayer, tile: ITile<HTMLImageElement>): void {
        this._material?.imageAdded(src, tile);
    }

    protected _onImageRemoved(src: ImageLayer, tile: ITile<HTMLImageElement>): void {
        this._material?.imageRemoved(src, tile);
    }

    protected _onImageUpdated(src: ImageLayer, tile: ITile<HTMLImageElement>): void {
        this._material?.imageUpdated(src, tile);
    }

    protected _createDefaultMaterial() {
        return new WebMapMaterial(this._createDefaulMaterialName(), this.getScene());
    }

    protected _createDefaulMaterialName() {
        return `${this.name}_material`;
    }
}
