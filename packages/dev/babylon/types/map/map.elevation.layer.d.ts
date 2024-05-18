import { AbstractMesh, Mesh, Nullable, Scene, TransformNode, VertexData, Material } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ITile, ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileNavigationState, ITileProvider, Tile, TileContentType } from "core/tiles";
import { ICartesian2, ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs, EventState } from "core/events";
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
export declare class ElevationLayer extends DemLayer {
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
    get root(): TransformNode;
    get mesh(): Mesh;
    protected _buildMesh(name: string, scene?: Nullable<Scene>): Mesh;
    protected _createMesh(name: string, scene?: Nullable<Scene>): Mesh;
    protected _buildInstance(name: string, tile: ElevationTile): AbstractMesh;
    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void;
    protected _onZoomChanged(scale: number): void;
    protected _onAzimuthChanged(azimuth: number): void;
    protected _onCenterChanged(center: Nullable<ICartesian2>): void;
    protected _setTilePosition(tile: ElevationTile, center: ICartesian2, offset?: ICartesian3): void;
    protected _buildProvider(source: ITileDatasource<IDemInfos, ITileAddress>, cache?: IMemoryCache<string, TileContentType<IDemInfos>>, type?: new (...args: any[]) => ITile<IDemInfos>): ITileProvider<IDemInfos>;
    protected _buildTopology(): VertexData;
    protected _buildTerrainOptions(options?: TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions;
    protected _onTileAdded(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _buildNameWithSuffix(suffix: string): string;
}
