import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { AbstractDisplayMap } from "core/map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes/terrain.grid";
import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { AbstractMesh, Mesh, Scene, Tools, TransformNode, Vector3, VertexData } from "@babylonjs/core";
import { TerrainTile } from "./terrain.tile";
import { EPSG3857 } from "core/tiles/tiles.geography";

export class SurfaceTileMapOptions {
    public static Default = new SurfaceTileMapOptions({ metrics: EPSG3857.Shared, center: Geo2.Zero(), levelOfDetail: 10, gridOptions: TerrainGridOptions.Shared });

    metrics?: ITileMetrics;
    center?: IGeo2;
    levelOfDetail?: number;
    gridOptions?: TerrainGridOptions;

    public constructor(p: Partial<SurfaceTileMapOptions>) {
        Object.assign(this, p);
    }
}

export class SurfaceTileMapOptionsBuilder {
    _metrics?: ITileMetrics;
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;

    public withMetrics(v?: ITileMetrics): SurfaceTileMapOptionsBuilder {
        this._metrics = v;
        return this;
    }
    public withCenter(v?: IGeo2): SurfaceTileMapOptionsBuilder {
        this._center = v;
        return this;
    }
    public withLeveOfDetail(v?: number): SurfaceTileMapOptionsBuilder {
        this._lod = v;
        return this;
    }
    public withGridOptions(v?: TerrainGridOptions): SurfaceTileMapOptionsBuilder {
        this._gridOptions = v;
        return this;
    }
    public build(): SurfaceTileMapOptions {
        return new SurfaceTileMapOptions({ metrics: this._metrics, center: this._center, levelOfDetail: this._lod, gridOptions: this._gridOptions });
    }
}

export class SurfaceTileMap<V, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    _pivot: TransformNode;
    _translate: TransformNode;
    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;

    public constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Scene) {
        const o = { ...SurfaceTileMapOptions.Default, ...options };
        super(display, datasource, o.metrics, o.center, o.levelOfDetail);
        this._options = o;
        this._pivot = new TransformNode(`__${name}_root__`, scene);
        this._pivot.parent = display;
        this._translate = new TransformNode(`__${name}_trans__`, scene);
        this._translate.parent = this._pivot;
        this._grid = this.buildGrid();
        this._template = this.buildMesh(name, scene);
    }

    protected buildGrid(): VertexData {
        // build topology
        const s = this._options.metrics?.tileSize;
        const o = new TerrainGridOptionsBuilder().withWidth(s).build();
        o.invertIndices = this._options.gridOptions?.invertIndices;
        o.invertYZ = this._options.gridOptions?.invertYZ;
        return new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
    }

    protected buildMesh(name: string, scene?: Scene): Mesh {
        const mesh = new Mesh(name, scene);
        this._grid.applyToMesh(mesh, true);

        // define material
        // mesh.material = new MapMaterial(`${name}_material`, scene);

        // define instance properties using .registerInstancedBuffer
        //mesh.registerInstancedBuffer("address", 3); // X,Y,LOD

        mesh.setEnabled(false);
        return mesh;
    }

    protected buildInstance(name: string, tile: TerrainTile<V>): AbstractMesh {
        const instance = this._template.createInstance(name);
        // fill instanced properties - which are declared into buildTemplate - with instance.instancedBuffers
        //const a = tile.address;
        //instance.instancedBuffers.address = new Vector3(a.x, a.y, a.levelOfDetail);
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
        instance.parent = this._translate;
        const s = this.metrics.tileSize;
        instance.position = new Vector3(tile.rect?.x || 0, tile.rect?.y || 0, 0).subtract(new Vector3(this._center.x - s / 2, this._center.y - s / 2, 0));
        instance.scaling.x = s;
        instance.scaling.y = s;
        //console.log(instance.position);
        // finally bind to display as root
        //console.log("scaling", instance.scaling);
        tile.mesh = instance;
    }

    protected invalidateDisplay(): void {
        const dimension = this._display.dimensions;
        const resolution = this._display.resolution;
        const sw = dimension.width / resolution.width;
        const sh = dimension.height / resolution.height;

        console.log("dimension", dimension);
        console.log("resolution", resolution);
        console.log("scale", this._scale, "sw", sw, "sh", sh);
        console.log("scale", this._scale, "sw", sw, "sh", sh);
        this._pivot.scaling = new Vector3(this._scale * sw, this._scale * sh, 1);
        this._pivot.rotation.z = Tools.ToRadians(this.rotation);
        //this._translate.position.x = -this._center.x;
        //this._translate.position.z = -this._center.y;
    }

    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: ITile<V>[] | undefined): void {}
}
