import { IGeo2 } from "@dev/core/src/geography/geography.interfaces";
import { AbstractDisplayMap } from "@dev/core/src/map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "@dev/core/src/tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "@dev/core/src/meshes/terrain.grid";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { Mesh, Scene, Vector3, VertexData } from "@babylonjs/core";
import { TerrainTile } from "./terrain.tile";
import { MapMaterial } from "../materials";

export class SurfaceTileMap<V, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    _template: Mesh;

    public constructor(name: string, scene: Scene, display: H, datasource: ITileDatasource<V, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        super(display, datasource, metrics, center, lod);
        this._template = this.buildTemplate(name, scene);
    }

    protected buildTemplate(name: string, scene: Scene): Mesh {
        // build topology
        const o = new TerrainGridOptions(this.metrics.tileSize);
        const vd = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        const mesh = new Mesh(name, scene);
        vd.applyToMesh(mesh, true);

        // define material
        mesh.material = new MapMaterial(`${name}_material`, scene);

        // define instance properties using .registerInstancedBuffer
        mesh.registerInstancedBuffer("address", 3); // X,Y,LOD

        return mesh;
    }

    protected buildMapTile(t: ITile<V>): TerrainTile<V> {
        return new TerrainTile(t);
    }

    protected onDeleted(key: string, tile: TerrainTile<V>): void {
        // remove from the scene.
        tile.dispose();
    }
    protected onAdded(key: string, tile: TerrainTile<V>): void {
        const instance = this._template.createInstance(key);
        
        // fill instanced properties - which are declared into buildTemplate - with instance.instancedBuffers
        const a = tile.address;
        instance.instancedBuffers.address = new Vector3(a.x, a.y, a.levelOfDetail);

        // finally bind to display as root
        instance.setParent(this.display);
        tile.mesh = instance;
    }
    protected invalidateDisplay(): void {}
    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: ITile<V>[] | undefined): void {}
}
