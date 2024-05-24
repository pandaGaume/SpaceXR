import { AbstractMesh, Mesh, Nullable, Scene, TransformNode, VertexData, Material } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ITile, ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileNavigationState, ITileProvider, ImageLayer, Tile, TileContentType } from "core/tiles";
import { ICartesian2, ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs, EventState } from "core/events";
import { Bearing } from "core/geography";
import { IMap3dImageTarget } from "./map.elevation";
import { ClipIndex, ClipPlaneDefinition, IClipableContent } from "../display";
export interface IElevationTile extends ITile<IDemInfos> {
    surface: Nullable<AbstractMesh>;
}
export declare class ElevationTile extends Tile<IDemInfos> implements ElevationTile {
    _surface: Nullable<AbstractMesh>;
    constructor(x: number, y: number, levelOfDetail: number, data: IDemInfos);
    get surface(): Nullable<AbstractMesh>;
}
export interface IElevationTileOptions extends ITileMapLayerOptions {
    exageration?: number;
    gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    insets?: ICartesian3;
    material?: Material;
}
export declare class ElevationLayer extends DemLayer implements IMap3dImageTarget, IClipableContent {
    private static InitZ;
    private static InitUV;
    _grid: VertexData;
    _template: Mesh;
    _exageration?: number;
    _insets?: ICartesian3;
    _gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    _root: TransformNode;
    _tilesRoot: TransformNode;
    _cartesianCenter: Nullable<ICartesian2>;
    constructor(name: string, source: ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationTileOptions, enabled?: boolean);
    addClipPlane(...clipPlanes: ClipPlaneDefinition[]): IClipableContent;
    removeClipPlane(...indices: ClipIndex[]): IClipableContent;
    clearClipPlanes(): IClipableContent;
    get root(): TransformNode;
    get mesh(): Mesh;
    imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    protected _buildMesh(name: string, material: Nullable<Material>, scene?: Scene): Mesh;
    protected _createMesh(name: string, scene?: Nullable<Scene>): Mesh;
    protected _buildInstance(name: string, tile: ElevationTile): AbstractMesh;
    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void;
    protected _onZoomChanged(scale: number): void;
    protected _onAzimuthChanged(azimuth: Bearing): void;
    protected _onCenterChanged(center: Nullable<ICartesian2>): void;
    protected _setTilePosition(tile: ElevationTile, center: ICartesian2): void;
    protected _buildProvider(source: ITileDatasource<IDemInfos, ITileAddress>, cache?: IMemoryCache<string, TileContentType<IDemInfos>>, type?: new (...args: any[]) => ITile<IDemInfos>): ITileProvider<IDemInfos>;
    protected _buildTopology(): VertexData;
    protected _buildTerrainOptions(options?: TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions;
    protected _onTileAdded(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _onTileUpdated(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _buildNameWithSuffix(suffix: string): string;
    protected _createDefaultMaterial(scene?: Scene): Material;
}
