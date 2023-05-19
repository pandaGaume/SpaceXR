import { IGeo2 } from "@dev/core/src/geography/geography.interfaces";
import { AbstractDisplayMap } from "@dev/core/src/map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "@dev/core/src/tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "@dev/core/src/meshes/terrain.grid";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { AbstractMesh, Mesh, Scene, Tools, TransformNode, Vector3, VertexData } from "@babylonjs/core";
import { TerrainTile } from "./terrain.tile";
import { MapMaterial } from "../materials";

export class SurfaceTileMap<V, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    _pivot: TransformNode;
    _translate: TransformNode;
    _grid: VertexData;
    _template: Mesh;

    public constructor(name: string, scene: Scene, display: H, datasource: ITileDatasource<V, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        super(display, datasource, metrics, center, lod);
        this._pivot = new TransformNode(`__${name}_root__`, scene);
        this._pivot.setParent(display);
        this._translate = new TransformNode(`__${name}_trans__`, scene);
        this._translate.setParent(this._pivot);
        this._grid = this.buildGrid();
        this._template = this.buildMesh(name, scene);
    }

    protected buildGrid(): VertexData {
        // build topology
        const o = new TerrainGridOptions(this.metrics.tileSize);
        return new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
    }

    protected buildMesh(name: string, scene: Scene): Mesh {
        const mesh = new Mesh(name, scene);
        this._grid.applyToMesh(mesh, true);

        // define material
        mesh.material = new MapMaterial(`${name}_material`, scene);

        // define instance properties using .registerInstancedBuffer
        mesh.registerInstancedBuffer("address", 3); // X,Y,LOD

        return mesh;
    }

    protected buildInstance(name: string, tile: TerrainTile<V>): AbstractMesh {
        const instance = this._template.createInstance(name);
        // fill instanced properties - which are declared into buildTemplate - with instance.instancedBuffers
        const a = tile.address;
        instance.instancedBuffers.address = new Vector3(a.x, a.y, a.levelOfDetail);
        return instance;
    }

    protected buildMapTile(t: ITile<V>): TerrainTile<V> {
        return new TerrainTile(t);
    }

    protected onDeleted(key: string, tile: TerrainTile<V>): void {
        // remove from the scene.
        tile.dispose();
    }

    protected onAdded(key: string, tile: TerrainTile<V>): void {
        // create the instance
        const instance = this.buildInstance(key, tile);
        // finally bind to display as root
        instance.setParent(this._translate);
        tile.mesh = instance;
    }

    protected invalidateDisplay(): void {
        this._pivot.scaling = new Vector3(this._scale, 1, this._scale);
        this._pivot.rotation.y = Tools.ToRadians(this.rotation);
        this._translate.position.x = -this._center.x;
        this._translate.position.y = -this._center.y;
    }

    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: ITile<V>[] | undefined): void {}
}
