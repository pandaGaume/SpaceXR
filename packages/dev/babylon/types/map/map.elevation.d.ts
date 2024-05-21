import { IDemInfos } from "core/dem";
import { IPipelineMessageType, ITile, ITileDisplayBounds, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationState, ImageLayer } from "core/tiles";
import { ElevationLayer, ElevationTile } from "./map.elevation.layer";
import { EventState, Observable } from "core/events";
import { Nullable, Scene, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { IPointerSource, PointerController } from "core/map";
export type Map3dTileContentType = IDemInfos | HTMLImageElement;
export declare function IsMap3dImageTarget(target: any): target is IMap3dImageTarget;
export declare function IsMap3dElevationTarget(target: any): target is IMap3dElevationTarget;
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
export declare class Map3d extends TransformNode implements ITileMap<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>, Map3d>, IMap3dElevationTarget, IMap3dImageTarget {
    static DefaultTextureSize: number;
    private _map;
    private _controller;
    constructor(name: string, options: IMap3dOptions, scene: Scene);
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
    demAdded(src: ElevationLayer, tile: ElevationTile): void;
    demRemoved(src: ElevationLayer, tile: ElevationTile): void;
    demUpdated(src: ElevationLayer, tile: ElevationTile): void;
    imageAdded(src: ImageLayer, tile: ITile<HTMLImageElement>): void;
    imageRemoved(src: ImageLayer, tile: ITile<HTMLImageElement>): void;
    imageUpdated(src: ImageLayer, tile: ITile<HTMLImageElement>): void;
    protected _onElevationLayerAdded(layer: ElevationLayer): void;
    protected _onElevationLayerRemoved(layer: ElevationLayer): void;
    protected _onImageLayerAdded(layer: ImageLayer): void;
    protected _onImageLayerRemoved(layer: ImageLayer): void;
    protected getElevationLayers(): IterableIterator<ElevationLayer>;
}
