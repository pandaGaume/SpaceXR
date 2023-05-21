import { IGeo2 } from "@dev/core/src/geography/geography.interfaces";
import { AbstractDisplayMap } from "@dev/core/src/map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "@dev/core/src/tiles/tiles.interfaces";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { AbstractMesh, Mesh, Scene, TransformNode, VertexData } from "@babylonjs/core";
import { TerrainTile } from "./terrain.tile";
export declare class SurfaceTileMap<V, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    _pivot: TransformNode;
    _translate: TransformNode;
    _grid: VertexData;
    _template: Mesh;
    constructor(name: string, scene: Scene, display: H, datasource: ITileDatasource<V, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    protected buildGrid(): VertexData;
    protected buildMesh(name: string, scene: Scene): Mesh;
    protected buildInstance(name: string, tile: TerrainTile<V>): AbstractMesh;
    protected buildMapTile(t: ITile<V>): TerrainTile<V>;
    protected onDeleted(key: string, tile: TerrainTile<V>): void;
    protected onAdded(key: string, tile: TerrainTile<V>): void;
    protected invalidateDisplay(): void;
    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: ITile<V>[] | undefined): void;
}
