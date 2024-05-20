import { IDemInfos } from "core/dem";
import { IPipelineMessageType, ITile, ITileDisplayBounds, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationState, ImageLayer } from "core/tiles";
import { ElevationLayer, ElevationTile } from "./map.elevation.layer";
import { EventState, Observable } from "core/events";
import { Nullable, Scene, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";
import { Map3dMaterial, WebMapMaterial } from "../materials";
import { Size2 } from "core/geometry";
import { IPointerSource, PointerController } from "core/map";
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
    material?: Map3dMaterial;
}
export declare class Map3d extends TransformNode implements ITileMap<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>, Map3d> {
    static DefaultTextureSize: number;
    private _map;
    private _material;
    private _controller;
    constructor(name: string, options: IMap3dOptions, scene: Scene);
    get material(): Nullable<Map3dMaterial>;
    withPointerControl(controller: PointerController<IPointerSource> | IPointerSource): Map3d;
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): Map3d;
    zoomMap(delta: number): Map3d;
    zoomInMap(delta: number): Map3d;
    zoomOutMap(delta: number): Map3d;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): Map3d;
    translateMap(lat: IGeo2 | Array<number> | number, lon?: number): Map3d;
    rotateMap(r: number): Map3d;
    get navigation(): ITileNavigationState;
    get layerAddedObservable(): Observable<ITileMapLayer<Map3dTileContentType>>;
    get layerRemovedObservable(): Observable<ITileMapLayer<Map3dTileContentType>>;
    getLayers(predicate?: (l: ITileMapLayer<Map3dTileContentType>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<Map3dTileContentType>>;
    addLayer(layer: ITileMapLayer<Map3dTileContentType>): void;
    removeLayer(layer: ITileMapLayer<Map3dTileContentType>): void;
    dispose(): void;
    get display(): Nullable<ITileDisplayBounds>;
    added(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void;
    protected _onElevationLayerAdded(layer: ElevationLayer): void;
    protected _onElevationLayerRemoved(layer: ElevationLayer): void;
    protected _onImageLayerAdded(layer: ImageLayer): void;
    protected _onImageLayerRemoved(layer: ImageLayer): void;
    protected _onDemAdded(src: ElevationLayer, tile: ElevationTile): void;
    protected _onDemRemoved(src: ElevationLayer, tile: ElevationTile): void;
    protected _onDemUpdated(src: ElevationLayer, tile: ElevationTile): void;
    protected _onImageAdded(src: ImageLayer, tile: ITile<HTMLImageElement>): void;
    protected _onImageRemoved(src: ImageLayer, tile: ITile<HTMLImageElement>): void;
    protected _onImageUpdated(src: ImageLayer, tile: ITile<HTMLImageElement>): void;
    protected _createDefaultMaterial(): WebMapMaterial;
    protected _createDefaulMaterialName(): string;
}
