import { AbstractMesh, EventState, Material, Mesh, Nullable, Scene, VertexData } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileProvider, Tile, TileContentType } from "core/tiles";
export declare class ElevationTile extends Tile<IDemInfos> {
    _surface: Nullable<AbstractMesh>;
    constructor(x: number, y: number, levelOfDetail: number, data: IDemInfos);
}
export interface IElevationTileOptions extends ITileMapLayerOptions {
    exageration?: number;
    gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    material?: Material;
}
export declare class ElevationLayer extends DemLayer {
    private static InitZ;
    private static InitUV;
    _grid: VertexData;
    _template: Mesh;
    _exageration?: number;
    _gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;
    _material: Nullable<Material>;
    constructor(name: string, source: ITileDatasource<IDemInfos, ITileAddress>, options?: IElevationTileOptions, enabled?: boolean);
    protected _buildMesh(name: string, scene?: Nullable<Scene>): Mesh;
    protected _buildInstance(name: string, tile: ElevationTile): AbstractMesh;
    protected _buildProvider(source: ITileDatasource<IDemInfos, ITileAddress>, cache?: IMemoryCache<string, TileContentType<IDemInfos>>): ITileProvider<IDemInfos>;
    protected _buildTopology(): VertexData;
    protected _buildTerrainOptions(options?: TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions;
    protected _onTileAdded(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ElevationTile>, eventState: EventState): void;
    protected _buildMeshName(tile: ElevationTile): string;
}
