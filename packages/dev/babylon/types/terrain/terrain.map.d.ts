import { AbstractMesh, Mesh, Scene, TransformNode, Vector3, VertexData } from "@babylonjs/core";
import { IGeo2 } from "core/geography/geography.interfaces";
import { AbstractDisplayMap } from "core/map";
import { ITile, ITileAddress, ITileDatasource } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions } from "core/meshes/terrain.grid";
import { ICartesian3, IRectangle } from "core/geometry/geometry.interfaces";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { TerrainTile } from "./terrain.tile";
export declare class SurfaceTileMapOptions {
    static Default: SurfaceTileMapOptions;
    center?: IGeo2;
    levelOfDetail?: number;
    gridOptions?: TerrainGridOptions;
    insets?: ICartesian3;
    constructor(p: Partial<SurfaceTileMapOptions>);
}
export declare class SurfaceTileMapOptionsBuilder {
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;
    _insets?: ICartesian3;
    withCenter(v?: IGeo2): SurfaceTileMapOptionsBuilder;
    withLeveOfDetail(v?: number): SurfaceTileMapOptionsBuilder;
    withGridOptions(v?: TerrainGridOptions): SurfaceTileMapOptionsBuilder;
    withInsets(v?: ICartesian3): SurfaceTileMapOptionsBuilder;
    build(): SurfaceTileMapOptions;
}
export declare class SurfaceTileMap<V, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    _pivot: TransformNode;
    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;
    _tileCurrentSize?: number;
    _tileCurrentOffset?: Vector3;
    constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Scene);
    get template(): Mesh;
    hasMesh(mesh: Mesh): boolean;
    protected buildGrid(): VertexData;
    protected buildMesh(name: string, scene?: Scene): Mesh;
    protected buildInstance(name: string, tile: TerrainTile<V>): AbstractMesh;
    protected buildMapTile(t: ITile<V>): TerrainTile<V>;
    protected onDeleted(key: string, tile: TerrainTile<V>): void;
    protected onAdded(key: string, tile: TerrainTile<V>): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: TerrainTile<V>[] | undefined): void;
    private invalidate;
}
