import { AbstractMesh, Material, Mesh, Nullable, Scene, Tools, Vector3, VertexData } from "@babylonjs/core";

import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { AbstractDisplayMap } from "core/map";
import { ITile, ITileAddress, ITileClient, ITileDatasource, IsTileContentView } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes/terrain.grid";
import { ICartesian3, IRectangle } from "core/geometry/geometry.interfaces";
import { Cartesian3 } from "core/geometry/geometry.cartesian";

import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { TerrainTile } from "../terrain.tile";
import { IDemInfos } from "core/dem/dem.interfaces";
import { LODTransitionMode } from "core/tiles/tiles.mapview";
import { TerrainHologramMaterial, TerrainHologramMaterialOptions } from "../../materials";
import { TileContentManager } from "core/tiles/tiles.content.manager";

export class SurfaceTileMapOptions extends TerrainHologramMaterialOptions {
    public static Default = new SurfaceTileMapOptions({
        center: Geo2.Zero(),
        levelOfDetail: 10,
        gridOptions: TerrainGridOptions.Shared,
        insets: Cartesian3.Zero(),
        exageration: 1.0,
        lodTransition: LODTransitionMode.LINEAR,
    });

    public center?: IGeo2;
    public levelOfDetail?: number;
    public gridOptions?: TerrainGridOptions;
    public insets?: ICartesian3;
    public lodTransition?: LODTransitionMode;

    public constructor(p: Partial<SurfaceTileMapOptions>) {
        super();
        Object.assign(this, p);
    }
}

export class SurfaceTileMapOptionsBuilder {
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;
    _insets?: ICartesian3;
    _exageration?: number;
    _layerClient?: ITileClient<HTMLImageElement>;

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
    public withExageration(v?: number): SurfaceTileMapOptionsBuilder {
        this._exageration = v;
        return this;
    }
    public withLayer(v: ITileClient<HTMLImageElement>): SurfaceTileMapOptionsBuilder {
        this._layerClient = v;
        return this;
    }
    public build(): SurfaceTileMapOptions {
        return new SurfaceTileMapOptions({
            center: this._center,
            levelOfDetail: this._lod,
            gridOptions: this._gridOptions,
            insets: this._insets,
            exageration: this._exageration,
            layerClient: this._layerClient,
        });
    }
}

export class SurfaceTileMap<V extends IDemInfos, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    private static InitZ(column: number, row: number, w: number, h: number): number {
        let i = column == w - 1 ? 1 : 0;
        let j = row == h - 1 ? 2 : 0;
        return i + j;
    }

    private static InitUV(column: number, row: number, w: number, h: number): number[] {
        let u = column == w - 1 ? 0 : column / (w - 2);
        let v = row == h - 1 ? 0 : row / (h - 2);
        return [u, v];
    }

    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;

    _offset?: Vector3;

    public constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Nullable<Scene>) {
        const o = { ...SurfaceTileMapOptions.Default, ...options };
        super(display, new TileContentManager<V>(datasource), o.center, o.levelOfDetail);
        this._options = o;
        this._grid = this.buildGrid();
        this._template = this.buildMesh(name, scene);
        this._template.material = this.buildMaterial(name, scene);
        this._view._lodTransition = o.lodTransition!;
        this._view.validate();
    }

    public set material(m: Nullable<Material>) {
        this._template.material = m;
    }

    public get material(): Nullable<Material> {
        return this._template.material;
    }

    public get template(): Mesh {
        return this._template;
    }

    public hasMesh(mesh: Mesh): boolean {
        return this._activ.has(mesh.name);
    }

    protected buildGrid(): VertexData {
        // build topology
        const s = this.metrics?.tileSize;

        const o = new TerrainGridOptionsBuilder()
            .withColumns(s + 1) // add one column to fill the gap
            .withRows(s + 1) // add one row to fill the gap - optional as by default the builder build a square if one of the dimension is missing. Added for clarity.
            .withScale(1, -1) // we consider a grid of "texel" or "pixel" oriented as an image is oriented in display
            .withInvertIndices(true) //  we need to invert indices as we reverse y
            .withZInitializer(SurfaceTileMap.InitZ) // register the z initializer, which serve as referencing the texture depth
            .withUvs(true) // generate uvs.
            .withUVInitializer(SurfaceTileMap.InitUV) // register the uv initializer, which serve as referencing the texture coordinate used in conjunction with depth
            .build();
        const data = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        return data;
    }

    protected buildMesh(name: string, scene?: Nullable<Scene>): Mesh {
        const mesh = new Mesh(name, scene);
        //const normals: Array<number> = [];
        //VertexData.ComputeNormals(this._grid.positions, this._grid.indices, normals);
        //this._grid.normals = normals;
        this._grid.applyToMesh(mesh, true);

        // define material
        // mesh.material = new MapMaterial(`${name}_material`, scene);

        // define instance properties using .registerInstancedBuffer
        mesh.setEnabled(false);
        return mesh;
    }

    protected buildInstance(name: string, tile: TerrainTile<V>): AbstractMesh {
        // fill instanced properties - which are declared into buildTemplate - with instance.instancedBuffers
        //const a = tile.address;
        //instance.instancedBuffers.address = new Vector3(a.x, a.y, a.levelOfDetail);$
        const instance = this._template.createInstance(name);
        instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
        instance.scaling.z = 1.0;
        instance.parent = this.display.context;
        tile.surface = instance;
        return instance;
    }

    protected buildMapTile(t: ITile<V>): TerrainTile<V> {
        return new TerrainTile(t);
    }

    protected onDeleted(key: string, tile: TerrainTile<V>): void {
        // remove from the scene.
        tile.dispose();
    }

    protected onUpdated(key: string, tile: TerrainTile<V>): void {
        if (!tile.surface) {
            if (tile.content && tile.content[0]) {
                this.buildInstance(key, tile);
            }
        } else {
            if (!tile.content || !tile.content[0]) {
                tile.dispose();
            }
        }
    }

    // TODO,introduce metrics overlaps
    protected onAdded(key: string, tile: TerrainTile<V>): void {
        // create the instance
        if (tile.content && tile.content[0]) {
            this.buildInstance(key, tile);
        }
    }

    protected invalidateDisplay(rect?: IRectangle): void {
        this.invalidate(this._activ.values());
    }

    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: TerrainTile<V>[] | undefined): void {
        if (added) {
            this.invalidate(added);
        }
    }

    protected buildMaterial(name: string, scene?: Nullable<Scene>): Nullable<Material> {
        if (!scene) {
            return null;
        }
        return new TerrainHologramMaterial(`${name}.material`, this, this._options, scene);
    }

    private invalidate(tiles: IterableIterator<TerrainTile<V>> | Array<TerrainTile<V>>) {
        const scale = Math.abs(this._scale);
        // this is the center expressed in "texel" or "pixel"
        const center = this._center;
        const context = this.display.context;

        context.scaling = new Vector3(scale / this.display._ppu.x, scale / this.display._ppu.y, 1);

        if (this.azimuth !== undefined) {
            context.rotation.z = Tools.ToRadians(this.azimuth);
        }

        const offset = this._offset || Vector3.Zero();
        for (const t of tiles) {
            const contents = t.content;
            if (contents?.length) {
                if (t.rect && t.surface) {
                    for (const item of contents) {
                        if (item) {
                            if (IsTileContentView<V>(item)) {
                                // never happen while Transition mode is OFF
                                continue;
                            }
                            // this is the rect expressed in "texel" or "pixel"
                            const c = t.rect.center;
                            const x = c.x - center.x + offset.x;
                            const y = c.y - center.y + offset.y;
                            t.surface.position.x = x;
                            t.surface.position.y = y;
                            t.surface.position.z = offset.z;
                        }
                    }
                }
            }
        }
    }
}
