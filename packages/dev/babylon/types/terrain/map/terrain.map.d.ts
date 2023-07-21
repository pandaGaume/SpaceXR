import { AbstractMesh, Material, Mesh, Nullable, Scene, Vector3, VertexData } from "@babylonjs/core";
import { IGeo2 } from "core/geography/geography.interfaces";
import { AbstractDisplayMap } from "core/map";
import { ITile, ITileAddress, ITileDatasource } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions } from "core/meshes/terrain.grid";
import { ICartesian3, IRectangle } from "core/geometry/geometry.interfaces";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { TerrainTile } from "../terrain.tile";
import { IDemInfos } from "core/dem/dem.interfaces";
export declare class SurfaceTileMapOptions {
    static Default: SurfaceTileMapOptions;
    center?: IGeo2;
    levelOfDetail?: number;
    gridOptions?: TerrainGridOptions;
    insets?: ICartesian3;
    exageration?: number;
    constructor(p: Partial<SurfaceTileMapOptions>);
}
export declare class SurfaceTileMapOptionsBuilder {
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;
    _insets?: ICartesian3;
    _exageration?: number;
    withCenter(v?: IGeo2): SurfaceTileMapOptionsBuilder;
    withLeveOfDetail(v?: number): SurfaceTileMapOptionsBuilder;
    withGridOptions(v?: TerrainGridOptions): SurfaceTileMapOptionsBuilder;
    withInsets(v?: ICartesian3): SurfaceTileMapOptionsBuilder;
    withExageration(v?: number): SurfaceTileMapOptionsBuilder;
    build(): SurfaceTileMapOptions;
}
export declare class SurfaceTileMap<V extends IDemInfos, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    private static InitZ;
    private static InitUV;
    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;
    _offset?: Vector3;
    constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Nullable<Scene>);
    get template(): Mesh;
    hasMesh(mesh: Mesh): boolean;
    protected buildGrid(): VertexData;
    protected buildMesh(name: string, scene?: Nullable<Scene>): Mesh;
    protected buildInstance(name: string, tile: TerrainTile<V>): AbstractMesh;
    protected buildMapTile(t: ITile<V>): TerrainTile<V>;
    protected onDeleted(key: string, tile: TerrainTile<V>): void;
    protected onUpdated(key: string, tile: TerrainTile<V>): void;
    protected onAdded(key: string, tile: TerrainTile<V>): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: TerrainTile<V>[] | undefined): void;
    protected buildMaterial(scene?: Nullable<Scene>): Nullable<Material>;
    private invalidate;
}
