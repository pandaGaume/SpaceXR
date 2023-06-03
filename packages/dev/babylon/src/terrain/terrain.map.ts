import { AbstractMesh, Mesh, Scene, Tools, TransformNode, Vector3, VertexData } from "@babylonjs/core";

import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { AbstractDisplayMap } from "core/map";
import { CellCoordinateReference, ITile, ITileAddress, ITileDatasource, ITileMetrics } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes/terrain.grid";
import { EPSG3857 } from "core/tiles/tiles.geography";
import { ICartesian3, IRectangle } from "core/geometry/geometry.interfaces";
import { Cartesian3 } from "core/geometry/geometry.cartesian";

import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { TerrainTile } from "./terrain.tile";

export class SurfaceTileMapOptions {
    public static Default = new SurfaceTileMapOptions({
        metrics: EPSG3857.Shared,
        center: Geo2.Zero(),
        levelOfDetail: 10,
        gridOptions: TerrainGridOptions.Shared,
        insets: Cartesian3.Zero(),
    });

    metrics?: ITileMetrics;
    center?: IGeo2;
    levelOfDetail?: number;
    gridOptions?: TerrainGridOptions;
    insets?: ICartesian3;

    public constructor(p: Partial<SurfaceTileMapOptions>) {
        Object.assign(this, p);
    }
}

export class SurfaceTileMapOptionsBuilder {
    _metrics?: ITileMetrics;
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;
    _insets?: ICartesian3;

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
    public withInsets(v?: ICartesian3): SurfaceTileMapOptionsBuilder {
        this._insets = v;
        return this;
    }
    public build(): SurfaceTileMapOptions {
        return new SurfaceTileMapOptions({ metrics: this._metrics, center: this._center, levelOfDetail: this._lod, gridOptions: this._gridOptions, insets: this._insets });
    }
}

export class SurfaceTileMap<V, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    _pivot: TransformNode;
    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;

    _tileSize?: number;
    _tileOffset?: Vector3;

    public constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Scene) {
        const o = { ...SurfaceTileMapOptions.Default, ...options };
        super(display, datasource, o.metrics, o.center, o.levelOfDetail);
        this._options = o;
        this._pivot = new TransformNode(`__${name}_root__`, scene);
        this._pivot.parent = display;
        this._grid = this.buildGrid();
        this._template = this.buildMesh(name, scene);
        this.initialize();
    }

    public get template(): Mesh {
        return this._template;
    }

    public hasMesh(mesh: Mesh): boolean {
        return this._activ.has(mesh.name);
    }

    protected buildGrid(): VertexData {
        // build topology
        const s = this._options.metrics?.tileSize;
        // note : we need to invert indices because we reverse the y and x, as scale -1
        const o = new TerrainGridOptionsBuilder().withColumns(s).withInvertIndices(true).build();
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

    // TODO,introduce metrics overlaps
    protected onAdded(key: string, tile: TerrainTile<V>): void {
        // create the instance
        const instance = this.buildInstance(key, tile);
        instance.scaling.x = instance.scaling.y = this._tileSize || this.metrics.tileSize;
        instance.parent = this._pivot;
        tile.mesh = instance;
    }

    protected invalidateDisplay(rect?: IRectangle): void {
        this.invalidate(this._activ.values());
    }

    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: TerrainTile<V>[] | undefined): void {
        if (added) {
            this.invalidate(added);
        }
    }

    private invalidate(tiles: IterableIterator<TerrainTile<V>> | Array<TerrainTile<V>>) {
        const scale = this._scale;
        const center = this._center;

        this._pivot.scaling = new Vector3(scale / this.display._ppu.x, scale / this.display._ppu.y, 1);
        if (this.rotation) {
            this._pivot.rotation.z = Tools.ToRadians(this.rotation);
        }

        const offset = this._tileOffset || Vector3.Zero();
        for (const t of tiles) {
            if (t.content && t.rect && t.mesh) {
                const c = t.rect.center;
                t.mesh.position.x = c.x - center.x + offset.x;
                t.mesh.position.y = c.y - center.y + offset.y;
                t.mesh.position.z = offset.z;
            }
        }
    }

    private initialize(): void {
        let s = this.metrics.tileSize;
        let x = 0;
        let y = 0;

        // compute origin end size using coordinate references.
        switch (this.metrics.cellCoordinateReference) {
            case CellCoordinateReference.nw: {
                break;
            }
            case CellCoordinateReference.ne: {
                x++;
                break;
            }
            case CellCoordinateReference.se: {
                x++;
                y++;
                break;
            }
            case CellCoordinateReference.sw: {
                y++;
                break;
            }
            case CellCoordinateReference.center:
            default: {
                s--;
                x += 0.5;
                y += 0.5;
                break;
            }
        }
        this._tileSize = s;
        this._tileOffset = new Vector3(x, y, 0);
        this._pivot.position.z = this._options.insets?.z || 0;
    }
}
