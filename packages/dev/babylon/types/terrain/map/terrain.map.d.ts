import { AbstractMesh, Material, Mesh, Nullable, Scene, VertexData } from "@babylonjs/core";
import { IGeo2 } from "core/geography/geography.interfaces";
import { AbstractDisplayMap } from "core/map";
import { ITile, ITileAddress, ITileClient, ITileDatasource } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions } from "core/meshes/terrain.grid";
import { IRectangle } from "core/geometry/geometry.interfaces";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { TerrainTile } from "../terrain.tile";
import { IDemInfos } from "core/dem/dem.interfaces";
import { LODTransitionMode } from "core/tiles/tiles.mapview";
import { TerrainHologramMaterialOptions } from "../../materials";
export declare class SurfaceTileMapOptions extends TerrainHologramMaterialOptions {
    static Default: SurfaceTileMapOptions;
    center?: IGeo2;
    levelOfDetail?: number;
    gridOptions?: TerrainGridOptions;
    lodTransition?: LODTransitionMode;
    constructor(p: Partial<SurfaceTileMapOptions>);
}
export declare class SurfaceTileMapOptionsBuilder {
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;
    _exageration?: number;
    _layerClient?: ITileClient<HTMLImageElement>;
    _lodTransition?: LODTransitionMode;
    withCenter(v?: IGeo2): SurfaceTileMapOptionsBuilder;
    withLeveOfDetail(v?: number): SurfaceTileMapOptionsBuilder;
    withGridOptions(v?: TerrainGridOptions): SurfaceTileMapOptionsBuilder;
    withExageration(v?: number): SurfaceTileMapOptionsBuilder;
    withLodTransition(v?: LODTransitionMode): SurfaceTileMapOptionsBuilder;
    withLayer(v: ITileClient<HTMLImageElement>): SurfaceTileMapOptionsBuilder;
    build(): SurfaceTileMapOptions;
}
export declare class SurfaceTileMap<V extends IDemInfos, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    private static InitZ;
    private static InitUV;
    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;
    constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Nullable<Scene>);
    set material(m: Nullable<Material>);
    get material(): Nullable<Material>;
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
    protected buildMaterial(name: string, scene?: Nullable<Scene>): Nullable<Material>;
    private invalidate;
}
