import { Nullable, Scene, TransformNode, Node, Color4 } from "@babylonjs/core";
import { IHasNavigationState, IHasTileMapLayerContainer, ITileMapLayer, ITileMapLayerContainer, ITileMetrics, ITileNavigationApi, ITileNavigationState } from "core/tiles";
import { IGeo2 } from "core/geography";
import { ISize2 } from "core/geometry";
import { CanvasTileSourceSourceContentType, IPointerSource, PointerController } from "core/map";
import { HolographicDisplay } from "../display";
import { Map3dElevationHost } from "./map.elevation.host";
import { ElevationLayer } from "./map.elevation.layer";
import { IDemInfos } from "core/dem";
export type Map3dTextureContentType = CanvasTileSourceSourceContentType;
export type Map3dElevationContentType = IDemInfos;
export type Map3dContentType = Map3dTextureContentType | Map3dElevationContentType;
export declare enum ElevationSamplingMode {
    GRID = 0,
    POINT_CLOUD = 1
}
export declare enum ElevationSamplingResolutionMode {
    FIXED = 0,
    ADAPTATIVE = 1
}
export interface IMap3DMetrics {
    elevationSamplingMode?: ElevationSamplingMode;
    elevationSamplingResolutionMode?: ElevationSamplingResolutionMode;
    elevationSamplingResolution?: number;
    textureResolution?: ISize2;
}
export interface IMap3dSurfaceOptions {
    color?: Color4;
    shininess?: number;
}
export interface IMap3dOptions {
    metrics: IMap3DMetrics;
    surfaceOptions: IMap3dSurfaceOptions;
}
export declare class Map3d extends TransformNode implements IHasTileMapLayerContainer<Map3dContentType, ITileMapLayer<Map3dContentType>>, ITileNavigationApi<Map3d>, IHasNavigationState {
    static DefaultTextureSize: number;
    static HostSuffix: string;
    private _layers;
    private _elevationLayersView;
    private _textureLayersView;
    private _addLayerObserver;
    private _removeLayerObserver;
    private _validateHostObserver;
    private _targetDisplay;
    private _controller;
    private _ownController;
    private _elevationHosts;
    private _navigation;
    private _navigationUpdatedObserver;
    constructor(name: string, options: IMap3dOptions, scene: Scene);
    get navigation(): ITileNavigationState;
    setViewMap(center: IGeo2 | number[], zoom?: number | undefined, rotation?: number | undefined): Map3d;
    zoomMap(delta: number): Map3d;
    zoomInMap(delta: number): Map3d;
    zoomOutMap(delta: number): Map3d;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics | undefined): Map3d;
    translateMap(dlat: number | IGeo2 | number[], dlon?: number | undefined): Map3d;
    rotateMap(r: number): Map3d;
    get layerContainer(): ITileMapLayerContainer<Map3dContentType, ITileMapLayer<Map3dContentType>>;
    dispose(): void;
    withDisplay(display: HolographicDisplay): Map3d;
    protected _searchForDisplay(node: Nullable<Node>): Nullable<HolographicDisplay>;
    protected _createNavigationState(): ITileNavigationState;
    protected _withPointerControl(controller: PointerController<IPointerSource> | IPointerSource): Map3d;
    protected _onLayerAdded(layer: ITileMapLayer<Map3dContentType>): void;
    protected _onLayerRemoved(layer: ITileMapLayer<Map3dContentType>): void;
    protected _addedElevationLayer(layer: ElevationLayer): void;
    protected _createElevationHost(layer: ElevationLayer): Map3dElevationHost;
    protected _removedElevationLayer(layer: ElevationLayer): void;
    protected _addedImageLayer(layer: ITileMapLayer<Map3dTextureContentType>): void;
    protected _removedImageLayer(layer: ITileMapLayer<Map3dTextureContentType>): void;
    private _onNavigationUpdatedInternal;
    private _updateLayerWithDisplayAndNavigation;
    protected _validateElevationHost(): void;
}
